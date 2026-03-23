import { Hono } from 'hono'
import pool from '../db.js'

const projects = new Hono()

function parseRow(r) {
  const { instituicao_ids_str, ...rest } = r
  return {
    ...rest,
    ativo: Boolean(r.ativo),
    instituicao_ids: instituicao_ids_str ? instituicao_ids_str.split(',').map(Number) : [],
  }
}

// SELECT com JOINs para um único projeto (usado após INSERT/UPDATE)
async function fetchProjectById(conn, id) {
  const [[row]] = await conn.query(
    `SELECT p.id, p.nome, p.ativo,
            COALESCE(GROUP_CONCAT(DISTINCT i.sigla ORDER BY i.sigla SEPARATOR ', '), '') AS instituicao_nomes,
            COALESCE(GROUP_CONCAT(DISTINCT i.id    ORDER BY i.sigla SEPARATOR ','),     '') AS instituicao_ids_str
     FROM projeto p
     LEFT JOIN projeto_instituicao pi ON pi.projeto_id = p.id
     LEFT JOIN instituicao i ON i.id = pi.instituicao_id
     WHERE p.id = ?
     GROUP BY p.id`,
    [id]
  )
  return row ? parseRow(row) : null
}

// GET /api/projects?q=&activeOnly=&limit=
projects.get('/', async (c) => {
  const q          = c.req.query('q') ?? ''
  const activeOnly = c.req.query('activeOnly') === 'true'
  const limit      = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 200)))

  const conditions = []
  const params = []

  if (q) {
    conditions.push(`(p.nome LIKE ? OR EXISTS (
      SELECT 1 FROM projeto_instituicao pi2
      JOIN instituicao i2 ON i2.id = pi2.instituicao_id
      WHERE pi2.projeto_id = p.id AND (i2.sigla LIKE ? OR i2.nome LIKE ?)
    ))`)
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (activeOnly) {
    conditions.push('p.ativo = 1')
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM projeto p ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT p.id, p.nome, p.ativo,
            COALESCE(GROUP_CONCAT(DISTINCT i.sigla ORDER BY i.sigla SEPARATOR ', '), '') AS instituicao_nomes,
            COALESCE(GROUP_CONCAT(DISTINCT i.id    ORDER BY i.sigla SEPARATOR ','),     '') AS instituicao_ids_str,
            (SELECT COUNT(*) FROM reuniao_projeto WHERE projeto_id = p.id) AS reuniao_count
     FROM projeto p
     LEFT JOIN projeto_instituicao pi ON pi.projeto_id = p.id
     LEFT JOIN instituicao i ON i.id = pi.instituicao_id
     ${where}
     GROUP BY p.id
     ORDER BY p.nome ASC
     LIMIT ?`,
    [...params, limit]
  )

  return c.json({ data: rows.map(parseRow), total })
})

// POST /api/projects
projects.post('/', async (c) => {
  const body = await c.req.json()
  const nome = body.nome?.trim()
  if (!nome) return c.json({ error: 'Nome é obrigatório' }, 400)
  if (nome.length > 255) return c.json({ error: 'Nome muito longo' }, 400)
  const ativo = body.ativo === true || body.ativo === 1 ? 1 : 0
  const instituicao_ids = Array.isArray(body.instituicao_ids)
    ? body.instituicao_ids.map(Number).filter(Boolean)
    : []

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'INSERT INTO projeto (nome, ativo) VALUES (?, ?)',
      [nome, ativo]
    )
    const projetoId = result.insertId
    for (const instId of instituicao_ids) {
      await conn.query(
        'INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)',
        [projetoId, instId]
      )
    }
    await conn.commit()
    const row = await fetchProjectById(conn, projetoId)
    return c.json(row, 201)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
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
  const instituicao_ids = Array.isArray(body.instituicao_ids)
    ? body.instituicao_ids.map(Number).filter(Boolean)
    : []

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'UPDATE projeto SET nome=?, ativo=? WHERE id=?',
      [nome, ativo, id]
    )
    if (result.affectedRows === 0) {
      await conn.rollback()
      return c.json({ error: 'Projeto não encontrado' }, 404)
    }
    await conn.query('DELETE FROM projeto_instituicao WHERE projeto_id=?', [id])
    for (const instId of instituicao_ids) {
      await conn.query(
        'INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)',
        [id, instId]
      )
    }
    await conn.commit()
    const row = await fetchProjectById(conn, id)
    return c.json(row)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
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
