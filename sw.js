const CACHE_NAME = 'taskvaani-pwa-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
  scheduleNext1030Alarm();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});

// Background 10:30 AM Statutory Compliance Alarm Scheduler
// Reruns even when the app tab is inactive/backgrounded
function scheduleNext1030Alarm() {
  try {
    const now = new Date();
    const nextAlarm = new Date();
    nextAlarm.setHours(10, 30, 0, 0);
    if (now.getTime() >= nextAlarm.getTime()) {
      nextAlarm.setDate(nextAlarm.getDate() + 1);
    }
    const delay = Math.max(1000, nextAlarm.getTime() - now.getTime());
    setTimeout(() => {
      if (self.registration && self.registration.showNotification) {
        self.registration.showNotification('⏰ 10:30 AM Statutory Deadline Reminder', {
          body: "Daily Compliance Alert: Statutory due dates & priority client tasks require attention today.",
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          vibrate: [300, 100, 300, 100, 300],
          tag: 'statutory-1030-alarm',
          requireInteraction: true,
          data: { url: '/' }
        });
      }
      scheduleNext1030Alarm();
    }, delay);
  } catch (err) {
    console.warn('SW Alarm scheduling error:', err);
  }
}

// When user clicks the background notification, open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
