/**
 * One-time migration: import notas from the original CSV source.
 * CSV uses U+001F as column separator and standard CSV quoting (multiline).
 * Notes are stored as Markdown; converted to Quill Delta during import.
 *
 * Usage: node scripts/migrate_notas_from_csv.js
 */

import { createPool } from 'mysql2/promise'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEP = '\u001f'

// ---------------------------------------------------------------------------
// CSV parser — handles U+001F separator and standard CSV multiline quoting
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = []
  let i = 0
  const len = text.length

  while (i < len) {
    const row = []
    let firstField = true

    while (i < len && text[i] !== '\n') {
      if (!firstField && text[i] === SEP) i++ // skip separator
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
        row.push(field)
      } else {
        let field = ''
        while (i < len && text[i] !== SEP && text[i] !== '\n') field += text[i++]
        row.push(field.trim())
      }
    }
    if (i < len && text[i] === '\n') i++ // consume newline
    if (row.length > 0 && (row[0] || row[1])) rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Convert local BRT date string (YYYY-MM-DD HH:MM:SS) to UTC Date
// Brazil is BRT = UTC-3 (no DST since 2019)
// ---------------------------------------------------------------------------
function brtToUtc(dateStr) {
  const [date, time] = dateStr.split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi, s] = (time || '00:00:00').split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, mi, s))
}

// ---------------------------------------------------------------------------
// Markdown → Quill Delta
// Handles: # headings, - bullet lists (with indent), plain text
// ---------------------------------------------------------------------------
function markdownToQuillDelta(md) {
  const ops = []
  const lines = md.split('\n')

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    // Skip trailing empty line at end of content
    if (!line && idx === lines.length - 1) continue

    // Heading: ###... text
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      ops.push({ insert: headingMatch[2] })
      ops.push({ insert: '\n', attributes: { header: headingMatch[1].length } })
      continue
    }

    // Bullet list: [spaces]- text or [spaces]* text
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2)
      const attrs = { list: 'bullet' }
      if (indent > 0) attrs.indent = indent
      ops.push({ insert: bulletMatch[2] })
      ops.push({ insert: '\n', attributes: attrs })
      continue
    }

    // Ordered list: [spaces]N. text
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/)
    if (orderedMatch) {
      const indent = Math.floor(orderedMatch[1].length / 2)
      const attrs = { list: 'ordered' }
      if (indent > 0) attrs.indent = indent
      ops.push({ insert: orderedMatch[2] })
      ops.push({ insert: '\n', attributes: attrs })
      continue
    }

    // Plain text or empty line
    ops.push({ insert: line + '\n' })
  }

  if (ops.length === 0) ops.push({ insert: '\n' })
  return { ops }
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

const csvPath = join(__dirname, '../docs/source/memoriaReunioes-Notas.csv')
const raw = readFileSync(csvPath, 'utf8')
const rows = parseCsv(raw)
const [header, ...data] = rows
console.log('CSV header:', header)
console.log('CSV rows:', data.length)

let updated = 0, skipped = 0, notFound = 0

for (const row of data) {
  const [dateStr, notasMD] = row
  if (!dateStr) continue

  const utcDate = brtToUtc(dateStr)
  const [meetings] = await pool.query(
    'SELECT id FROM reuniao WHERE data_hora = ?',
    [utcDate]
  )

  if (!meetings.length) {
    console.warn('No meeting found for date:', dateStr, '(UTC:', utcDate.toISOString(), ')')
    notFound++
    continue
  }

  const id = meetings[0].id

  if (!notasMD || !notasMD.trim()) {
    // Clear notes for meetings without content
    await pool.query('UPDATE reuniao SET notas = NULL WHERE id = ?', [id])
    skipped++
    continue
  }

  const delta = markdownToQuillDelta(notasMD.trim())
  await pool.query(
    'UPDATE reuniao SET notas = ? WHERE id = ?',
    [JSON.stringify(delta), id]
  )
  updated++
}

console.log(`Done. Updated: ${updated}, Cleared: ${skipped}, Not found: ${notFound}`)
await pool.end()
