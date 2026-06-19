/**
 * POST  /api/push-subscribe  — 구독 저장
 * DELETE /api/push-subscribe  — 구독 삭제
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  // ── 구독 저장 ─────────────────────────────────
  if (req.method === 'POST') {
    const { subscription, username } = req.body || {};
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'subscription.endpoint 필요' });
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint:     subscription.endpoint,
      keys_p256dh:  subscription.keys?.p256dh  ?? null,
      keys_auth:    subscription.keys?.auth     ?? null,
      username:     username ?? null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, message: '구독 저장 완료' });
  }

  // ── 구독 삭제 ─────────────────────────────────
  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint 필요' });

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, message: '구독 해제 완료' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
