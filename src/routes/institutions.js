import { Hono } from 'hono'
import pool from '../db.js'

const institutions = new Hono()

// GET /api/institutions?q=&limit=
institutions.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))

  let where = ''
  const params = []
  if (q) {
    where = 'WHERE sigla LIKE ? OR nome LIKE ?'
    params.push(`%${q}%`, `%${q}%`)
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM instituicao ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT id, sigla, nome,
            (SELECT COUNT(*) FROM participante_instituicao WHERE instituicao_id = instituicao.id) AS participante_count,
            (SELECT COUNT(*) FROM projeto_instituicao WHERE instituicao_id = instituicao.id) AS projeto_count
     FROM instituicao ${where} ORDER BY sigla ASC LIMIT ?`,
    [...params, limit]
  )

  return c.json({ data: rows, total })
})

// POST /api/institutions
institutions.post('/', async (c) => {
  const body = await c.req.json()
  const sigla = body.sigla?.trim()
  if (!sigla) return c.json({ error: 'Sigla é obrigatória' }, 400)
  if (sigla.length > 100) return c.json({ error: 'Sigla muito longa' }, 400)

  const [result] = await pool.query(
    'INSERT INTO instituicao (sigla, nome) VALUES (?, ?)',
    [sigla, body.nome?.trim() || null]
  )
  const [[row]] = await pool.query(
    'SELECT id, sigla, nome FROM instituicao WHERE id = ?',
    [result.insertId]
  )
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

  const [[current]] = await pool.query('SELECT sigla FROM instituicao WHERE id=?', [id])
  if (!current) return c.json({ error: 'Instituição não encontrada' }, 404)

  const [result] = await pool.query(
    'UPDATE instituicao SET sigla=?, nome=? WHERE id=?',
    [sigla, body.nome?.trim() || null, id]
  )
  if (result.affectedRows === 0) return c.json({ error: 'Instituição não encontrada' }, 404)

  if (current.sigla !== sigla) {
    await pool.query('UPDATE participante SET instituicao=? WHERE instituicao=?', [sigla, current.sigla])
    await pool.query('UPDATE projeto SET instituicao=? WHERE instituicao=?', [sigla, current.sigla])
  }

  const [[row]] = await pool.query('SELECT id, sigla, nome FROM instituicao WHERE id=?', [id])
  return c.json({ ...row, oldSigla: current.sigla })
})

// DELETE /api/institutions/:id
institutions.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const [[{ pTotal }]] = await pool.query(
    'SELECT COUNT(*) AS pTotal FROM participante_instituicao WHERE instituicao_id = ?', [id]
  )
  const [[{ prTotal }]] = await pool.query(
    'SELECT COUNT(*) AS prTotal FROM projeto_instituicao WHERE instituicao_id = ?', [id]
  )

  if (pTotal > 0 || prTotal > 0) {
    const parts = []
    if (pTotal > 0) {
      const [rows] = await pool.query(
        'SELECT p.nome FROM participante p JOIN participante_instituicao pi ON pi.participante_id = p.id WHERE pi.instituicao_id = ? ORDER BY p.nome LIMIT 5',
        [id]
      )
      const names = rows.map(r => r.nome).join(', ')
      const extra = pTotal > 5 ? ` e mais ${pTotal - 5}` : ''
      parts.push(`${pTotal} participante(s): ${names}${extra}`)
    }
    if (prTotal > 0) {
      const [rows] = await pool.query(
        'SELECT p.nome FROM projeto p JOIN projeto_instituicao pi ON pi.projeto_id = p.id WHERE pi.instituicao_id = ? ORDER BY p.nome LIMIT 5',
        [id]
      )
      const names = rows.map(r => r.nome).join(', ')
      const extra = prTotal > 5 ? ` e mais ${prTotal - 5}` : ''
      parts.push(`${prTotal} projeto(s): ${names}${extra}`)
    }
    return c.json({ error: `Não é possível excluir: vinculada a ${parts.join(' e ')}.` }, 409)
  }

  const [result] = await pool.query('DELETE FROM instituicao WHERE id = ?', [id])
  if (result.affectedRows === 0) return c.json({ error: 'Instituição não encontrada' }, 404)
  return c.json({ ok: true })
})

export default institutions
