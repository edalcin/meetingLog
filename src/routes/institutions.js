import { Hono } from 'hono'
import db from '../db.js'

const institutions = new Hono()

// GET /api/institutions?q=&limit=
institutions.get('/', (c) => {
  const q = c.req.query('q') ?? ''
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))

  let where = ''
  const params = []
  if (q) {
    where = 'WHERE sigla LIKE ? OR nome LIKE ?'
    params.push(`%${q}%`, `%${q}%`)
  }

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM instituicao ${where}`).get(...params)

  const rows = db.prepare(
    `SELECT id, sigla, nome,
            (SELECT COUNT(*) FROM participante WHERE instituicao = instituicao.sigla) AS participante_count,
            (SELECT COUNT(*) FROM projeto_instituicao WHERE instituicao_id = instituicao.id) AS projeto_count
     FROM instituicao ${where} ORDER BY sigla ASC LIMIT ?`
  ).all(...params, limit)

  return c.json({ data: rows, total })
})

// GET /api/institutions/:id
institutions.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const row = db.prepare('SELECT id, sigla, nome FROM instituicao WHERE id = ?').get(id)
  if (!row) return c.json({ error: 'Instituição não encontrada' }, 404)

  const participantes = db.prepare(
    'SELECT id, nome, lotacao, cargo, ativo FROM participante WHERE instituicao = ? ORDER BY nome ASC'
  ).all(row.sigla)
  const projetos = db.prepare(
    `SELECT p.id, p.nome, p.ativo FROM projeto p
     JOIN projeto_instituicao pi ON pi.projeto_id = p.id
     WHERE pi.instituicao_id = ? ORDER BY p.nome ASC`
  ).all(id)

  return c.json({ ...row, participantes, projetos })
})

// POST /api/institutions
institutions.post('/', async (c) => {
  const body = await c.req.json()
  const sigla = body.sigla?.trim()
  if (!sigla) return c.json({ error: 'Sigla é obrigatória' }, 400)
  if (sigla.length > 100) return c.json({ error: 'Sigla muito longa' }, 400)

  const result = db.prepare(
    'INSERT INTO instituicao (sigla, nome) VALUES (?, ?)'
  ).run(sigla, body.nome?.trim() || null)
  const row = db.prepare(
    'SELECT id, sigla, nome FROM instituicao WHERE id = ?'
  ).get(Number(result.lastInsertRowid))
  return c.json(row, 201)
})

// PUT /api/institutions/:id
institutions.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const body = await c.req.json()
  const sigla = body.sigla?.trim()
  if (!sigla) return c.json({ error: 'Sigla é obrigatória' }, 400)
  if (sigla.length > 100) return c.json({ error: 'Sigla muito longa' }, 400)

  const current = db.prepare('SELECT sigla FROM instituicao WHERE id=?').get(id)
  if (!current) return c.json({ error: 'Instituição não encontrada' }, 404)

  const result = db.prepare(
    'UPDATE instituicao SET sigla=?, nome=? WHERE id=?'
  ).run(sigla, body.nome?.trim() || null, id)
  if (result.changes === 0) return c.json({ error: 'Instituição não encontrada' }, 404)

  if (current.sigla !== sigla) {
    db.prepare('UPDATE participante SET instituicao=? WHERE instituicao=?').run(sigla, current.sigla)
  }

  const row = db.prepare('SELECT id, sigla, nome FROM instituicao WHERE id=?').get(id)
  return c.json({ ...row, oldSigla: current.sigla })
})

// DELETE /api/institutions/:id
institutions.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const current = db.prepare('SELECT sigla FROM instituicao WHERE id=?').get(id)
  if (!current) return c.json({ error: 'Instituição não encontrada' }, 404)

  const { pTotal } = db.prepare(
    'SELECT COUNT(*) AS pTotal FROM participante WHERE instituicao = ?'
  ).get(current.sigla)
  const { prTotal } = db.prepare(
    'SELECT COUNT(*) AS prTotal FROM projeto_instituicao WHERE instituicao_id = ?'
  ).get(id)

  if (pTotal > 0 || prTotal > 0) {
    const parts = []
    if (pTotal > 0) {
      const rows = db.prepare(
        'SELECT nome FROM participante WHERE instituicao = ? ORDER BY nome LIMIT 5'
      ).all(current.sigla)
      const names = rows.map(r => r.nome).join(', ')
      const extra = pTotal > 5 ? ` e mais ${pTotal - 5}` : ''
      parts.push(`${pTotal} participante(s): ${names}${extra}`)
    }
    if (prTotal > 0) {
      const rows = db.prepare(
        'SELECT p.nome FROM projeto p JOIN projeto_instituicao pi ON pi.projeto_id = p.id WHERE pi.instituicao_id = ? ORDER BY p.nome LIMIT 5'
      ).all(id)
      const names = rows.map(r => r.nome).join(', ')
      const extra = prTotal > 5 ? ` e mais ${prTotal - 5}` : ''
      parts.push(`${prTotal} projeto(s): ${names}${extra}`)
    }
    return c.json({ error: `Não é possível excluir: vinculada a ${parts.join(' e ')}.` }, 409)
  }

  const result = db.prepare('DELETE FROM instituicao WHERE id = ?').run(id)
  if (result.changes === 0) return c.json({ error: 'Instituição não encontrada' }, 404)
  return c.json({ ok: true })
})

export default institutions
