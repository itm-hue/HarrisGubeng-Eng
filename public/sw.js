// Progressive Web App Service Worker for Web Push Notifications
// Hotel Harris Gubeng Task Manager

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen to Push Notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Hotel Harris Gubeng',
    body: 'Ada pembaruan Tugas Work Order!',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'harris-wo-notification',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = {
        ...payload,
        ...data,
        data: data.data || { url: '/' }
      };
    } catch (e) {
      // Fallback if data is not JSON or is simple text
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    tag: payload.tag || 'harris-wo-notification',
    vibrate: [200, 100, 200],
    data: payload.data,
    actions: payload.actions || [
      { action: 'open', title: 'Buka WO Aplikasi' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
