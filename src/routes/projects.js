import { Hono } from 'hono'
import db from '../db.js'

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

function fetchProjectById(id) {
  const row = db.prepare(`
    SELECT p.id, p.nome, p.ativo, p.notas,
      COALESCE((SELECT GROUP_CONCAT(i2.sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_nomes,
      COALESCE((SELECT GROUP_CONCAT(i2.id, ',') FROM (SELECT i2.id, i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_ids_str
    FROM projeto p
    WHERE p.id = ?
  `).get(id)
  return row ? parseRow(row) : null
}

// GET /api/projects/:id/detail
projects.get('/:id/detail', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const row = fetchProjectById(id)
  if (!row) return c.json({ error: 'Projeto não encontrado' }, 404)
  const linkRows = db.prepare(
    'SELECT id, nome, url, ordem FROM projeto_link WHERE projeto_id = ? ORDER BY ordem ASC'
  ).all(id)
  const reunioes = db.prepare(
    `SELECT r.id, r.data_hora, r.tipo
     FROM reuniao r
     JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
     WHERE rp.projeto_id = ?
     ORDER BY r.data_hora DESC`
  ).all(id)
  return c.json({ ...row, links: linkRows, reunioes })
})

// GET /api/projects?q=&activeOnly=&limit=
projects.get('/', (c) => {
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

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM projeto p ${where}`).get(...params)

  const rows = db.prepare(
    `SELECT p.id, p.nome, p.ativo,
            COALESCE((SELECT GROUP_CONCAT(i2.sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_nomes,
            COALESCE((SELECT GROUP_CONCAT(i2.id, ',') FROM (SELECT i2.id, i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = p.id ORDER BY i2.sigla)), '') AS instituicao_ids_str,
            (p.notas IS NOT NULL AND p.notas != '') AS has_notas,
            (SELECT COUNT(*) FROM projeto_link WHERE projeto_id = p.id) AS link_count,
            (SELECT COUNT(*) FROM reuniao_projeto WHERE projeto_id = p.id) AS reuniao_count
     FROM projeto p
     ${where}
     ORDER BY p.nome ASC
     LIMIT ?`
  ).all(...params, limit)

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

  const projetoId = db.transaction(() => {
    const result = db.prepare('INSERT INTO projeto (nome, ativo, notas) VALUES (?, ?, ?)').run(nome, ativo, notas)
    const id = Number(result.lastInsertRowid)
    for (const instId of instituicao_ids) {
      db.prepare('INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)').run(id, instId)
    }
    for (let i = 0; i < validLinks.length; i++) {
      const l = validLinks[i]
      db.prepare('INSERT OR IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)').run(id, l.nome?.trim() || null, l.url.trim(), i)
    }
    return id
  })()

  const row = fetchProjectById(projetoId)
  return c.json({ ...row, rejected_urls: rejectedUrls }, 201)
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

  let deactivated_participants = []

  db.transaction(() => {
    const prev = db.prepare('SELECT ativo FROM projeto WHERE id=?').get(id)
    if (!prev) throw Object.assign(new Error('Projeto não encontrado'), { status: 404 })
    const wasActive = Boolean(prev.ativo)

    const result = db.prepare('UPDATE projeto SET nome=?, ativo=?, notas=? WHERE id=?').run(nome, ativo, notas, id)
    if (result.changes === 0) throw Object.assign(new Error('Projeto não encontrado'), { status: 404 })

    db.prepare('DELETE FROM projeto_instituicao WHERE projeto_id=?').run(id)
    for (const instId of instituicao_ids) {
      db.prepare('INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)').run(id, instId)
    }
    db.prepare('DELETE FROM projeto_link WHERE projeto_id=?').run(id)
    for (let i = 0; i < validLinks.length; i++) {
      const l = validLinks[i]
      db.prepare('INSERT OR IGNORE INTO projeto_link (projeto_id, nome, url, ordem) VALUES (?, ?, ?, ?)').run(id, l.nome?.trim() || null, l.url.trim(), i)
    }

    if (wasActive && ativo === 0) {
      const candidates = db.prepare(
        `SELECT p.id, p.nome FROM participante p
         WHERE p.ativo = 1
           AND p.ativo_manual = 0
           AND EXISTS (
             SELECT 1 FROM reuniao_participante rp
             JOIN reuniao_projeto rpj ON rpj.reuniao_id = rp.reuniao_id
             WHERE rp.participante_id = p.id AND rpj.projeto_id = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM reuniao_participante rp2
             JOIN reuniao_projeto rpj2 ON rpj2.reuniao_id = rp2.reuniao_id
             JOIN projeto pr ON pr.id = rpj2.projeto_id
             WHERE rp2.participante_id = p.id AND pr.ativo = 1
           )`
      ).all(id)
      if (candidates.length > 0) {
        const ids = candidates.map(p => p.id)
        db.prepare(`UPDATE participante SET ativo = 0 WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
        deactivated_participants = candidates
      }
    }
  })()

  const row = fetchProjectById(id)
  return c.json({ ...row, deactivated_participants, rejected_urls: rejectedUrls })
})

// DELETE /api/projects/:id
projects.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)

  const { total } = db.prepare(
    'SELECT COUNT(*) AS total FROM reuniao_projeto WHERE projeto_id = ?'
  ).get(id)

  if (total > 0) {
    const rows = db.prepare(
      `SELECT strftime('%d/%m/%Y', r.data_hora) AS data FROM reuniao r
       JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
       WHERE rp.projeto_id = ? ORDER BY r.data_hora LIMIT 5`
    ).all(id)
    const dates = rows.map(r => r.data).join(', ')
    const extra = total > 5 ? ` e mais ${total - 5}` : ''
    return c.json({ error: `Não é possível excluir: projeto vinculado a ${total} reunião(ões) (${dates}${extra}).` }, 409)
  }

  const result = db.prepare('DELETE FROM projeto WHERE id = ?').run(id)
  if (result.changes === 0) return c.json({ error: 'Projeto não encontrado' }, 404)
  return c.json({ ok: true })
})

export default projects
