/* Minimal service worker: enables PWA install + offline shell; APIs stay network-first. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  /* no caching of API routes in pilot */
});
