/**
 * 서울 전역 일별 전체 거래현황
 * - 25개 구 병렬 쿼리 (3페이지 × 1000 = 최대 3000건/구)
 * - 계약일(deal_year+deal_month+deal_day) 기준 날짜별 그룹핑
 * - 쿼리 기간: ?days=30|60|90 (기본 30일)
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

function dedupTrades(list) {
  const seen = new Set();
  return list.filter(t => {
    const k = `${t.apt_name}|${t.area}|${t.floor}|${t.deal_year}|${t.deal_month}|${t.deal_day}|${t.priceNum}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const days = Math.min(parseInt(req.query.days || '30'), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // 25개 구 병렬 쿼리 (3페이지)
  const guResults = await Promise.all(
    SEOUL_GU.map(async (gu) => {
      const baseQuery = () => supabase
        .from('trade_snapshots')
        .select('apt_name, price, area, floor, deal_year, deal_month, deal_day, dong, trade_type')
        .eq('lawd_cd', gu.code)
        .in('trade_type', ['중개거래', '직거래'])
        .gte('report_date', sinceStr);

      const [r1, r2, r3] = await Promise.all([
        baseQuery().range(0, 999),
        baseQuery().range(1000, 1999),
        baseQuery().range(2000, 2999),
      ]);

      const raw = [...(r1.data || []), ...(r2.data || []), ...(r3.data || [])];
      return raw.map(t => ({
        apt_name: t.apt_name,
        priceNum: toPriceNum(t.price),
        area: t.area,
        floor: t.floor,
        deal_year: t.deal_year,
        deal_month: t.deal_month,
        deal_day: t.deal_day,
        dong: t.dong,
        guName: gu.name,
      }));
    })
  );

  // 전체 합산 + 중복 제거
  const allTrades = dedupTrades(guResults.flat());

  // 계약일 기준 날짜별 그룹핑
  const dayMap = {};
  for (const t of allTrades) {
    if (!t.deal_year || !t.deal_month || !t.deal_day) continue;
    const m = String(parseInt(t.deal_month));
    const d = String(parseInt(t.deal_day));
    const key = `${t.deal_year}.${m}.${d}`;
    if (!dayMap[key]) dayMap[key] = [];
    dayMap[key].push(t);
  }

  // 날짜 내림차순, 각 날짜 내 가격 내림차순
  const days_list = Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, trades]) => ({
      date,
      count: trades.length,
      trades: trades.sort((a, b) => b.priceNum - a.priceNum),
    }));

  return res.status(200).json({
    days: days_list,
    since: sinceStr,
    total: allTrades.length,
    updatedAt: new Date().toISOString(),
  });
}
