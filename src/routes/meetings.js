import { Hono } from 'hono'
import pool from '../db.js'

const meetings = new Hono()

const ALLOWED_SORT = ['data_hora', 'tipo', 'participantes_nomes', 'projeto_nomes']

// GET /api/meetings
meetings.get('/', async (c) => {
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

  const [[[{ total }]], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT r.id) AS total
       FROM reuniao r
       LEFT JOIN reuniao_participante rp ON rp.reuniao_id = r.id
       LEFT JOIN participante p ON p.id = rp.participante_id
       LEFT JOIN reuniao_projeto rpj ON rpj.reuniao_id = r.id
       LEFT JOIN projeto pr ON pr.id = rpj.projeto_id
       ${where}`,
      params
    ),
    pool.query(
      `SELECT r.id, r.data_hora, r.tipo, r.criado_em, r.atualizado_em,
            GROUP_CONCAT(DISTINCT p.nome  ORDER BY p.nome  SEPARATOR ', ') AS participantes_nomes,
            GROUP_CONCAT(DISTINCT p.id    ORDER BY p.nome)                  AS participante_ids_str,
            GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS projeto_nomes,
            GROUP_CONCAT(DISTINCT pr.id   ORDER BY pr.nome)                 AS projeto_ids_str
     FROM reuniao r
     LEFT JOIN reuniao_participante rp ON rp.reuniao_id = r.id
     LEFT JOIN participante p ON p.id = rp.participante_id
     LEFT JOIN reuniao_projeto rpj ON rpj.reuniao_id = r.id
     LEFT JOIN projeto pr ON pr.id = rpj.projeto_id
     ${where}
     GROUP BY r.id
     ORDER BY ${sort === 'participantes_nomes' ? 'participantes_nomes' : sort === 'projeto_nomes' ? 'projeto_nomes' : 'r.' + sort} ${order}
     LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ])

  const data = rows.map(r => ({
    ...r,
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
meetings.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [[row]] = await pool.query(
    'SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?',
    [id]
  )
  if (!row) return c.json({ error: 'Reunião não encontrada' }, 404)

  const [pRows] = await pool.query(
    `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
     FROM reuniao_participante rp
     JOIN participante p ON p.id = rp.participante_id
     WHERE rp.reuniao_id = ?
     ORDER BY p.nome`,
    [id]
  )

  const [prRows] = await pool.query(
    `SELECT pr.id, pr.nome, pr.ativo, pr.instituicao
     FROM reuniao_projeto rpj
     JOIN projeto pr ON pr.id = rpj.projeto_id
     WHERE rpj.reuniao_id = ?
     ORDER BY pr.nome`,
    [id]
  )

  const [paRows] = await pool.query(
    'SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC',
    [id]
  )

  const [lkRows] = await pool.query(
    'SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC',
    [id]
  )

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

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      'INSERT INTO reuniao (data_hora, tipo, notas) VALUES (?, ?, ?)',
      [data_hora, tipo, notas]
    )
    const reuniaoId = result.insertId

    for (const pid of participante_ids) {
      await conn.query(
        'INSERT IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)',
        [reuniaoId, pid]
      )
    }

    for (const prid of projeto_ids) {
      await conn.query(
        'INSERT IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)',
        [reuniaoId, prid]
      )
    }

    const pautaTextos = pautas.map(p => (typeof p === 'string' ? p : p.texto ?? '')).filter(t => t.trim())
    for (let i = 0; i < pautaTextos.length; i++) {
      await conn.query(
        'INSERT INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)',
        [reuniaoId, pautaTextos[i].trim(), i]
      )
    }

    const validLinks = Array.isArray(links)
      ? links.filter(l => l?.nome?.trim() && l?.url?.trim())
      : []
    for (let i = 0; i < validLinks.length; i++) {
      await conn.query(
        'INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)',
        [reuniaoId, validLinks[i].nome.trim(), validLinks[i].url.trim(), i]
      )
    }

    await conn.commit()

    const [[created]] = await conn.query(
      'SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?',
      [reuniaoId]
    )
    const [pRows] = await conn.query(
      `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
       FROM reuniao_participante rp
       JOIN participante p ON p.id = rp.participante_id
       WHERE rp.reuniao_id = ?
       ORDER BY p.nome`,
      [reuniaoId]
    )
    const [prRows] = await conn.query(
      `SELECT pr.id, pr.nome, pr.ativo, pr.instituicao
       FROM reuniao_projeto rpj
       JOIN projeto pr ON pr.id = rpj.projeto_id
       WHERE rpj.reuniao_id = ?
       ORDER BY pr.nome`,
      [reuniaoId]
    )
    const [paRows] = await conn.query(
      'SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC',
      [reuniaoId]
    )
    const [lkRows] = await conn.query(
      'SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC',
      [reuniaoId]
    )

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
      links: lkRows
    }, 201)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
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

  const { data_hora, tipo, notas = null, participante_ids, projeto_ids = [], pautas = [], links = [] } = body

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      'UPDATE reuniao SET data_hora = ?, tipo = ?, notas = ? WHERE id = ?',
      [data_hora, tipo, notas, id]
    )

    await conn.query('DELETE FROM reuniao_participante WHERE reuniao_id = ?', [id])

    for (const pid of participante_ids) {
      await conn.query(
        'INSERT IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)',
        [id, pid]
      )
    }

    await conn.query('DELETE FROM reuniao_projeto WHERE reuniao_id = ?', [id])

    for (const prid of projeto_ids) {
      await conn.query(
        'INSERT IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)',
        [id, prid]
      )
    }

    await conn.query('DELETE FROM pauta WHERE reuniao_id = ?', [id])

    const pautaTextos = pautas.map(p => (typeof p === 'string' ? p : p.texto ?? '')).filter(t => t.trim())
    for (let i = 0; i < pautaTextos.length; i++) {
      await conn.query(
        'INSERT INTO pauta (reuniao_id, texto, ordem) VALUES (?, ?, ?)',
        [id, pautaTextos[i].trim(), i]
      )
    }

    await conn.query('DELETE FROM link WHERE reuniao_id = ?', [id])

    const validLinks = Array.isArray(links)
      ? links.filter(l => l?.nome?.trim() && l?.url?.trim())
      : []
    for (let i = 0; i < validLinks.length; i++) {
      await conn.query(
        'INSERT INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)',
        [id, validLinks[i].nome.trim(), validLinks[i].url.trim(), i]
      )
    }

    await conn.commit()

    const [[updated]] = await conn.query(
      'SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao WHERE id = ?',
      [id]
    )
    const [pRows] = await conn.query(
      `SELECT p.id, p.nome, p.instituicao, p.cargo, p.email
       FROM reuniao_participante rp
       JOIN participante p ON p.id = rp.participante_id
       WHERE rp.reuniao_id = ?
       ORDER BY p.nome`,
      [id]
    )
    const [prRows] = await conn.query(
      `SELECT pr.id, pr.nome, pr.ativo, pr.instituicao
       FROM reuniao_projeto rpj
       JOIN projeto pr ON pr.id = rpj.projeto_id
       WHERE rpj.reuniao_id = ?
       ORDER BY pr.nome`,
      [id]
    )
    const [paRows] = await conn.query(
      'SELECT id, texto, ordem FROM pauta WHERE reuniao_id = ? ORDER BY ordem ASC',
      [id]
    )
    const [lkRows] = await conn.query(
      'SELECT id, nome, url, ordem FROM link WHERE reuniao_id = ? ORDER BY ordem ASC',
      [id]
    )

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
      links: lkRows
    })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
})

// PATCH /api/meetings/:id/notas  (auto-save)
meetings.patch('/:id/notas', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const { notas = null } = await c.req.json()
  const [result] = await pool.query('UPDATE reuniao SET notas = ? WHERE id = ?', [notas, id])
  if (result.affectedRows === 0) return c.json({ error: 'Reunião não encontrada' }, 404)
  return c.json({ ok: true })
})

// DELETE /api/meetings/:id
meetings.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'ID inválido' }, 400)
  const [result] = await pool.query('DELETE FROM reuniao WHERE id = ?', [id])
  if (result.affectedRows === 0) return c.json({ error: 'Reunião não encontrada' }, 404)
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
