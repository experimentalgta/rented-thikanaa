// ========================================================================
// Renter Thikan PWA - Web Push Notification & Action Handler (Service Worker)
// ========================================================================

/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'New message on Renter Thikan',
      body: event.data.text() || 'You have received a new message.',
    };
  }

  const title = payload.title || 'New message on Renter Thikan';
  const options = {
    body: payload.body || 'You have received a new message.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/favicon-32x32.png',
    tag: payload.tag || (payload.data?.conversationId ? `msg-${payload.data.conversationId}` : 'renter-thikan-msg'),
    data: payload.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: false,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId;
  const targetUrl = conversationId
    ? `/?view=messages&conv=${encodeURIComponent(conversationId)}`
    : '/?view=messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing app window is open, focus it and post navigation event
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          } else {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId: conversationId,
            });
          }
          return;
        }
      }
      // 2. If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push subscription changes from push service (e.g. rotation)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((newSubscription) => {
        // Broadcast new subscription to active clients to re-sync
        return clients.matchAll({ type: 'window' }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: JSON.stringify(newSubscription),
            });
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] pushsubscriptionchange failed:', err);
      })
  );
});
