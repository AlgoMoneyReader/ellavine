/**
 * Vercel Cron — 매일 12:00 UTC 실행
 * Supabase 프로젝트가 자동 pause 되지 않도록 REST API 핑으로 활성 상태 유지
 */
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env vars not set' });
  }

  const pingUrl = `${supabaseUrl}/rest/v1/`;
  const response = await fetch(pingUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  const ts = new Date().toISOString();
  console.log(`[keep-alive] ${ts} — status ${response.status}`);

  return res.status(200).json({ ok: true, ts, supabase_status: response.status });
}
