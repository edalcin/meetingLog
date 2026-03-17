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

// POST /api/participants
participants.post('/', async (c) => {
  const body = await c.req.json()
  const nome = body.nome?.trim()
  if (!nome) return c.json({ error: 'Nome é obrigatório' }, 400)
  if (nome.length > 255) return c.json({ error: 'Nome muito longo' }, 400)

  const [result] = await pool.query(
    'INSERT INTO participante (nome, instituicao, cargo, email) VALUES (?, ?, ?, ?)',
    [nome, body.instituicao?.trim() || null, body.cargo?.trim() || null, body.email?.trim() || null]
  )
  const [[row]] = await pool.query(
    'SELECT id, nome, instituicao, cargo, email FROM participante WHERE id = ?',
    [result.insertId]
  )
  return c.json(row, 201)
})

// PUT /api/participants/:id
participants.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const body = await c.req.json()
  const nome = body.nome?.trim()
  if (!nome) return c.json({ error: 'Nome é obrigatório' }, 400)
  if (nome.length > 255) return c.json({ error: 'Nome muito longo' }, 400)
  const [result] = await pool.query(
    'UPDATE participante SET nome=?, instituicao=?, cargo=?, email=? WHERE id=?',
    [nome, body.instituicao?.trim() || null, body.cargo?.trim() || null, body.email?.trim() || null, id]
  )
  if (result.affectedRows === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  const [[row]] = await pool.query(
    'SELECT id, nome, instituicao, cargo, email FROM participante WHERE id=?', [id]
  )
  return c.json(row)
})

// DELETE /api/participants/:id
participants.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const [result] = await pool.query('DELETE FROM participante WHERE id = ?', [id])
  if (result.affectedRows === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  return c.json({ ok: true })
})

export default participants
