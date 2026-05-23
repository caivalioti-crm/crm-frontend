self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'CRM Alert';
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url ?? '/' },
    actions: [
      { action: 'snooze2h', title: '⏰ Snooze 2 ώρες' },
      { action: 'open', title: '📋 Άνοιγμα' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'snooze2h') {
    const snoozeUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    event.waitUntil(
      fetch('/api/push/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snooze_until: snoozeUntil }),
      })
    );
    return;
  }
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});