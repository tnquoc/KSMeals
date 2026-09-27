// KSMeals service worker: shows the morning menu reminder (Web Push, sent by pipeline/push.py)
// and opens the app when it is tapped. No offline caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'KSMeals', {
      body: data.body || 'Xem thực đơn hôm nay của bé',
      icon: `${scope}icon-192.png`,
      badge: `${scope}icon-192.png`,
      tag: data.tag || 'ksmeals-menu', // a newer reminder replaces an unread one
      lang: 'vi',
      data: { url: data.url || scope },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) return open.focus().then(() => open.navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
