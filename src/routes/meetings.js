import { Hono } from 'hono'
import pool from '../db.js'

const meetings = new Hono()

const ALLOWED_SORT = ['data_hora', 'tipo', 'participantes', 'projeto']

// GET /api/meetings
meetings.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const sort = ALLOWED_SORT.includes(c.req.query('sort')) ? c.req.query('sort') : 'data_hora'
  const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50)))
  const offset = (page - 1) * limit

  let where = ''
  const params = []
  if (q) {
    where = 'WHERE projeto LIKE ? OR participantes LIKE ?'
    params.push(`%${q}%`, `%${q}%`)
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM reuniao ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT * FROM reuniao ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return c.json({
    data: rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  })
})

// GET /api/meetings/:id
meetings.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [[row]] = await pool.query('SELECT * FROM reuniao WHERE id = ?', [id])
  if (!row) return c.json({ error: 'Reunião não encontrada' }, 404)
  return c.json(row)
})

// POST /api/meetings
meetings.post('/', async (c) => {
  const body = await c.req.json()
  const errors = validate(body)
  if (Object.keys(errors).length > 0) {
    return c.json({ error: 'Validation failed', fields: errors }, 400)
  }
  const { data_hora, tipo, participantes, projeto } = body
  const [result] = await pool.query(
    'INSERT INTO reuniao (data_hora, tipo, participantes, projeto) VALUES (?, ?, ?, ?)',
    [data_hora, tipo, participantes, projeto]
  )
  const [[created]] = await pool.query('SELECT * FROM reuniao WHERE id = ?', [result.insertId])
  return c.json(created, 201)
})

// PUT /api/meetings/:id
meetings.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [[existing]] = await pool.query('SELECT id FROM reuniao WHERE id = ?', [id])
  if (!existing) return c.json({ error: 'Reunião não encontrada' }, 404)

  const body = await c.req.json()
  const errors = validate(body)
  if (Object.keys(errors).length > 0) {
    return c.json({ error: 'Validation failed', fields: errors }, 400)
  }
  const { data_hora, tipo, participantes, projeto } = body
  await pool.query(
    'UPDATE reuniao SET data_hora = ?, tipo = ?, participantes = ?, projeto = ? WHERE id = ?',
    [data_hora, tipo, participantes, projeto, id]
  )
  const [[updated]] = await pool.query('SELECT * FROM reuniao WHERE id = ?', [id])
  return c.json(updated)
})

function validate(body) {
  const errors = {}
  if (!body.data_hora) errors.data_hora = 'Obrigatório'
  else if (isNaN(Date.parse(body.data_hora))) errors.data_hora = 'Data inválida'
  if (!body.tipo || !['Presencial', 'Remota'].includes(body.tipo)) errors.tipo = 'Deve ser Presencial ou Remota'
  if (!body.participantes?.trim()) errors.participantes = 'Obrigatório'
  if (!body.projeto?.trim()) errors.projeto = 'Obrigatório'
  else if (body.projeto.length > 255) errors.projeto = 'Máximo 255 caracteres'
  return errors
}

export default meetings
