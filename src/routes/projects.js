import { Hono } from 'hono'
import pool from '../db.js'

const projects = new Hono()

// GET /api/projects?q=&activeOnly=&limit=
projects.get('/', async (c) => {
  const q          = c.req.query('q') ?? ''
  const activeOnly = c.req.query('activeOnly') === 'true'
  const limit      = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))

  const conditions = []
  const params = []

  if (q) {
    conditions.push('(nome LIKE ? OR instituicao LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }

  if (activeOnly) {
    conditions.push('ativo = 1')
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM projeto ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, nome, ativo, instituicao FROM projeto ${where} ORDER BY nome ASC LIMIT ?`,
    [...params, limit]
  )

  const data = rows.map(r => ({ ...r, ativo: Boolean(r.ativo) }))

  return c.json({ data, total })
})

// PUT /api/projects/:id
projects.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const body = await c.req.json()
  const nome = body.nome?.trim()
  if (!nome) return c.json({ error: 'Nome é obrigatório' }, 400)
  if (nome.length > 255) return c.json({ error: 'Nome muito longo' }, 400)
  const ativo = body.ativo === true || body.ativo === 1 ? 1 : 0
  const [result] = await pool.query(
    'UPDATE projeto SET nome=?, ativo=?, instituicao=? WHERE id=?',
    [nome, ativo, body.instituicao?.trim() || null, id]
  )
  if (result.affectedRows === 0) return c.json({ error: 'Projeto não encontrado' }, 404)
  const [[row]] = await pool.query(
    'SELECT id, nome, ativo, instituicao FROM projeto WHERE id=?', [id]
  )
  return c.json({ ...row, ativo: Boolean(row.ativo) })
})

// DELETE /api/projects/:id
projects.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM reuniao_projeto WHERE projeto_id = ?', [id]
  )

  if (total > 0) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(r.data_hora, '%d/%m/%Y') AS data FROM reuniao r
       JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
       WHERE rp.projeto_id = ? ORDER BY r.data_hora LIMIT 5`,
      [id]
    )
    const dates = rows.map(r => r.data).join(', ')
    const extra = total > 5 ? ` e mais ${total - 5}` : ''
    return c.json({ error: `Não é possível excluir: projeto vinculado a ${total} reunião(ões) (${dates}${extra}).` }, 409)
  }

  const [result] = await pool.query('DELETE FROM projeto WHERE id = ?', [id])
  if (result.affectedRows === 0) return c.json({ error: 'Projeto não encontrado' }, 404)
  return c.json({ ok: true })
})

export default projects
