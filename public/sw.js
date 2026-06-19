// 래미안 엘라비네 Service Worker v1
const CACHE_NAME = 'ellavine-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── 푸시 알림 수신 ──────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title   = data.title || '래미안 엘라비네';
  const options = {
    body:              data.body  || '',
    icon:              '/favicon.svg',
    badge:             '/favicon.svg',
    data:              data,
    vibrate:           [200, 100, 200],
    requireInteraction: false,
    tag:               data.tag || 'ellavine-notice',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── 알림 클릭 → 앱 열기 ─────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
