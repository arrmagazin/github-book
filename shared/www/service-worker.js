const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_MS = 30 * DAY_MS;
const CACHED_AT_HEADER = "sw-cached-at";
const CACHE_TTL_HEADER = "sw-cache-ttl";

// Cache name is derived from the deployed `/version` file. When that file
// changes, the cache name changes too, so the old cache is dropped on activate.
let cacheNamePromise;
const getCacheName = () => {
  if (!cacheNamePromise) {
    cacheNamePromise = fetch("/version", { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : "0"))
      .catch(() => "0")
      .then((version) => `cache-v${version.trim()}`);
  }
  return cacheNamePromise;
};

const filters = [
  { ttl: 30 * DAY_MS, match: (url) => url.startsWith("https://fonts.googleapis.com/") },
  { ttl: 365 * DAY_MS, match: (url) => url.startsWith("https://fonts.gstatic.com/") },
  { ttl: 7 * DAY_MS, match: (url) => url.startsWith("https://unpkg.com/l") },
  { ttl: 7 * DAY_MS, match: (url) => url.endsWith("lucide.css") },
  { ttl: DAY_MS, match: (url) => url.startsWith("https://raw.githubusercontent.com/") },
  { ttl: DAY_MS, match: (url) => url.startsWith("https://api.github.com/repos/") },
  {
    ttl: 365 * DAY_MS,
    match: (_url, headers) => headers.has("content-type") && headers.get("content-type").match(/^font\//i),
  },
];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    getCacheName().then((currentCacheName) =>
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            // Delete every 'cache-*' cache except the one matching the current `/version`.
            if (cacheName.startsWith("cache-") && cacheName !== currentCacheName) {
              console.log("Deleting out of date cache:", cacheName);
              return caches.delete(cacheName);
            }
            return undefined;
          })
        )
      )
    )
  );
});

const isExpired = (response) => {
  const cachedAt = Number(response.headers.get(CACHED_AT_HEADER));
  const ttl = Number(response.headers.get(CACHE_TTL_HEADER)) || DEFAULT_TTL_MS;
  return !cachedAt || Date.now() - cachedAt > ttl;
};

const withCacheMeta = async (response, ttl) => {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, Date.now().toString());
  headers.set(CACHE_TTL_HEADER, String(ttl));
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  event.respondWith(
    getCacheName()
      .then((cacheName) => caches.open(cacheName))
      .then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached && !isExpired(cached)) return cached;

        try {
          const response = await fetch(event.request.clone());
          if (response.status !== 200) return cached ?? response;

          const filter = filters.find((fn) => fn.match(url, response.headers));
          if (filter) {
            const stamped = await withCacheMeta(response, filter.ttl ?? DEFAULT_TTL_MS);
            await cache.put(event.request, stamped.clone());
            return stamped;
          }

          return response;
        } catch (error) {
          if (cached) {
            console.warn("Network failed, serving stale cache:", url);
            return cached;
          }
          throw error;
        }
      })
      .catch((error) => {
        console.error("Error in fetch handler:", error);
        throw error;
      })
  );
});
