const CACHE_NAME = "digital-dock-erp-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/digital-dock-icon.svg",
  "/icons/digital-dock-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Skip API routes, auth routes, server actions, and dev HMR
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/_next/webpack-hmr")) return;

  // For JS chunk files (_next/static/chunks/), fetch network-first.
  // DO NOT fall back to '/' (index HTML) because HTML causes SyntaxError / ChunkLoadError in JS script tags.
  if (url.pathname.includes("/_next/static/chunks/")) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        return caches.match(event.request).then((res) => {
          if (res) return res;
          throw err;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        return response || caches.match("/");
      });
    })
  );
});

