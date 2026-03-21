/**
 * One-time migration: import links from memoriaReunioes-DocsRelacionados.csv.
 * CSV uses ; as column separator and standard CSV quoting.
 * Link format in linkDoc field: [nome] url
 *
 * Usage:
 *   DB_HOST=... DB_PORT=... DB_NAME=reunioes DB_USER=root DB_PASSWORD=... \
 *     node scripts/migrate_links_from_csv.js
 */

import { createPool } from 'mysql2/promise'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Simple CSV parser — handles ; separator and standard CSV quoting (multiline)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = []
  let i = 0
  const len = text.length

  while (i < len) {
    const row = []
    let firstField = true

    while (i < len && text[i] !== '\n') {
      if (!firstField && text[i] === ';') i++ // skip separator
      firstField = false

      if (text[i] === '"') {
        i++ // skip opening quote
        let field = ''
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') { field += '"'; i += 2 }
            else { i++; break }
          } else {
            field += text[i++]
          }
        }
        row.push(field.replace(/\n$/, '').trim())
      } else {
        let field = ''
        while (i < len && text[i] !== ';' && text[i] !== '\n') field += text[i++]
        row.push(field.trim())
      }
    }
    if (i < len && text[i] === '\n') i++ // consume newline
    if (row.length > 0 && (row[0] || row[1])) rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Convert BRT date string (DD/MM/YYYY HH:MM) to UTC Date
// Brazil is BRT = UTC-3 (no DST since 2019)
// ---------------------------------------------------------------------------
function brtToUtc(dateStr) {
  // Expected format: DD/MM/YYYY HH:MM
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (!match) return null
  const [, d, mo, y, h, mi] = match.map(Number)
  // Add 3 hours to convert BRT → UTC
  return new Date(Date.UTC(y, mo - 1, d, h + 3, mi, 0))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const pool = createPool({
  host: process.env.DB_HOST || '192.168.1.10',
  port: Number(process.env.DB_PORT) || 3333,
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'reunioes',
  password: process.env.DB_PASSWORD,
})

const csvPath = join(__dirname, '../docs/source/memoriaReunioes-DocsRelacionados.csv')
const raw = readFileSync(csvPath, 'utf8')
const rows = parseCsv(raw)
const [header, ...data] = rows
console.log('CSV header:', header)
console.log('CSV rows:', data.length)

const LINK_RE = /^\[(.+?)\]\s+(.+)$/
const URL_RE = /^https?:\/\/.+/

let inserted = 0, skipped = 0, notFound = 0, invalid = 0

// Track ordem per meeting for sequential ordering
const ordemMap = {}

for (const row of data) {
  const [dateStr, linkDoc] = row
  if (!dateStr) { skipped++; continue }

  // Parse link format: [nome] url  OR  plain url
  const linkDoc2 = (linkDoc || '').trim()
  let nome, url
  const match = linkDoc2.match(LINK_RE)
  if (match) {
    nome = match[1].trim()
    url = match[2].trim()
  } else if (URL_RE.test(linkDoc2)) {
    // Plain URL without bracket notation — use URL as name
    nome = linkDoc2
    url = linkDoc2
  } else {
    console.warn(`SKIPPED: formato inválido: "${linkDoc2}"`)
    invalid++
    continue
  }
  if (!nome || !url) { invalid++; continue }

  const utcDate = brtToUtc(dateStr)
  if (!utcDate) {
    console.warn(`SKIPPED: data inválida: "${dateStr}"`)
    skipped++
    continue
  }

  const [meetings] = await pool.query(
    'SELECT id FROM reuniao WHERE data_hora = ?',
    [utcDate]
  )

  if (!meetings.length) {
    console.warn(`SKIPPED: reunião não encontrada para "${dateStr}" (UTC: ${utcDate.toISOString()})`)
    notFound++
    continue
  }

  const reuniaoId = meetings[0].id
  if (!ordemMap[reuniaoId]) ordemMap[reuniaoId] = 0
  const ordem = ordemMap[reuniaoId]++

  const [result] = await pool.query(
    'INSERT IGNORE INTO link (reuniao_id, nome, url, ordem) VALUES (?, ?, ?, ?)',
    [reuniaoId, nome, url, ordem]
  )
  if (result.affectedRows > 0) inserted++
  else { console.log(`DUPLICATE ignored: reuniao ${reuniaoId} — "${nome}"`); skipped++ }
}

console.log(`\nDone. Inserted: ${inserted}, Skipped/duplicate: ${skipped}, Not found: ${notFound}, Invalid format: ${invalid}`)
await pool.end()
