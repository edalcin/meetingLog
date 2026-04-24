import { Hono } from 'hono'
import db from '../db.js'

const dashboard = new Hono()

const COLORS = ['#3b82f6','#22c55e','#f97316','#a855f7','#ef4444','#78716c','#64748b','#ec4899','#8b5cf6','#6366f1']

function buildWhere(filter, filterValue) {
  if (filter === 'year') {
    return {
      where: `WHERE strftime('%Y', r.data_hora) = ?`,
      params: [filterValue]
    }
  }
  if (filter === 'project') {
    return {
      where: `WHERE EXISTS (SELECT 1 FROM reuniao_projeto rp0 WHERE rp0.reuniao_id = r.id AND rp0.projeto_id = ?)`,
      params: [Number(filterValue)]
    }
  }
  if (filter === 'participant') {
    return {
      where: `WHERE EXISTS (SELECT 1 FROM reuniao_participante rpa0 WHERE rpa0.reuniao_id = r.id AND rpa0.participante_id = ?)`,
      params: [Number(filterValue)]
    }
  }
  return { where: '', params: [] }
}

function topN(countMap, n) {
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

function linearTrend(yValues) {
  const n = yValues.length
  if (n === 0) return []
  const xValues = yValues.map((_, i) => i)
  const xSum = xValues.reduce((s, x) => s + x, 0)
  const ySum = yValues.reduce((s, y) => s + y, 0)
  const xySum = xValues.reduce((s, x, i) => s + x * yValues[i], 0)
  const x2Sum = xValues.reduce((s, x) => s + x * x, 0)
  const denom = n * x2Sum - xSum * xSum
  if (denom === 0) return yValues.map(() => ySum / n)
  const m = (n * xySum - xSum * ySum) / denom
  const b = (ySum - m * xSum) / n
  return xValues.map(x => Math.round((m * x + b) * 10) / 10)
}

dashboard.get('/options', (c) => {
  const anos = db.prepare(
    `SELECT DISTINCT strftime('%Y', data_hora) AS ano FROM reuniao ORDER BY ano DESC`
  ).all().map(r => r.ano)

  const projetos = db.prepare(
    `SELECT id, nome FROM projeto ORDER BY nome ASC`
  ).all()

  const participantes = db.prepare(
    `SELECT id, nome FROM participante ORDER BY nome ASC`
  ).all()

  return c.json({ anos, projetos, participantes })
})

dashboard.get('/', (c) => {
  const filter = c.req.query('filter') ?? 'all'
  const filterValue = c.req.query('value') ?? ''

  const { where, params } = buildWhere(filter, filterValue)

  const meetingRows = db.prepare(
    `SELECT r.id, r.data_hora FROM reuniao r ${where} ORDER BY r.data_hora DESC`
  ).all(...params)

  if (meetingRows.length === 0) {
    let filterDescription = 'Todos os dados'
    if (filter === 'year') filterDescription = `Ano: ${filterValue}`
    else if (filter === 'project') {
      const p = db.prepare('SELECT nome FROM projeto WHERE id = ?').get(Number(filterValue))
      filterDescription = `Projeto: ${p?.nome ?? filterValue}`
    } else if (filter === 'participant') {
      const p = db.prepare('SELECT nome FROM participante WHERE id = ?').get(Number(filterValue))
      filterDescription = `Participante: ${p?.nome ?? filterValue}`
    }

    return c.json({
      filterDescription,
      totalReunioes: 0,
      topProjetos: [],
      topParticipantes: [],
      ultimaReuniaoData: null,
      porMes: { labels: [], data: [], tendencia: [] },
      horasFreq: Array(24).fill(0),
      diasFreq: Array(7).fill(0),
      projetosStack: { labels: [], datasets: [] },
      topProjetosPizza: { labels: [], data: [] },
      topParticipantesPizza: { labels: [], data: [] }
    })
  }

  const projetoRows = db.prepare(
    `SELECT rp.reuniao_id, pr.id AS projeto_id, pr.nome AS projeto_nome
     FROM reuniao r ${where}
     JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
     JOIN projeto pr ON pr.id = rp.projeto_id`
  ).all(...params)

  const participanteRows = db.prepare(
    `SELECT rpa.reuniao_id, pa.id AS participante_id, pa.nome AS participante_nome
     FROM reuniao r ${where}
     JOIN reuniao_participante rpa ON rpa.reuniao_id = r.id
     JOIN participante pa ON pa.id = rpa.participante_id`
  ).all(...params)

  const projetosByMeeting = new Map()
  for (const row of projetoRows) {
    if (!projetosByMeeting.has(row.reuniao_id)) projetosByMeeting.set(row.reuniao_id, [])
    projetosByMeeting.get(row.reuniao_id).push({ id: row.projeto_id, nome: row.projeto_nome })
  }

  const participantesByMeeting = new Map()
  for (const row of participanteRows) {
    if (!participantesByMeeting.has(row.reuniao_id)) participantesByMeeting.set(row.reuniao_id, [])
    participantesByMeeting.get(row.reuniao_id).push({ id: row.participante_id, nome: row.participante_nome })
  }

  const projetoCount = new Map()
  const participanteCount = new Map()
  const projetoNames = new Map()
  const participanteNames = new Map()
  const mesCount = new Map()
  const horasFreq = Array(24).fill(0)
  const diasFreq = Array(7).fill(0)
  const projetoByYear = new Map()

  for (const m of meetingRows) {
    const dh = m.data_hora
    const ano = dh.substring(0, 4)
    const mes = dh.substring(5, 7)
    const hora = parseInt(dh.substring(11, 13), 10)
    const data = dh.substring(0, 10)
    const mesKey = `${ano}-${mes}`

    mesCount.set(mesKey, (mesCount.get(mesKey) ?? 0) + 1)
    if (hora >= 0 && hora < 24) horasFreq[hora]++

    const dow = new Date(`${data}T12:00:00`).getDay()
    diasFreq[dow]++

    const projetos = projetosByMeeting.get(m.id) ?? []
    for (const p of projetos) {
      projetoCount.set(p.id, (projetoCount.get(p.id) ?? 0) + 1)
      projetoNames.set(p.id, p.nome)

      if (!projetoByYear.has(p.id)) projetoByYear.set(p.id, new Map())
      const yearMap = projetoByYear.get(p.id)
      yearMap.set(ano, (yearMap.get(ano) ?? 0) + 1)
    }

    const participantes = participantesByMeeting.get(m.id) ?? []
    for (const pa of participantes) {
      participanteCount.set(pa.id, (participanteCount.get(pa.id) ?? 0) + 1)
      participanteNames.set(pa.id, pa.nome)
    }
  }

  const total = meetingRows.length

  const top10Projetos = topN(projetoCount, 10).map(([id, count]) => ({
    nome: projetoNames.get(id),
    count,
    percent: Math.round(count / total * 1000) / 10
  }))

  const top10Participantes = topN(participanteCount, 10).map(([id, count]) => ({
    nome: participanteNames.get(id),
    count,
    percent: Math.round(count / total * 1000) / 10
  }))

  const ultima = meetingRows[0]
  const dh = ultima.data_hora
  const ultimaDia = dh.substring(8, 10)
  const ultimaMes = dh.substring(5, 7)
  const ultimaAno = dh.substring(0, 4)
  const ultimaHora = dh.substring(11, 16)
  const ultimaProjetos = (projetosByMeeting.get(ultima.id) ?? []).map(p => p.nome)
  const ultimaParticipantes = (participantesByMeeting.get(ultima.id) ?? []).map(p => p.nome)
  const ultimaPautas = db.prepare(
    'SELECT texto FROM pauta WHERE reuniao_id = ? ORDER BY ordem'
  ).all(ultima.id).map(r => r.texto)

  const sortedMeses = [...mesCount.keys()].sort()
  const porMesData = sortedMeses.map(k => mesCount.get(k))

  const allYears = [...new Set(meetingRows.map(m => m.data_hora.substring(0, 4)))].sort()
  const top10ProjetoIds = topN(projetoCount, 10).map(([id]) => id)
  const top10ProjetoLabels = top10ProjetoIds.map(id => projetoNames.get(id))

  const projetosStackDatasets = allYears.map((year, yi) => ({
    label: year,
    data: top10ProjetoIds.map(id => projetoByYear.get(id)?.get(year) ?? 0),
    backgroundColor: COLORS[yi % COLORS.length]
  }))

  let filterDescription = 'Todos os dados'
  if (filter === 'year') {
    filterDescription = `Ano: ${filterValue}`
  } else if (filter === 'project') {
    const p = db.prepare('SELECT nome FROM projeto WHERE id = ?').get(Number(filterValue))
    filterDescription = `Projeto: ${p?.nome ?? filterValue}`
  } else if (filter === 'participant') {
    const p = db.prepare('SELECT nome FROM participante WHERE id = ?').get(Number(filterValue))
    filterDescription = `Participante: ${p?.nome ?? filterValue}`
  }

  return c.json({
    filterDescription,
    totalReunioes: total,
    topProjetos: top10Projetos,
    topParticipantes: top10Participantes,
    ultimaReuniaoData: {
      data: `${ultimaDia}/${ultimaMes}/${ultimaAno}`,
      hora: ultimaHora,
      projetos: ultimaProjetos,
      participantes: ultimaParticipantes,
      pautas: ultimaPautas
    },
    porMes: {
      labels: sortedMeses,
      data: porMesData,
      tendencia: linearTrend(porMesData)
    },
    horasFreq,
    diasFreq,
    projetosStack: {
      labels: top10ProjetoLabels,
      datasets: projetosStackDatasets
    },
    topProjetosPizza: {
      labels: top10Projetos.map(p => p.nome),
      data: top10Projetos.map(p => p.count)
    },
    topParticipantesPizza: {
      labels: top10Participantes.map(p => p.nome),
      data: top10Participantes.map(p => p.count)
    }
  })
})

export default dashboard
