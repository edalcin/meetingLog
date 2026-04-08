import { Hono } from 'hono'
import pool from '../db.js'

const projects = new Hono()

function isAllowedUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

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
    `SELECT p.id, p.nome, p.ativo, p.notas,
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

// GET /api/projects/:id/detail
projects.get('/:id/detail', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const [[row]] = await pool.query(
    `SELECT p.id, p.nome, p.ativo, p.notas,
            COALESCE(GROUP_CONCAT(DISTINCT i.sigla ORDER BY i.sigla SEPARATOR ', '), '') AS instituicao_nomes,
            COALESCE(GROUP_CONCAT(DISTINCT i.id    ORDER BY i.sigla SEPARATOR ','),     '') AS instituicao_ids_str
     FROM projeto p
     LEFT JOIN projeto_instituicao pi ON pi.projeto_id = p.id
     LEFT JOIN instituicao i ON i.id = pi.instituicao_id
     WHERE p.id = ?
     GROUP BY p.id`,
    [id]
  )
  if (!row) return c.json({ error: 'Projeto não encontrado' }, 404)
  const [linkRows] = await pool.query(
    'SELECT id, nome, url, ordem FROM projeto_link WHERE projeto_id = ? ORDER BY ordem ASC',
    [id]
  )
  const [reunioes] = await pool.query(
    `SELECT r.id, r.data_hora, r.tipo
     FROM reuniao r
     JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
     WHERE rp.projeto_id = ?
     ORDER BY r.data_hora DESC`,
    [id]
  )
  return c.json({ ...parseRow(row), links: linkRows, reunioes })
})

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
            (p.notas IS NOT NULL AND p.notas != '') AS has_notas,
            (SELECT COUNT(*) FROM projeto_link WHERE projeto_id = p.id) AS link_count,
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
  const notas = body.notas ?? null
  const instituicao_ids = Array.isArray(body.instituicao_ids)
    ? body.instituicao_ids.map(Number).filter(Boolean)
    : []
  const validLinks = []
  const rejectedUrls = []
  for (const l of (Array.isArray(body.links) ? body.links : [])) {
    if (!l?.url?.trim()) continue
    if (isAllowedUrl(l.url.trim())) {
      validLinks.push(l)
    } else {
      rejectedUrls.push(l.url.trim())
    }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'INSERT INTO projeto (nome, ativo, notas) VALUES (?, ?, ?)',
      [nome, ativo, notas]
    )
    const projetoId = result.insertId
    for (const instId of instituicao_ids) {
      await conn.query(
        'INSERT IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)',
        [projetoId, instId]
      )
    }
    for (let i = 0; i < validLinks.length; i++) {
      const l = validLinks[i]
      await conn.query(
        'INSERT IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)',
        [projetoId, l.nome?.trim() || null, l.url.trim(), i]
      )
    }
    await conn.commit()
    const row = await fetchProjectById(conn, projetoId)
    return c.json({ ...row, rejected_urls: rejectedUrls }, 201)
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
  const notas = body.notas ?? null
  const instituicao_ids = Array.isArray(body.instituicao_ids)
    ? body.instituicao_ids.map(Number).filter(Boolean)
    : []
  const validLinks = []
  const rejectedUrls = []
  for (const l of (Array.isArray(body.links) ? body.links : [])) {
    if (!l?.url?.trim()) continue
    if (isAllowedUrl(l.url.trim())) {
      validLinks.push(l)
    } else {
      rejectedUrls.push(l.url.trim())
    }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Capture previous ativo to detect deactivation
    const [[prev]] = await conn.query('SELECT ativo FROM projeto WHERE id=?', [id])
    if (!prev) { await conn.rollback(); return c.json({ error: 'Projeto não encontrado' }, 404) }
    const wasActive = Boolean(prev.ativo)

    const [result] = await conn.query(
      'UPDATE projeto SET nome=?, ativo=?, notas=? WHERE id=?',
      [nome, ativo, notas, id]
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
    await conn.query('DELETE FROM projeto_link WHERE projeto_id=?', [id])
    for (let i = 0; i < validLinks.length; i++) {
      const l = validLinks[i]
      await conn.query(
        'INSERT IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)',
        [id, l.nome?.trim() || null, l.url.trim(), i]
      )
    }

    // Cascade deactivation: if project just became inactive, deactivate participants
    // whose meetings are now exclusively linked to inactive projects
    let deactivated_participants = []
    if (wasActive && ativo === 0) {
      const [candidates] = await conn.query(
        `SELECT p.id, p.nome FROM participante p
         WHERE p.ativo = TRUE
           AND p.ativo_manual = FALSE
           AND EXISTS (
             SELECT 1 FROM reuniao_participante rp
             JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
             WHERE rp.participante_id = p.id AND rpj.projeto_id = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM reuniao_participante rp2
             JOIN reuniao_projeto rpj2 ON rpj2.reuniao_id = rp2.reuniao_id
             JOIN projeto pr ON pr.id = rpj2.projeto_id
             WHERE rp2.participante_id = p.id AND pr.ativo = TRUE
           )`,
        [id]
      )
      if (candidates.length > 0) {
        const ids = candidates.map(p => p.id)
        await conn.query(
          `UPDATE participante SET ativo = FALSE WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        )
        deactivated_participants = candidates
      }
    }

    await conn.commit()
    const row = await fetchProjectById(conn, id)
    return c.json({ ...row, deactivated_participants, rejected_urls: rejectedUrls })
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
