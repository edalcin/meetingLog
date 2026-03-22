import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import filesRouter from './routes/files.js'
import meetingsRouter from './routes/meetings.js'
import participantsRouter from './routes/participants.js'
import projectsRouter from './routes/projects.js'
import institutionsRouter from './routes/institutions.js'
import pool from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Bootstrap uploads directory
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

// Health check
app.get('/api/health', async (c) => {
  try {
    await pool.query('SELECT 1')
    return c.json({ status: 'ok', db: 'connected' })
  } catch {
    return c.json({ status: 'error', db: 'disconnected' }, 503)
  }
})

// PIN auth check
app.post('/api/auth/check', async (c) => {
  const { pin } = await c.req.json()
  const ok = pin === process.env.APP_PIN
  return c.json({ ok })
})

// Files API (handles /api/meetings/:id/files and /api/files/:id/*)
app.route('/api', filesRouter)

// Meetings API
app.route('/api/meetings', meetingsRouter)

// Participants API
app.route('/api/participants', participantsRouter)

// Projects API
app.route('/api/projects', projectsRouter)

// Institutions API
app.route('/api/institutions', institutionsRouter)

// Serve static files
app.use('/*', serveStatic({ root: './public' }))

// Fallback to index.html for SPA
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
  server.close(async () => {
    await pool.end()
    console.log('[server] Shutdown complete.')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
