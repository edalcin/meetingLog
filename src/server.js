import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { timingSafeEqual } from 'node:crypto'
import filesRouter from './routes/files.js'
import meetingsRouter from './routes/meetings.js'
import participantsRouter from './routes/participants.js'
import projectsRouter from './routes/projects.js'
import institutionsRouter from './routes/institutions.js'
import maintenanceRouter from './routes/maintenance.js'
import dashboardRouter from './routes/dashboard.js'
import db from './db.js'

// Rate limiting state for PIN auth (in-memory, resets on restart — acceptable for single-user)
const authAttempts = new Map()
const AUTH_MAX = 5
const AUTH_LOCK_MS = 15 * 60 * 1000

const __dirname = dirname(fileURLToPath(import.meta.url))

const FILES_PATH = process.env.FILES_PATH
if (FILES_PATH) {
  try {
    mkdirSync(join(FILES_PATH, 'thumbnails'), { recursive: true })
  } catch (err) {
    console.warn('[server] Could not create thumbnails directory:', err.message)
  }
} else {
  console.warn('[server] WARNING: FILES_PATH is not set. File attachments will not work.')
}

const app = new Hono()

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  // SAMEORIGIN for file content so same-origin <iframe> PDF viewer works
  const isFileContent = /^\/api\/files\/\d+\/content$/.test(c.req.path)
  c.header('X-Frame-Options', isFileContent ? 'SAMEORIGIN' : 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "font-src 'self' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    isFileContent ? "frame-ancestors 'self'" : "frame-ancestors 'none'"
  ].join('; '))
})

app.get('/api/health', (c) => {
  try {
    db.prepare('SELECT 1').get()
    return c.json({ status: 'ok', db: 'connected' })
  } catch {
    return c.json({ status: 'error', db: 'disconnected' }, 503)
  }
})

app.post('/api/auth/check', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
           ?? c.env?.incoming?.socket?.remoteAddress
           ?? 'unknown'
  const now = Date.now()
  const rec = authAttempts.get(ip) ?? { count: 0, lockedUntil: 0 }

  if (rec.lockedUntil > now) {
    return c.json({ ok: false }, 429)
  }

  const { pin } = await c.req.json()
  const pinBuf = Buffer.from(String(pin ?? ''))
  const appBuf = Buffer.from(String(process.env.APP_PIN ?? ''))
  const ok = pinBuf.length === appBuf.length && timingSafeEqual(pinBuf, appBuf)

  if (!ok) {
    rec.count++
    if (rec.count >= AUTH_MAX) rec.lockedUntil = now + AUTH_LOCK_MS
    authAttempts.set(ip, rec)
  } else {
    authAttempts.delete(ip)
  }

  return c.json({ ok })
})

app.route('/api', filesRouter)
app.route('/api/meetings', meetingsRouter)
app.route('/api/participants', participantsRouter)
app.route('/api/projects', projectsRouter)
app.route('/api/institutions', institutionsRouter)
app.route('/api/maintenance', maintenanceRouter)
app.route('/api/dashboard', dashboardRouter)

app.use('/*', serveStatic({ root: './public' }))

app.get('*', (c) => {
  const html = readFileSync(join(__dirname, '../public/index.html'), 'utf8')
  return c.html(html)
})

const port = Number(process.env.APP_PORT ?? 3000)
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[server] Meeting Log running at http://localhost:${port}`)
})

function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down...`)
  server.closeAllConnections()
  server.close(() => {
    db.close()
    console.log('[server] Shutdown complete.')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
