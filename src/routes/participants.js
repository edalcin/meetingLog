import { Hono } from 'hono'
import pool from '../db.js'

const participants = new Hono()

// GET /api/participants?q=&limit=&ativo=
participants.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))
  const ativo = c.req.query('ativo')

  const conditions = []
  const params = []
  if (q) {
    conditions.push('(nome LIKE ? OR instituicao LIKE ? OR lotacao LIKE ? OR notas LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (ativo === '1') {
    conditions.push('ativo = TRUE')
  } else if (ativo === '0') {
    conditions.push('ativo = FALSE')
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM participante ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas,
            (SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = participante.id) AS reuniao_count
     FROM participante ${where} ORDER BY nome ASC LIMIT ?`,
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

  const ativo = body.ativo !== false

  const [result] = await pool.query(
    'INSERT INTO participante (nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      nome,
      body.instituicao?.trim() || null,
      body.lotacao?.trim() || null,
      body.cargo?.trim() || null,
      body.email?.trim() || null,
      ativo,
      ativo,  // ativo_manual mirrors explicit user intent at creation
      body.notas || null
    ]
  )
  const [[row]] = await pool.query(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id = ?',
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

  const ativo = body.ativo !== false

  const [result] = await pool.query(
    'UPDATE participante SET nome=?, instituicao=?, lotacao=?, cargo=?, email=?, ativo=?, ativo_manual=?, notas=? WHERE id=?',
    [
      nome,
      body.instituicao?.trim() || null,
      body.lotacao?.trim() || null,
      body.cargo?.trim() || null,
      body.email?.trim() || null,
      ativo,
      ativo,  // ativo_manual mirrors explicit user intent: protects manual reactivations from cascade
      body.notas || null,
      id
    ]
  )
  if (result.affectedRows === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  const [[row]] = await pool.query(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id=?', [id]
  )
  return c.json(row)
})

// GET /api/participants/:id
participants.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const [[row]] = await pool.query(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id = ?',
    [id]
  )
  if (!row) return c.json({ error: 'Participante não encontrado' }, 404)

  const [reunioes] = await pool.query(
    `SELECT r.id, r.data_hora,
            COALESCE(GROUP_CONCAT(DISTINCT p.nome ORDER BY p.nome SEPARATOR ', '), '') AS projeto_nomes
     FROM reuniao_participante rp
     JOIN reuniao r ON r.id = rp.reuniao_id
     LEFT JOIN reuniao_projeto rpj ON rpj.reuniao_id = r.id
     LEFT JOIN projeto p ON p.id = rpj.projeto_id
     WHERE rp.participante_id = ?
     GROUP BY r.id, r.data_hora
     ORDER BY r.data_hora DESC`,
    [id]
  )

  const [projetos] = await pool.query(
    `SELECT DISTINCT p.id, p.nome
     FROM reuniao_participante rp
     JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
     JOIN projeto p ON p.id = rpj.projeto_id
     WHERE rp.participante_id = ?
     ORDER BY p.nome`,
    [id]
  )

  return c.json({ ...row, ativo: Boolean(row.ativo), projetos, reunioes })
})

// DELETE /api/participants/:id
participants.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM reuniao_participante WHERE participante_id = ?', [id]
  )

  if (total > 0) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(r.data_hora, '%d/%m/%Y') AS data FROM reuniao r
       JOIN reuniao_participante rp ON rp.reuniao_id = r.id
       WHERE rp.participante_id = ? ORDER BY r.data_hora LIMIT 5`,
      [id]
    )
    const dates = rows.map(r => r.data).join(', ')
    const extra = total > 5 ? ` e mais ${total - 5}` : ''
    return c.json({ error: `Não é possível excluir: participante vinculado a ${total} reunião(ões) (${dates}${extra}).` }, 409)
  }

  const [result] = await pool.query('DELETE FROM participante WHERE id = ?', [id])
  if (result.affectedRows === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  return c.json({ ok: true })
})

export default participants
