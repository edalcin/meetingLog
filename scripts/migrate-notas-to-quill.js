#!/usr/bin/env node
/**
 * Migrates plain-text notes in reuniao.notas to Quill Delta JSON format.
 * Safe to run multiple times — already-migrated (JSON) rows are skipped.
 */
import mysql from 'mysql2/promise'

const DB = {
  host: 'DB_HOST',
  port: 3333,
  database: 'reunioes',
  user: 'root',
  password: '***REMOVED***'
}

function textToDelta(text) {
  const ops = []
  const lines = text.split('\n')

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Header: "#### Title" (1–4 hashes)
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headerMatch) {
      ops.push({ insert: headerMatch[2] })
      ops.push({ insert: '\n', attributes: { header: headerMatch[1].length } })
      continue
    }

    // Nested bullet: "  - Item" (2+ leading spaces)
    if (/^ {2,}- /.test(line)) {
      ops.push({ insert: line.replace(/^ +- /, '') })
      ops.push({ insert: '\n', attributes: { list: 'bullet', indent: 1 } })
      continue
    }

    // Top-level bullet: "- Item"
    if (/^- /.test(line)) {
      ops.push({ insert: line.replace(/^- /, '') })
      ops.push({ insert: '\n', attributes: { list: 'bullet' } })
      continue
    }

    // Regular line (including blank lines)
    ops.push({ insert: line + '\n' })
  }

  return { ops }
}

async function main() {
  const conn = await mysql.createConnection(DB)
  console.log('Connected to database.')

  const [rows] = await conn.execute(
    'SELECT id, notas FROM reuniao WHERE notas IS NOT NULL'
  )
  console.log(`Found ${rows.length} meetings with notes.`)

  let migrated = 0
  let skipped = 0

  for (const row of rows) {
    // Check if already Quill Delta JSON
    try {
      const parsed = JSON.parse(row.notas)
      if (parsed.ops) { skipped++; continue }
    } catch { /* not JSON — needs migration */ }

    const delta = textToDelta(row.notas)
    await conn.execute(
      'UPDATE reuniao SET notas = ? WHERE id = ?',
      [JSON.stringify(delta), row.id]
    )
    migrated++
    console.log(`  Migrated meeting id=${row.id}`)
  }

  await conn.end()
  console.log(`Done. Migrated: ${migrated}, Already in Quill format: ${skipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })
