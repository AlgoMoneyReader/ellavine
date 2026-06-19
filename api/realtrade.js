import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const serviceKey = process.env.MOLIT_API_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'API key not configured' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // 구 코드: 기본값 강서구 (11500), 쿼리로 서울 전 구 선택 가능
  const LAWD_CD = (req.query.lawd || '11500').replace(/[^0-9]/g, '').slice(0, 5) || '11500';
  const FETCH_TIMEOUT = 6000; // 6초 per fetch

  // 최근 N개월 YYYYMM 목록
  function getMonths(n) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  // 타임아웃 있는 fetch
  function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  // XML에서 특정 태그 값 추출
  function getTag(block, tag) {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  // XML → 아이템 배열 (영문 태그 기준 — 국토부 상세 API)
  function parseItems(xml) {
    const items = [];
    const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const b of blocks) {
      const block = b[1];

      // 계약 해제 건 제외 (cdealType 비어있으면 정상 거래)
      const cdealType = getTag(block, 'cdealType').trim();
      if (cdealType) continue;

      const name = getTag(block, 'aptNm').trim()
                || getTag(block, 'mhouseNm').trim()  // 분양권 단지명
                || getTag(block, 'srgbCdNm').trim(); // fallback

      items.push({
        price:     getTag(block, 'dealAmount').replace(/,/g, '').replace(/\s/g, ''),
        area:      getTag(block, 'excluUseAr'),
        floor:     getTag(block, 'floor'),
        year:      getTag(block, 'dealYear'),
        month:     getTag(block, 'dealMonth').padStart(2, '0'),
        day:       getTag(block, 'dealDay').padStart(2, '0'),
        name,
        dong:      getTag(block, 'umdNm').trim(),
        buildYear: getTag(block, 'buildYear'),
        tradeType: getTag(block, 'dealingGbn') || '매매',
      });
    }
    return items.filter(it => it.name && it.price);
  }

  async function fetchAPI(endpoint, month) {
    const PER_PAGE = 1000;
    const base = `https://apis.data.go.kr/1613000/${endpoint}?serviceKey=${encodeURIComponent(serviceKey)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${month}&numOfRows=${PER_PAGE}`;

    const r1 = await fetchWithTimeout(`${base}&pageNo=1`);
    if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
    const xml1 = await r1.text();

    // MOLIT 에러 코드 감지
    const resultCode = (xml1.match(/<resultCode>([^<]+)<\/resultCode>/) || [])[1]?.trim();
    const resultMsg  = (xml1.match(/<resultMsg>([^<]+)<\/resultMsg>/)  || [])[1]?.trim();
    if (resultCode && resultCode !== '00' && resultCode !== '000') {
      throw new Error(`MOLIT error ${resultCode}: ${resultMsg} (${month})`);
    }

    const totalMatch = xml1.match(/<totalCount>(\d+)<\/totalCount>/);
    const totalCount = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const totalPages = Math.ceil(totalCount / PER_PAGE);

    let items = parseItems(xml1);

    if (totalPages > 1) {
      const extras = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchWithTimeout(`${base}&pageNo=${i + 2}`)
            .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(xml => parseItems(xml))
        )
      );
      for (const r of extras) {
        if (r.status === 'fulfilled') items = items.concat(r.value);
      }
    }

    return items;
  }

  function collect(results, dongFilter = null) {
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(it => !dongFilter || it.dong === dongFilter)
      .sort((a, b) => {
        const da = `${a.year}${a.month}`;
        const db = `${b.year}${b.month}`;
        return db.localeCompare(da);
      });
  }

  const months = getMonths(12);

  const [aptResults, silvResults] = await Promise.all([
    Promise.allSettled(months.map(m => fetchAPI('RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', m))),
    Promise.allSettled(months.map(m => fetchAPI('RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade', m))),
  ]);

  const aptOk = aptResults.filter(r => r.status === 'fulfilled').length;
  console.log(`[realtrade] MOLIT APT: ${aptOk}/${months.length}개월 성공`);

  // ── MOLIT 전체 실패 → Supabase fallback ──
  if (aptOk === 0 && supabaseUrl && supabaseKey) {
    console.log(`[realtrade] MOLIT 전체 실패 → Supabase fallback (lawd_cd=${LAWD_CD})`);
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      const { data: rows, error } = await supabase
        .from('trade_snapshots')
        .select('*')
        .eq('lawd_cd', LAWD_CD)
        .order('deal_year',  { ascending: false })
        .order('deal_month', { ascending: false })
        .order('deal_day',   { ascending: false });

      if (error) throw error;

      if (rows && rows.length > 0) {
        const toItem = r => ({
          price:     r.price,
          area:      r.area,
          floor:     r.floor,
          year:      r.deal_year,
          month:     r.deal_month,
          day:       r.deal_day,
          name:      r.apt_name,
          dong:      r.dong,
          buildYear: '',
          tradeType: r.trade_type || '매매',
        });

        const allItems = rows.map(toItem);
        const apt    = LAWD_CD === '11500' ? allItems.filter(it => it.dong === '마곡동') : allItems;
        const aptAll = allItems;
        const silv   = [];

        console.log(`[realtrade] Supabase fallback 성공: apt=${apt.length}, aptAll=${aptAll.length}`);
        res.setHeader('Cache-Control', 's-maxage=1800'); // fallback은 30분 캐시
        return res.status(200).json({
          apt, aptAll, silv,
          updatedAt: new Date().toISOString(),
          _source: 'supabase_fallback',
        });
      }
    } catch (e) {
      console.error('[realtrade] Supabase fallback 실패:', e.message);
    }
  }

  // 강서구일 때만 마곡동 필터 적용, 다른 구는 전체
  const apt    = collect(aptResults, LAWD_CD === '11500' ? '마곡동' : null);
  const aptAll = collect(aptResults, null);
  const silv   = collect(silvResults, null);

  console.log(`[realtrade] 결과: apt=${apt.length}, aptAll=${aptAll.length}, silv=${silv.length}`);

  // 비강서구에서 MOLIT 전체 실패시 짧은 캐시 + 실패 플래그
  if (aptOk === 0) {
    res.setHeader('Cache-Control', 's-maxage=120'); // 2분만 캐시
    return res.status(200).json({ apt, aptAll, silv, updatedAt: new Date().toISOString(), _molitFailed: true });
  }
  res.setHeader('Cache-Control', 's-maxage=10800'); // 3시간 CDN 캐시
  return res.status(200).json({ apt, aptAll, silv, updatedAt: new Date().toISOString() });
}
