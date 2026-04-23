import { Hono } from 'hono'
import db from '../db.js'

const meetings = new Hono()

const ALLOWED_SORT = ['data_hora', 'tipo', 'participantes_nomes', 'projeto_nomes']

function isAllowedUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

// GET /api/meetings
meetings.get('/', (c) => {
  const partIdsRaw = c.req.query('part_ids') ?? ''
  const projIdsRaw = c.req.query('proj_ids') ?? ''
  const partIds = partIdsRaw ? partIdsRaw.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  const projIds = projIdsRaw ? projIdsRaw.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  const sort = ALLOWED_SORT.includes(c.req.query('sort')) ? c.req.query('sort') : 'data_hora'
  const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50)))
  const offset = (page - 1) * limit

  const conditions = []
  const params = []
  if (partIds.length > 0) {
    conditions.push(
      `r.id IN (SELECT reuniao_id FROM reuniao_participante WHERE participante_id IN (${partIds.map(() => '?').join(',')}) GROUP BY reuniao_id HAVING COUNT(DISTINCT participante_id) = ?)`
    )
    params.push(...partIds, partIds.length)
  }
  if (projIds.length > 0) {
    conditions.push(
      `r.id IN (SELECT reuniao_id FROM reuniao_projeto WHERE projeto_id IN (${projIds.map(() => '?').join(',')}) GROUP BY reuniao_id HAVING COUNT(DISTINCT projeto_id) = ?)`
    )
    params.push(...projIds, projIds.length)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const sortExpr = sort === 'participantes_nomes' ? 'participantes_nomes'
    : sort === 'projeto_nomes' ? 'projeto_nomes'
    : `r.${sort}`

  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM reuniao r ${where}`
  ).get(...params)

  const rows = db.prepare(
    `SELECT r.id, r.data_hora, r.tipo, r.criado_em, r.atualizado_em,
       (r.notas IS NOT NULL) AS has_notas,
       (SELECT COUNT(*) FROM arquivo WHERE reuniao_id = r.id) AS arquivo_count,
       (SELECT GROUP_CONCAT(p2.nome, ', ') FROM (SELECT p2.nome FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)) AS participantes_nomes,
       (SELECT GROUP_CONCAT(p2.id, ',') FROM (SELECT p2.id FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)) AS participante_ids_str,
       (SELECT GROUP_CONCAT(pr2.nome, ', ') FROM (SELECT pr2.nome FROM projeto pr2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = pr2.id WHERE rpj2.reuniao_id = r.id ORDER BY pr2.nome)) AS projeto_nomes,
       (SELECT GROUP_CONCAT(pr2.id, ',') FROM (SELECT pr2.id FROM projeto pr2 JOIN reuniao_projeto rpj2 ON rpj2.projeto_id = pr2.id WHERE rpj2.reuniao_id = r.id ORDER BY pr2.nome)) AS projeto_ids_str
     FROM reuniao r
     ${where}
     ORDER BY ${sortExpr} ${order}
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)

  const data = rows.map(r => ({
    ...r,
    has_notas: Boolean(r.has_notas),
    participantes_nomes: r.participantes_nomes ?? '',
    participante_ids: r.participante_ids_str
      ? r.participante_ids_str.split(',').map(Number)
      : [],
    participante_ids_str: undefined,
    projeto_nomes: r.projeto_nomes ?? '',
    projeto_ids: r.projeto_ids_str
      ? r.projeto_ids_str.split(',').map(Number)
      : [],
    projeto_ids_str: undefined
  }))

  return c.json({ data, total, page, limit, pages: Math.ceil(total / limit) })
})

// GET /api/meetings/:id
meetings.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  const row = db.prepare(
    'SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?'
  ).get(id)
  if (!row) return c.json({ error: 'Reunião não encontrada' }, 404)

  const pRows = db.prepare(
    `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
     FROM reuniao_participante rp
     JOIN participante p ON p.id = rp.participante_id
     WHERE rp.reuniao_id = ?
     ORDER BY p.nome`
  ).all(id)

  const prRows = db.prepare(
    `SELECT pr.id, pr.nome, pr.ativo,
            COALESCE((SELECT GROUP_CONCAT(i2.sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = pr.id ORDER BY i2.sigla)), '') AS instituicao_nomes
     FROM reuniao_projeto rpj
     JOIN projeto pr ON pr.id = rpj.projeto_id
     WHERE rpj.reuniao_id = ?
     ORDER BY pr.nome`
  ).all(id)

  const paRows = db.prepare(
    'SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC'
  ).all(id)

  const lkRows = db.prepare(
    'SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC'
  ).all(id)

  const projetos = prRows.map(pr => ({ ...pr, ativo: Boolean(pr.ativo) }))

  return c.json({
    ...row,
    participantes: pRows,
    participante_ids: pRows.map(p => p.id),
    participantes_nomes: pRows.map(p => p.nome).join(', '),
    projetos,
    projeto_ids: projetos.map(pr => pr.id),
    projeto_nomes: projetos.map(pr => pr.nome).join(', '),
    pautas: paRows,
    links: lkRows
  })
})

