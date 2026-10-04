// Clean no-op service worker to unregister any stale service workers and prevent MIME type errors
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      // no reload needed
    })
  );
});
