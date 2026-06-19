/**
 * Vercel Cron Job — 매일 1회 실행 (UTC 01:00 = KST 10:00)
 * MOLIT 실거래가 API를 polling → 전날까지 없던 신규 거래를 Supabase에 저장
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log(`[cron-realtrade] 실행 시작: ${new Date().toISOString()}`);

  const serviceKey = process.env.MOLIT_API_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'MOLIT_API_KEY not configured' });

  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const LAWD_CD = '11500'; // 강서구 (Vercel에서 MOLIT IP 차단으로 사실상 항상 실패 — Mac launchd sync가 실제 데이터 소스)

  // ── 유틸 ──────────────────────────────────────
  function getTag(block, tag) {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function parseItems(xml) {
    const items = [];
    const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const b of blocks) {
      const block = b[1];
      if (getTag(block, 'cdealType').trim()) continue; // 계약 해제 제외

      const name = getTag(block, 'aptNm').trim()
                || getTag(block, 'mhouseNm').trim()
                || getTag(block, 'srgbCdNm').trim();

      const year  = getTag(block, 'dealYear');
      const month = getTag(block, 'dealMonth').padStart(2, '0');
      const day   = getTag(block, 'dealDay').padStart(2, '0');
      const price = getTag(block, 'dealAmount').replace(/,/g, '').replace(/\s/g, '');
      const area  = getTag(block, 'excluUseAr');
      const floor = getTag(block, 'floor');

      if (!name || !price) continue;

      items.push({
        trade_key: `${LAWD_CD}_${name}_${year}${month}${day}_${price}_${area}_${floor}`,
        lawd_cd:   LAWD_CD,
        apt_name:  name,
        price, area, floor,
        deal_year: year, deal_month: month, deal_day: day,
        dong: getTag(block, 'umdNm').trim(),
        trade_type: getTag(block, 'dealingGbn') || '매매',
      });
    }
    return items;
  }

  async function fetchMonth(month) {
    const PER_PAGE = 1000;
    const base = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
      + `?serviceKey=${encodeURIComponent(serviceKey)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${month}&numOfRows=${PER_PAGE}`;

    const r1 = await fetch(`${base}&pageNo=1`);
    if (!r1.ok) throw new Error(`HTTP ${r1.status} for ${month}`);
    const xml1 = await r1.text();

    const totalMatch = xml1.match(/<totalCount>(\d+)<\/totalCount>/);
    const totalPages = Math.ceil((totalMatch ? parseInt(totalMatch[1]) : 0) / PER_PAGE);

    let items = parseItems(xml1);
    if (totalPages > 1) {
      const extras = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(`${base}&pageNo=${i + 2}`)
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

  // ── 최근 2개월 MOLIT 조회 ──────────────────────
  const now = new Date();
  const months = [0, 1].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  let allTrades = [];
  const results = await Promise.allSettled(months.map(m => fetchMonth(m)));
  const monthDebug = results.map((r, i) => ({
    month: months[i],
    ok: r.status === 'fulfilled',
    count: r.status === 'fulfilled' ? r.value.length : 0,
    error: r.status === 'rejected' ? String(r.reason) : null,
  }));
  console.log('[cron-realtrade] MOLIT 조회 결과:', JSON.stringify(monthDebug));
  for (const r of results) {
    if (r.status === 'fulfilled') allTrades = allTrades.concat(r.value);
  }

  if (allTrades.length === 0) {
    return res.status(200).json({ inserted: 0, total: 0, message: 'No trades fetched', monthDebug });
  }

  // ── Supabase: 이미 저장된 trade_key 목록 조회 ──
  const { data: existing, error: selectErr } = await supabase
    .from('trade_snapshots')
    .select('trade_key');

  if (selectErr) {
    console.error('Supabase select error:', selectErr);
    return res.status(500).json({ error: selectErr.message });
  }

  const existingKeys = new Set((existing || []).map(r => r.trade_key));
  console.log(`[cron-realtrade] DB 기존 키: ${existingKeys.size}건, MOLIT 조회: ${allTrades.length}건`);

  // ── 신규 거래 필터링 ──────────────────────────
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const newTrades = allTrades
    .filter(t => !existingKeys.has(t.trade_key))
    .map(t => ({ ...t, report_date: today }));
  console.log(`[cron-realtrade] 신규 필터링: ${newTrades.length}건`);

  // ── Supabase INSERT ───────────────────────────
  let inserted = 0;
  if (newTrades.length > 0) {
    // 배치 100건씩 나눠서 삽입
    const BATCH = 100;
    for (let i = 0; i < newTrades.length; i += BATCH) {
      const batch = newTrades.slice(i, i + BATCH);
      const { error: insertErr, count } = await supabase
        .from('trade_snapshots')
        .insert(batch, { count: 'exact' });
      if (insertErr) {
        console.error('Insert error:', insertErr);
      } else {
        inserted += count || batch.length;
      }
    }
  }

  console.log(`[cron-realtrade] 완료: ${inserted}건 삽입 / MOLIT ${allTrades.length}건 / 기존 ${existingKeys.size}건`);
  return res.status(200).json({
    inserted,
    total: allTrades.length,
    existing: existingKeys.size,
    today,
    monthDebug,
    message: `${inserted}건의 신규 거래 추가`,
  });
}
