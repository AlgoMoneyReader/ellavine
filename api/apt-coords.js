/**
 * 단지별 좌표 조회 API
 * GET /api/apt-coords?lawd=11500
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400'); // 24시간 CDN 캐시

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const lawd = (req.query.lawd || '11500').replace(/[^0-9]/g, '').slice(0, 5);

  const { data, error } = await supabase
    .from('apt_coordinates')
    .select('apt_name, dong, lat, lng, kakao_place_id')
    .eq('lawd_cd', lawd);

  if (error) return res.status(500).json({ error: error.message });

  // Map by apt_name for fast lookup
  const coordMap = {};
  for (const row of (data || [])) {
    coordMap[row.apt_name] = { lat: row.lat, lng: row.lng, dong: row.dong };
  }

  return res.status(200).json({ coords: coordMap, count: data?.length || 0 });
}
