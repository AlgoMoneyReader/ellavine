/**
 * 프론트엔드용 — Supabase에서 토허 신고 추적 데이터 조회
 * 신고일자(report_date) 기준으로 최근 60일 데이터 반환
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60'); // 1분 캐시 (Mac sync 직후 빠른 반영)

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // lawd 파라미터: 특정 구 지정 가능 (기본값 강서구 11500)
  const lawd = (req.query.lawd || '11500').replace(/[^0-9]/g, '').slice(0, 5) || '11500';

  // 최근 60일
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().slice(0, 10);

  // 전세: 최근 12개월 (전세 거래는 신고가 매매보다 느릴 수 있어 범위 넓힘)
  const rentSince = new Date();
  rentSince.setMonth(rentSince.getMonth() - 12);
  const rentSinceStr = rentSince.toISOString().slice(0, 10);

  const [{ data, error }, { data: rentData, error: rentError }] = await Promise.all([
    supabase
      .from('trade_snapshots')
      .select('report_date, apt_name, price, area, floor, deal_year, deal_month, deal_day, dong, trade_type, lawd_cd')
      .eq('lawd_cd', lawd)
      .neq('trade_type', '전세')
      .gte('report_date', sinceStr)
      .order('report_date', { ascending: false })
      .limit(5000),
    supabase
      .from('trade_snapshots')
      .select('report_date, apt_name, price, area, floor, deal_year, deal_month, deal_day, dong, trade_type, lawd_cd')
      .eq('lawd_cd', lawd)
      .eq('trade_type', '전세')
      .gte('report_date', rentSinceStr)
      .order('report_date', { ascending: false })
      .limit(3000),
  ]);

  if (error) {
    console.error('Supabase query error:', error);
    return res.status(500).json({ error: error.message });
  }

  // ── 일별 건수 집계 ──────────────────────────
  const dailyMap = {};
  (data || []).forEach(t => {
    dailyMap[t.report_date] = (dailyMap[t.report_date] || 0) + 1;
  });
  const dailyCounts = Object.entries(dailyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);

  // ── 단지별 건수 집계 ──────────────────────────
  const complexMap = {};
  (data || []).forEach(t => {
    if (!complexMap[t.apt_name]) complexMap[t.apt_name] = { total: 0, byDate: {} };
    complexMap[t.apt_name].total++;
    complexMap[t.apt_name].byDate[t.report_date] =
      (complexMap[t.apt_name].byDate[t.report_date] || 0) + 1;
  });

  return res.status(200).json({
    trades: data || [],
    rents: rentData || [],
    dailyCounts,
    complexMap,
    total: data?.length || 0,
    since: sinceStr,
    updatedAt: new Date().toISOString(),
  });
}