// POST /api/meetings
meetings.post('/', async (c) => {
  const body = await c.req.json()
  const errors = validate(body)
  if (Object.keys(errors).length > 0) {
    return c.json({ error: 'Validation failed', fields: errors }, 400)
  }

  const { data_hora, tipo, notas = null, participante_ids, projeto_ids = [], pautas = [], links = [] } = body

  const validLinks = []
  const rejectedUrls = []
  for (const l of (Array.isArray(links) ? links : [])) {
    if (!l?.nome?.trim() || !l?.url?.trim()) continue
    if (isAllowedUrl(l.url.trim())) {
      validLinks.push(l)
    } else {
      rejectedUrls.push(l.url.trim())
    }
  }

  const pautaTextos = pautas.map(p => (typeof p === 'string' ? p : p.texto ?? '')).filter(t => t.trim())

  const reuniaoId = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO reuniao (data_hora, tipo, notas) VALUES (?, ?, ?)'
    ).run(data_hora, tipo, notas)
    const id = Number(result.lastInsertRowid)

    for (const pid of participante_ids) {
      db.prepare('INSERT OR IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)').run(id, pid)
    }
    for (const prid of projeto_ids) {
      db.prepare('INSERT OR IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)').run(id, prid)
    }
    for (let i = 0; i < pautaTextos.length; i++) {
      db.prepare('INSERT INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)').run(id, pautaTextos[i].trim(), i)
    }
    for (let i = 0; i < validLinks.length; i++) {
      db.prepare('INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)').run(id, validLinks[i].nome.trim(), validLinks[i].url.trim(), i)
    }
    return id
  })()

  const created = db.prepare('SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?').get(reuniaoId)
  const pRows = db.prepare(
    `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
     FROM reuniao_participante rp
     JOIN participante p ON p.id = rp.participante_id
     WHERE rp.reuniao_id = ? ORDER BY p.nome`
  ).all(reuniaoId)
  const prRows = db.prepare(
    `SELECT pr.id, pr.nome, pr.ativo,
            COALESCE((SELECT GROUP_CONCAT(i2.sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = pr.id ORDER BY i2.sigla)), '') AS instituicao_nomes
     FROM reuniao_projeto rpj
     JOIN projeto pr ON pr.id = rpj.projeto_id
     WHERE rpj.reuniao_id = ? ORDER BY pr.nome`
  ).all(reuniaoId)
  const paRows = db.prepare('SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC').all(reuniaoId)
  const lkRows = db.prepare('SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC').all(reuniaoId)

  const projetos = prRows.map(pr => ({ ...pr, ativo: Boolean(pr.ativo) }))

  return c.json({
    ...created,
    participantes: pRows,
    participante_ids: pRows.map(p => p.id),
    participantes_nomes: pRows.map(p => p.nome).join(', '),
    projetos,
    projeto_ids: projetos.map(pr => pr.id),
    projeto_nomes: projetos.map(pr => pr.nome).join(', '),
    pautas: paRows,
    links: lkRows,
    rejected_urls: rejectedUrls
  }, 201)
})

