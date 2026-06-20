const CACHE = 'meetinglog-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Only handle GET requests from same origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Network-only for API calls
  if (url.pathname.startsWith('/api/')) return

  // Network-first with shell fallback for navigation requests
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put('/', clone))
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Stale-while-revalidate for static assets (icons, assets, css, js, manifest, favicons)
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const network = fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }).catch(() => cached)
        return cached || network
      })
    )
  )
})
