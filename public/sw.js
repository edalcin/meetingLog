// Minimal service worker — PWA install support only
// No caching strategy needed for this application

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
