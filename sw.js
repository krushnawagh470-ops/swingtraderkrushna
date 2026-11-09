"use strict";
const CACHE_NAME = "spider-shell-v1";
self.addEventListener("install", event => {
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("spider-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Deliberately do not intercept auth, API, market-data, or navigation requests.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("firebase")) return;
});
