/* Bán Hàng — cho phép mở app khi không có mạng.
   Đặt file này CÙNG THƯ MỤC với index.html trên GitHub Pages.
   - Trang app: lấy bản mới trên mạng trước (cập nhật ngay khi bạn đưa index.html mới lên);
     mạng chậm quá 4 giây hoặc mất mạng => mở bản đã lưu trên máy.
   - Thư viện React, phông chữ: dùng bản đã lưu (nhanh), tự cập nhật ngầm.
   - Dữ liệu Google Sheet (Apps Script): không đụng tới — luôn gửi / nhận trực tiếp. */
const CACHE = 'banhang-v1';
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    ['./', './index.html'].concat(LIBS).map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (ms, p) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); no(err); }); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // ghi dữ liệu (POST) => để nguyên
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return; // dữ liệu Sheet => để nguyên

  // Trang app (index.html, demo.html…): mạng trước, mất mạng => bản đã lưu
  if (req.mode === 'navigate') {
    const key = url.origin + url.pathname;
    e.respondWith(
      // cache: 'no-cache' => luôn hỏi máy chủ có bản mới chưa (không đổi thì máy chủ trả rất nhanh)
      timeout(4000, fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      }).catch(() => caches.match(key).then(r => r || caches.match('./index.html')).then(r => r || caches.match('./')))
        .then(r => r || new Response('<meta charset="utf-8"><p style="font:16px sans-serif;padding:24px">Không có mạng và chưa có bản lưu trên máy. Hãy mở app 1 lần khi có mạng.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    );
    return;
  }

  // Thư viện + phông chữ: dùng bản đã lưu, đồng thời cập nhật ngầm
  if (/cdnjs\.cloudflare\.com$|fonts\.googleapis\.com$|fonts\.gstatic\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
