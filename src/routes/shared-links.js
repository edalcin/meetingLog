import { Hono } from 'hono'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import db from '../db.js'

const router = new Hono()

function checkPin(c) {
  const pin = c.req.header('x-app-pin') ?? ''
  const pinBuf = Buffer.from(pin)
  const appBuf = Buffer.from(String(process.env.APP_PIN ?? ''))
  if (pinBuf.length === 0 || pinBuf.length !== appBuf.length) return false
  return timingSafeEqual(pinBuf, appBuf)
}

function buildUrl(token) {
  const base = (process.env.BASE_URL ?? '').replace(/\/$/, '')
  return `${base}/p/${token}`
}

router.get('/', (c) => {
  if (!checkPin(c)) return c.json({ error: 'Unauthorized' }, 401)

  const rows = db.prepare(
    `SELECT id, token, filter_type, filter_value, descricao, criado_em, revogado
     FROM link_publico ORDER BY criado_em DESC`
  ).all()

  return c.json(rows.map(r => ({ ...r, url: buildUrl(r.token) })))
})

router.post('/', async (c) => {
  if (!checkPin(c)) return c.json({ error: 'Unauthorized' }, 401)

  const { filter_type = 'all', filter_value = '', descricao = '' } = await c.req.json()
  const token = randomBytes(20).toString('hex')

  const { lastInsertRowid } = db.prepare(
    `INSERT INTO link_publico (token, filter_type, filter_value, descricao)
     VALUES (?, ?, ?, ?)`
  ).run(token, filter_type, String(filter_value), descricao)

  return c.json({ id: Number(lastInsertRowid), token, url: buildUrl(token) }, 201)
})

router.delete('/:id', (c) => {
  if (!checkPin(c)) return c.json({ error: 'Unauthorized' }, 401)

  const id = Number(c.req.param('id'))
  db.prepare('UPDATE link_publico SET revogado = 1 WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default router
