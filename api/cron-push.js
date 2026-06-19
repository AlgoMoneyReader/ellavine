/**
 * Vercel Cron — 매일 00:00 UTC (KST 09:00) 실행
 * 중도금 납부일 D-7 / D-1 에 등록 구독자에게 푸시 알림 발송
 */
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const PAYMENT_DATES = [
  { step: '1차 중도금', date: '2026-07-15' },
  { step: '2차 중도금', date: '2026-11-16' },
  { step: '3차 중도금', date: '2027-03-15' },
  { step: '4차 중도금', date: '2027-07-15' },
  { step: '5차 중도금', date: '2027-11-15' },
  { step: '6차 중도금', date: '2028-03-15' },
];

export default async function handler(req, res) {
  // VAPID 설정
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail   = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  // KST 기준 오늘 날짜 계산
  const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayStr = nowKST.toISOString().slice(0, 10);
  console.log(`[cron-push] 실행: ${todayStr} (KST)`);

  // D-7 / D-1 해당 납부일 찾기
  const toSend = [];
  for (const p of PAYMENT_DATES) {
    const payDate = new Date(p.date + 'T09:00:00+09:00');
    const diffMs  = payDate - nowKST;
    const diffDays = Math.round(diffMs / 86_400_000);
    if (diffDays === 7 || diffDays === 1) {
      toSend.push({ ...p, diffDays });
    }
  }

  if (toSend.length === 0) {
    console.log('[cron-push] 오늘 발송 대상 없음');
    return res.status(200).json({ today: todayStr, sent: 0, message: '발송 대상 없음' });
  }

  // 구독자 목록
  const { data: subs, error: fetchErr } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const results = [];
  const staleEndpoints = [];

  for (const sub of (subs || [])) {
    for (const item of toSend) {
      const dLabel  = item.diffDays === 1 ? '내일' : '7일 후';
      const payload = JSON.stringify({
        title: `💰 납부 알림 [D-${item.diffDays}]`,
        body:  `${item.step} 납부일 (${item.date})이 ${dLabel}입니다. 잊지 마세요!`,
        url:   '/',
        tag:   `payment-${item.date}`,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload
        );
        results.push({ ok: true, step: item.step });
      } catch (e) {
        // 410 Gone → 만료된 구독 삭제
        if (e.statusCode === 410) staleEndpoints.push(sub.endpoint);
        results.push({ ok: false, step: item.step, error: String(e.message) });
      }
    }
  }

  // 만료된 구독 정리
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints);
    console.log(`[cron-push] 만료 구독 ${staleEndpoints.length}건 삭제`);
  }

  const sent   = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`[cron-push] 완료: 발송 ${sent}건 / 실패 ${failed}건`);

  return res.status(200).json({
    today: todayStr,
    notifications: toSend,
    subscribers: (subs || []).length,
    sent,
    failed,
    staleCleaned: staleEndpoints.length,
  });
}
