/**
 * Vercel Cron — 매일 12:00 UTC 실행
 * Supabase 프로젝트가 자동 pause 되지 않도록 간단한 쿼리로 활성 상태 유지
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env vars not set' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.rpc('version').maybeSingle()
    .catch(() => supabase.from('_keep_alive_ping').select('1').limit(1));

  console.log(`[keep-alive] ${new Date().toISOString()} — ${error ? 'error: ' + error.message : 'ok'}`);

  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
