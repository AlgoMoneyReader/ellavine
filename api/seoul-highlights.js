/**
 * 서울 전역 실거래 하이라이트
 * - 신고가: 서울 각 구별 병렬 쿼리로 정확한 데이터 수집
 * - 구별 대장 단지: 각 구 최고가 단지 + top 50 거래
 * - 평형별 신고가: 전체/20평형/30평형/40평형/50평+ 각각 top 30
 *
 * DB area 컬럼 = 전용면적(㎡) 기준
 *   20평형: 전용 < 66㎡ (59㎡ 타입)
 *   30평형: 전용 66~99㎡ (84㎡ 타입)
 *   40평형: 전용 100~134㎡ (114㎡ 타입)
 *   50평+:  전용 135㎡ 이상
 *
 * Supabase 기본 max_rows = 1000이므로 구별로 병렬 쿼리 (25개)
 */
import { createClient } from '@supabase/supabase-js';

const SEOUL_GU = [
  { code: '11680', name: '강남구' }, { code: '11740', name: '강동구' },
  { code: '11305', name: '강북구' }, { code: '11500', name: '강서구' },
  { code: '11620', name: '관악구' }, { code: '11215', name: '광진구' },
  { code: '11530', name: '구로구' }, { code: '11545', name: '금천구' },
  { code: '11350', name: '노원구' }, { code: '11320', name: '도봉구' },
  { code: '11230', name: '동대문구' }, { code: '11590', name: '동작구' },
  { code: '11440', name: '마포구' }, { code: '11410', name: '서대문구' },
  { code: '11650', name: '서초구' }, { code: '11200', name: '성동구' },
  { code: '11290', name: '성북구' }, { code: '11710', name: '송파구' },
  { code: '11470', name: '양천구' }, { code: '11560', name: '영등포구' },
  { code: '11170', name: '용산구' }, { code: '11380', name: '은평구' },
  { code: '11110', name: '종로구' }, { code: '11140', name: '중구' },
  { code: '11260', name: '중랑구' },
];

function toPriceNum(price) {
  return parseInt(String(price).replace(/,/g, '')) || 0;
}