// PUT /api/meetings/:id
meetings.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = db.prepare('SELECT id FROM reuniao WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Reunião não encontrada' }, 404)

  const body = await c.req.json()
  const errors = validate(body)
  if (Object.keys(errors).length > 0) {
    return c.json({ error: 'Validation failed', fields: errors }, 400)
  }

  const { data_hora, tipo, notas = null, participante_ids, projeto_ids = [], pautas = [], links = [] } = body

  const validLinks = []
  const rejectedUrls = []
  for (const l of (Array.isArray(links) ? links : [])) {
    if (!l?.nome?.trim() || !l?.url?.trim()) continue
    if (isAllowedUrl(l.url.trim())) {
      validLinks.push(l)
    } else {
      rejectedUrls.push(l.url.trim())
    }
  }

  const pautaTextos = pautas.map(p => (typeof p === 'string' ? p : p.texto ?? '')).filter(t => t.trim())

  db.transaction(() => {
    db.prepare('UPDATE reuniao SET data_hora = ?, tipo = ?, notas = ? WHERE id = ?').run(data_hora, tipo, notas, id)

    db.prepare('DELETE FROM reuniao_participante WHERE reuniao_id = ?').run(id)
    for (const pid of participante_ids) {
      db.prepare('INSERT OR IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)').run(id, pid)
    }

    db.prepare('DELETE FROM reuniao_projeto WHERE reuniao_id = ?').run(id)
    for (const prid of projeto_ids) {
      db.prepare('INSERT OR IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)').run(id, prid)
    }

    db.prepare('DELETE FROM pauta WHERE reuniao_id = ?').run(id)
    for (let i = 0; i < pautaTextos.length; i++) {
      db.prepare('INSERT INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)').run(id, pautaTextos[i].trim(), i)
    }

    db.prepare('DELETE FROM link WHERE reuniao_id = ?').run(id)
    for (let i = 0; i < validLinks.length; i++) {
      db.prepare('INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)').run(id, validLinks[i].nome.trim(), validLinks[i].url.trim(), i)
    }
  })()

  const updated = db.prepare('SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?').get(id)
  const pRows = db.prepare(
    `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
     FROM reuniao_participante rp
     JOIN participante p ON p.id = rp.participante_id
     WHERE rp.reuniao_id = ? ORDER BY p.nome`
  ).all(id)
  const prRows = db.prepare(
    `SELECT pr.id, pr.nome, pr.ativo,
            COALESCE((SELECT GROUP_CONCAT(i2.sigla, ', ') FROM (SELECT DISTINCT i2.sigla FROM instituicao i2 JOIN projeto_instituicao pi2 ON pi2.instituicao_id = i2.id WHERE pi2.projeto_id = pr.id ORDER BY i2.sigla)), '') AS instituicao_nomes
     FROM reuniao_projeto rpj
     JOIN projeto pr ON pr.id = rpj.projeto_id
     WHERE rpj.reuniao_id = ? ORDER BY pr.nome`
  ).all(id)
  const paRows = db.prepare('SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC').all(id)
  const lkRows = db.prepare('SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC').all(id)

  const projetos = prRows.map(pr => ({ ...pr, ativo: Boolean(pr.ativo) }))

  return c.json({
    ...updated,
    participantes: pRows,
    participante_ids: pRows.map(p => p.id),
    participantes_nomes: pRows.map(p => p.nome).join(', '),
    projetos,
    projeto_ids: projetos.map(pr => pr.id),
    projeto_nomes: projetos.map(pr => pr.nome).join(', '),
    pautas: paRows,
    links: lkRows,
    rejected_urls: rejectedUrls
  })
})

// PATCH /api/meetings/:id/notas
meetings.patch('/:id/notas', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const { notas = null } = await c.req.json()
  const result = db.prepare('UPDATE reuniao SET notas = ? WHERE id = ?').run(notas, id)
  if (result.changes === 0) return c.json({ error: 'Reunião não encontrada' }, 404)
  return c.json({ ok: true })
})

// DELETE /api/meetings/:id
meetings.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const result = db.prepare('DELETE FROM reuniao WHERE id = ?').run(id)
  if (result.changes === 0) return c.json({ error: 'Reunião não encontrada' }, 404)
  return c.json({ ok: true })
})

function validate(body) {
  const errors = {}
  if (!body.data_hora) errors.data_hora = 'Obrigatório'
  else if (isNaN(Date.parse(body.data_hora))) errors.data_hora = 'Data inválida'
  if (!body.tipo || !['Presencial', 'Remota', 'Hibrida', 'Telefone'].includes(body.tipo)) errors.tipo = 'Tipo inválido'
  if (!Array.isArray(body.participante_ids) || body.participante_ids.length === 0) {
    errors.participante_ids = 'Obrigatório — selecione ao menos um participante'
  } else if (!body.participante_ids.every(id => Number.isInteger(id) && id > 0)) {
    errors.participante_ids = 'IDs de participantes inválidos'
  }
  if (body.projeto_ids !== undefined) {
    if (!Array.isArray(body.projeto_ids)) {
      errors.projeto_ids = 'projeto_ids deve ser um array'
    } else if (!body.projeto_ids.every(id => Number.isInteger(id) && id > 0)) {
      errors.projeto_ids = 'IDs de projetos inválidos'
    }
  }
  return errors
}

export default meetings
