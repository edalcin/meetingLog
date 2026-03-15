import { Hono } from 'hono'
import pool from '../db.js'

const participants = new Hono()

// GET /api/participants?q=&limit=
participants.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))

  let where = ''
  const params = []
  if (q) {
    where = 'WHERE nome LIKE ? OR instituicao LIKE ?'
    params.push(`%${q}%`, `%${q}%`)
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM participante ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, nome, instituicao, cargo, email FROM participante ${where} ORDER BY nome ASC LIMIT ?`,
    [...params, limit]
  )

  return c.json({ data: rows, total })
})

export default participants