/** 동일 거래 중복 제거: (단지+면적+층+계약일+가격) 기준 */
function dedupTrades(list) {
  const seen = new Set();
  return list.filter(t => {
    const k = `${t.apt_name}|${t.area}|${t.floor}|${t.deal_year}|${t.deal_month}|${t.deal_day}|${t.priceNum}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** 전용면적 기준 평형 분류 */
function getSizeGroup(area) {
  const a = parseFloat(area) || 0;
  if (a < 66) return '20평형';   // 전용 59㎡ → 20평형
  if (a < 95) return '30평형';   // 전용 84㎡ → 30평형 (95㎡ 미만; 99.5㎡는 40평형)
  if (a < 135) return '40평형';  // 전용 114㎡ → 40평형
  return '50평+';
}

const SIZE_KEYS = ['20평형', '30평형', '40평형', '50평+'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 최근 90일
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10);

  // ── 구별 병렬 쿼리 (Supabase max_rows=1000 → 페이지네이션으로 우회) ──────────
  // DB trade_type: 매매='중개거래'|'직거래', 전세='전세'
  // 강서구 매매만 90일 ~2500건이므로 3페이지(0~2999) 병렬 조회
  const guResults = await Promise.all(
    SEOUL_GU.map(async (gu) => {
      const baseQuery = () => supabase
        .from('trade_snapshots')
        .select('report_date, apt_name, price, area, floor, deal_year, deal_month, deal_day, dong, trade_type, lawd_cd')
        .eq('lawd_cd', gu.code)
        .in('trade_type', ['중개거래', '직거래'])  // 매매만 (전세/월세 제외)
        .gte('report_date', sinceStr);

      // 세 페이지 병렬 요청 (0~999, 1000~1999, 2000~2999)
      const [res1, res2, res3] = await Promise.all([
        baseQuery().range(0, 999),
        baseQuery().range(1000, 1999),
        baseQuery().range(2000, 2999),
      ]);

      const raw = [...(res1.data || []), ...(res2.data || []), ...(res3.data || [])];
      if (raw.length === 0) return { gu, trades: [] };

      const trades = raw
        .map(t => ({ ...t, priceNum: toPriceNum(t.price), guName: gu.name }))
        .sort((a, b) => b.priceNum - a.priceNum);

      return { gu, trades };
    })
  );

  // ── 1. 구별 대장 단지 ────────────────────────────────────────────
  const guLeaders = [];
  let totalCount = 0;

  // 최근 30일 기준선
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since30Str = since30.toISOString().slice(0, 10);

  for (const { gu, trades } of guResults) {
    totalCount += trades.length;
    if (trades.length === 0) continue;

    const leader = trades[0]; // 가격 최고 거래

    // 구별 top 50 거래 (평형 필터를 프론트에서 처리할 수 있게 충분히 반환)
    const mapTrade = t => ({
      apt_name: t.apt_name,
      priceNum: t.priceNum,
      area: t.area,
      floor: t.floor,
      deal_year: t.deal_year,
      deal_month: t.deal_month,
      deal_day: t.deal_day,
      dong: t.dong,
      report_date: t.report_date,
      guName: t.guName,
    });
    const topTrades = dedupTrades(trades).slice(0, 50).map(mapTrade);

    // 최근 30일 거래 (신고일 기준, 가격순, 중복 제거)
    const recent30 = dedupTrades(trades.filter(t => t.report_date >= since30Str));
    const recentTrades = recent30.slice(0, 30).map(mapTrade);
    const count30d = recent30.length;

    // 평형별 대장 (각 평형에서 가장 비싼 거래)
    const leaderBySize = {};
    for (const sk of SIZE_KEYS) {
      const sizedTrade = trades.find(t => getSizeGroup(t.area) === sk);
      if (sizedTrade) {
        leaderBySize[sk] = {
          aptName: sizedTrade.apt_name,
          priceNum: sizedTrade.priceNum,
          area: sizedTrade.area,
          floor: sizedTrade.floor,
          dong: sizedTrade.dong,
        };
      }
    }

    guLeaders.push({
      guCode: gu.code,
      guName: gu.name,
      aptName: leader.apt_name,
      topPriceNum: leader.priceNum,
      topArea: leader.area,
      topFloor: leader.floor,
      topDate: `${leader.deal_year}.${String(leader.deal_month).replace(/^0/,'')}.${String(leader.deal_day||'').replace(/^0/,'')}`.replace(/\.$/, ''),
      dong: leader.dong,
      topTrades,
      recentTrades,  // 최근 30일 거래 (신고일 기준)
      count30d,      // 최근 30일 실거래 건수
      leaderBySize,
    });
  }

  // 가나다순 정렬
  guLeaders.sort((a, b) => a.guName.localeCompare(b.guName, 'ko'));

  // ── 2. 서울 전역 일별 전체 거래 (계약일 기준) ─────────────────────
  const allTradesFlat = dedupTrades(guResults.flatMap(({ trades }) => trades));
  const dayMap = {};
  for (const t of allTradesFlat) {
    if (!t.deal_year || !t.deal_month || !t.deal_day) continue;
    const y = t.deal_year;
    const m = String(parseInt(t.deal_month)).padStart(2, '0');
    const d = String(parseInt(t.deal_day)).padStart(2, '0');
    const key = `${y}-${m}-${d}`; // YYYY-MM-DD (사전순 = 날짜순)
    if (!dayMap[key]) dayMap[key] = [];
    dayMap[key].push({
      apt_name: t.apt_name,
      priceNum: t.priceNum,
      area: t.area,
      floor: t.floor,
      dong: t.dong,
      guName: t.guName,
      lawd_cd: t.lawd_cd,
    });
  }
  const dailyAll = Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))  // YYYY-MM-DD 형식이므로 사전순 = 날짜 내림차순
    .map(([date, trades]) => ({
      date,  // YYYY-MM-DD
      count: trades.length,
      trades: trades.sort((a, b) => b.priceNum - a.priceNum),
    }));

  // ── 3. 서울 전역 신고가 — 전체 + 평형별 각 TOP 30 ────────────────
  // 전체 raw 거래 (각 구 dedup 후 top 50 합산) → 전체 중복 제거 → 가격순
  const allRaw = dedupTrades(
    guResults.flatMap(({ trades }) => dedupTrades(trades).slice(0, 50))
  ).sort((a, b) => b.priceNum - a.priceNum);

  // 전체 top 30
  const highPrice = allRaw.slice(0, 30);

  // 평형별 top 30
  const highBySize = {};
  for (const sk of SIZE_KEYS) {
    highBySize[sk] = allRaw
      .filter(t => getSizeGroup(t.area) === sk)
      .slice(0, 30);
  }

  return res.status(200).json({
    highPrice,      // 전체 top 30 (전체 필터)
    highBySize,     // 평형별 top 30 { '20평형': [...], '30평형': [...], ... }
    guLeaders,
    dailyAll,       // 일별 전체 거래 (계약일 기준, 가격 내림차순)
    since: sinceStr,
    updatedAt: new Date().toISOString(),
    total: totalCount,
    guCount: guLeaders.length,
  });
}
