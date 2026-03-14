import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env if running locally (not in Docker)
if (!process.env.DB_HOST) {
  const { config } = await import('dotenv').catch(() => ({ config: () => {} }))
  config?.()
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'your-mariadb-host',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'reunioes',
  user: process.env.DB_USER ?? 'your-db-user',
  password: process.env.DB_PASSWORD ?? 'your-db-password',
  charset: 'utf8mb4'
})

const csvPath = join(__dirname, '../docs/source/memoriaReunioes-Reuniao.csv')
const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity })

let lineNum = 0
let inserted = 0
let skipped = 0
let errors = 0

function parseDate(dateStr) {
  // Format: DD/MM/YYYY HH:mm
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, dd, mm, yyyy, hh, min] = match
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`
}

for await (const line of rl) {
  lineNum++
  if (lineNum === 1) continue // skip header
  const parts = line.split(';')
  if (parts.length < 4) {
    console.warn(`[import] Line ${lineNum}: malformed row, skipping: ${line}`)
    errors++
    continue
  }
  const [dataRaw, tipo, participantes, projeto] = parts.map(p => p.trim())
  const dataHora = parseDate(dataRaw)
  if (!dataHora) {
    console.warn(`[import] Line ${lineNum}: invalid date '${dataRaw}', skipping`)
    errors++
    continue
  }
  if (!['Presencial', 'Remota'].includes(tipo)) {
    console.warn(`[import] Line ${lineNum}: invalid tipo '${tipo}', skipping`)
    errors++
    continue
  }

  // Check for duplicate
  const [rows] = await conn.execute(
    'SELECT id FROM reuniao WHERE data_hora = ? AND tipo = ? AND participantes = ? AND projeto = ? LIMIT 1',
    [dataHora, tipo, participantes, projeto]
  )
  if (rows.length > 0) {
    skipped++
    continue
  }

  await conn.execute(
    'INSERT INTO reuniao (data_hora, tipo, participantes, projeto) VALUES (?, ?, ?, ?)',
    [dataHora, tipo, participantes, projeto]
  )
  inserted++
}

await conn.end()
console.log(`[import] Done. Inserted: ${inserted}, Skipped (duplicates): ${skipped}, Errors: ${errors}`)
