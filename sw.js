/* =====================================================================
   SERVICE WORKER  —  lets the app open with no signal.
   A service worker is a small script the browser keeps running in the
   background for this site. It sees every file the app asks for.

   Here it always tries the internet first (so your latest changes still
   arrive), saves a copy of each app file, and only uses that copy when
   there's no signal. Your customers are already saved on the phone
   (localStorage), so with the files cached too, the whole app works offline.

   Database calls (Supabase) are left alone: they go straight to the internet.
   ===================================================================== */

const CACHE = "client-tracker-files";
const WAIT_FOR_INTERNET = 4000;   // ms to wait on a weak signal before using the saved copy

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  const isAppFile = url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net";
  if (request.method !== "GET" || !isAppFile) return;
  event.respondWith(internetFirst(request));
});

async function internetFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), WAIT_FOR_INTERNET);
    // "opaque" = a file from another site (the Supabase library); fine to save as it is.
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
  } catch (e) {
    const saved = await cache.match(request, { ignoreSearch: true })
               || (request.mode === "navigate" && await cache.match("./"));
    return saved || fetch(request);   // nothing saved yet: keep trying the internet
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(resolve, reject);
  });
}
