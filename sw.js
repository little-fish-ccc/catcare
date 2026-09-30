/* 猫猫工作台 Service Worker
   策略：
   - 应用外壳（同源 html/js/css/图标）：stale-while-revalidate —— 先给缓存秒开，后台静默更新，
     下次打开即新版。既离线可用，又不必手动硬刷。
   - 跨域 CDN（pdf.js / tesseract）：不缓存，避免大文件占空间；离线时这些功能自然不可用，
     但核心记录功能（本地存储）完全可用。
   - 带 ?v= 版本号的资源：按 URL 独立缓存，版本号一变即自动取新版，无需清缓存。 */
const CACHE = 'catcare-v3';
const CORE = [
  './',
  './index.html',
  './style.css',
  './js/core.js',
  './js/schemas.js',
  './js/pages.js',
  './js/stats.js',
  './js/main.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 跨域（CDN 等）：直接走网络，不缓存
  if (url.origin !== self.location.origin) return;

  // 同源：stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
