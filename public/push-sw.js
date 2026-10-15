/* New-order notifications (Kedai). Loaded into the app's service worker (vite.config.ts, workbox.importScripts).
   The push carries no data: it only wakes this worker, which asks the API for the newest order. */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let title = 'Pesanan baru';
    let body = 'Buka JualanLab untuk lihat pesanan.';
    let tag = 'kedai-order';
    try {
      const r = await fetch('/api/kedai/summary', { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const s = await r.json();
        if (s.latest) {
          title = 'Pesanan baru ' + s.latest.number;
          body = s.latest.customerName + ' · RM' + (s.latest.totalSen / 100).toFixed(2);
          tag = 'kedai-' + s.latest.number;
        }
      }
    } catch (e) { /* show the plain message */ }
    await self.registration.showNotification(title, {
      body, tag, renotify: true, icon: '/pwa-192.png', badge: '/pwa-192.png', vibrate: [200, 100, 200], data: { url: '/pesanan' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/pesanan';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) await c.navigate(url).catch(() => undefined);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
