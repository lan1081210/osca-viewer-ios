// 离线外壳：只缓存静态资源，不碰任何对象数据。
// 网络优先，失败时回落到缓存，避免把旧版页面钉在用户手机上。
const CACHE = "osca-viewer-v1";
const SHELL = ["./index.html", "./s3.js", "./manifest.webmanifest", "./icons/icon-180.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // 只接管本站静态资源；S3 endpoint 的请求一律直连
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
