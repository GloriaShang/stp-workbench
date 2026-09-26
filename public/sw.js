// 离线缓存：安装成应用后，没网也能打开。
// 页面本身：优先联网拿最新版，失败时用缓存；带 hash 的静态资源：缓存优先。
const CACHE = 'stp-workbench-v4'

// 安装时就把页面和它引用的脚本、样式、图标存好。
// 第一次打开时页面还没被接管，下面的 fetch 拦截不到，不预存的话第一次离线打开会是空白页。
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const res = await fetch('./', { cache: 'reload' })
      const html = await res.clone().text()
      await cache.put('./', res)
      const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])
      await cache.addAll([...new Set([...refs, './icon-lavender-192.png', './icon-lavender-512.png'])])
      await self.skipWaiting()
    })(),
  )
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
