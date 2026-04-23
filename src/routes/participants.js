import { Hono } from 'hono'
import db from '../db.js'

const participants = new Hono()

// GET /api/participants?q=&limit=&ativo=
participants.get('/', (c) => {
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
    conditions.push('ativo = 1')
  } else if (ativo === '0') {
    conditions.push('ativo = 0')
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM participante ${where}`).get(...params)

  const rows = db.prepare(
    `SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas,
            (SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = participante.id) AS reuniao_count
     FROM participante ${where} ORDER BY nome ASC LIMIT ?`
  ).all(...params, limit)

  return c.json({ data: rows, total })
})

// POST /api/participants
participants.post('/', async (c) => {
  const body = await c.req.json()
  const nome = body.nome?.trim()
  if (!nome) return c.json({ error: 'Nome é obrigatório' }, 400)
  if (nome.length > 255) return c.json({ error: 'Nome muito longo' }, 400)

  const ativo = body.ativo !== false ? 1 : 0

  const result = db.prepare(
    'INSERT INTO participante (nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    nome,
    body.instituicao?.trim() || null,
    body.lotacao?.trim() || null,
    body.cargo?.trim() || null,
    body.email?.trim() || null,
    ativo,
    ativo,
    body.notas || null
  )
  const row = db.prepare(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id = ?'
  ).get(Number(result.lastInsertRowid))
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

  const ativo = body.ativo !== false ? 1 : 0

  const result = db.prepare(
    'UPDATE participante SET nome=?, instituicao=?, lotacao=?, cargo=?, email=?, ativo=?, ativo_manual=?, notas=? WHERE id=?'
  ).run(
    nome,
    body.instituicao?.trim() || null,
    body.lotacao?.trim() || null,
    body.cargo?.trim() || null,
    body.email?.trim() || null,
    ativo,
    ativo,
    body.notas || null,
    id
  )
  if (result.changes === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  const row = db.prepare(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id=?'
  ).get(id)
  return c.json(row)
})

// GET /api/participants/:id
participants.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const row = db.prepare(
    'SELECT id, nome, instituicao, lotacao, cargo, email, ativo, notas FROM participante WHERE id = ?'
  ).get(id)
  if (!row) return c.json({ error: 'Participante não encontrado' }, 404)

  const reunioes = db.prepare(
    `SELECT r.id, r.data_hora,
            COALESCE((SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT DISTINCT p2.nome FROM projeto p2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = p2.id WHERE rpj2.reuniao_id = r.id ORDER BY p2.nome)), '') AS projeto_nomes
     FROM reuniao_participante rp
     JOIN reuniao r ON r.id = rp.reuniao_id
     WHERE rp.participante_id = ?
     ORDER BY r.data_hora DESC`
  ).all(id)

  const projetos = db.prepare(
    `SELECT DISTINCT p.id, p.nome
     FROM reuniao_participante rp
     JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
     JOIN projeto p ON p.id = rpj.projeto_id
     WHERE rp.participante_id = ?
     ORDER BY p.nome`
  ).all(id)

  return c.json({ ...row, ativo: Boolean(row.ativo), projetos, reunioes })
})

// DELETE /api/participants/:id
participants.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const { total } = db.prepare(
    'SELECT COUNT(*) AS total FROM reuniao_participante WHERE participante_id = ?'
  ).get(id)

  if (total > 0) {
    const rows = db.prepare(
      `SELECT strftime('%d/%m/%Y', r.data_hora) AS data FROM reuniao r
       JOIN reuniao_participante rp ON rp.reuniao_id = r.id
       WHERE rp.participante_id = ? ORDER BY r.data_hora LIMIT 5`
    ).all(id)
    const dates = rows.map(r => r.data).join(', ')
    const extra = total > 5 ? ` e mais ${total - 5}` : ''
    return c.json({ error: `Não é possível excluir: participante vinculado a ${total} reunião(ões) (${dates}${extra}).` }, 409)
  }

  const result = db.prepare('DELETE FROM participante WHERE id = ?').run(id)
  if (result.changes === 0) return c.json({ error: 'Participante não encontrado' }, 404)
  return c.json({ ok: true })
})

export default participants
