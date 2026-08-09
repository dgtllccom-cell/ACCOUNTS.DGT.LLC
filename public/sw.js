const CACHE_NAME = "digital-dock-erp-v3";
const ASSETS_TO_CACHE = [
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
          // Delete all old cache stores and any cached HTML pages
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

  // NEVER cache API routes, Auth routes, Webpack HMR, or HTML navigation documents
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") && event.request.headers.get("accept").includes("text/html"))
  ) {
    return;
  }

  // Network-First for Next.js static JS chunks
  if (url.pathname.includes("/_next/static/")) {
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
      return caches.match(event.request);
    })
  );
});
