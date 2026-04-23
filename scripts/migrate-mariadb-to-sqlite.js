/**
 * One-time migration script: MariaDB → SQLite
 * Uses node:sqlite (built-in, no compilation needed).
 *
 * Usage:
 *   MARIADB_HOST=... MARIADB_PORT=... MARIADB_DB=... \
 *   MARIADB_USER=... MARIADB_PASS=... \
 *   DB_PATH=/path/to/meetinglog.sqlite \
 *   node scripts/migrate-mariadb-to-sqlite.js
 */
import mysql from 'mysql2/promise'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MARIADB_HOST = process.env.MARIADB_HOST
const MARIADB_PORT = Number(process.env.MARIADB_PORT ?? 3306)
const MARIADB_DB   = process.env.MARIADB_DB
const MARIADB_USER = process.env.MARIADB_USER
const MARIADB_PASS = process.env.MARIADB_PASS
const DB_PATH      = process.env.DB_PATH || './meetinglog.sqlite'

if (!MARIADB_HOST || !MARIADB_DB || !MARIADB_USER || !MARIADB_PASS) {
  console.error('Missing required env vars: MARIADB_HOST, MARIADB_DB, MARIADB_USER, MARIADB_PASS')
  process.exit(1)
}

console.log(`[migrate] Connecting to MariaDB at ${MARIADB_HOST}:${MARIADB_PORT}/${MARIADB_DB}...`)
const mariadb = await mysql.createConnection({
  host: MARIADB_HOST, port: MARIADB_PORT, database: MARIADB_DB,
  user: MARIADB_USER, password: MARIADB_PASS, charset: 'utf8mb4'
})
console.log('[migrate] Connected to MariaDB.')

mkdirSync(dirname(DB_PATH), { recursive: true })
console.log(`[migrate] Opening SQLite at ${DB_PATH}...`)
const sqlite = new DatabaseSync(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = OFF')

const schemaSql = readFileSync(join(__dirname, '../migrations/001_sqlite_init.sql'), 'utf8')
sqlite.exec(schemaSql)
console.log('[migrate] SQLite schema applied.')

function fmtDt(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19)
  return String(v)
}

function bulkInsert(label, rows, insertFn) {
  if (rows.length === 0) { console.log(`[migrate] ${label}: 0 rows — skipping.`); return }
  console.log(`[migrate] ${label}: ${rows.length} rows...`)
  sqlite.exec('BEGIN')
  try {
    for (const row of rows) insertFn(row)
    sqlite.exec('COMMIT')
  } catch (err) {
    sqlite.exec('ROLLBACK')
    throw err
  }
}

// ── instituicao ───────────────────────────────────────────────────────────────
const [instRows] = await mariadb.query('SELECT id, sigla, nome, criado_em FROM instituicao ORDER BY id')
const instInsert = sqlite.prepare('INSERT OR IGNORE INTO instituicao (id, sigla, nome, criado_em) VALUES (?, ?, ?, ?)')
bulkInsert('instituicao', instRows, r => instInsert.run(r.id, r.sigla, r.nome ?? null, fmtDt(r.criado_em)))

// ── participante ─────────────────────────────────────────────────────────────
const [partRows] = await mariadb.query('SELECT id, nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas, criado_em FROM participante ORDER BY id')
const partInsert = sqlite.prepare('INSERT OR IGNORE INTO participante (id, nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
bulkInsert('participante', partRows, r => partInsert.run(r.id, r.nome, r.instituicao ?? null, r.lotacao ?? null, r.cargo ?? null, r.email ?? null, r.ativo ? 1 : 0, r.ativo_manual ? 1 : 0, r.notas ?? null, fmtDt(r.criado_em)))

// ── projeto ───────────────────────────────────────────────────────────────────
const [projRows] = await mariadb.query('SELECT id, nome, ativo, notas, criado_em FROM projeto ORDER BY id')
const projInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto (id, nome, ativo, notas, criado_em) VALUES (?, ?, ?, ?, ?)')
bulkInsert('projeto', projRows, r => projInsert.run(r.id, r.nome, r.ativo ? 1 : 0, r.notas ?? null, fmtDt(r.criado_em)))

// ── projeto_instituicao ───────────────────────────────────────────────────────
const [piRows] = await mariadb.query('SELECT projeto_id, instituicao_id FROM projeto_instituicao')
const piInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)')
bulkInsert('projeto_instituicao', piRows, r => piInsert.run(r.projeto_id, r.instituicao_id))

// ── reuniao ───────────────────────────────────────────────────────────────────
const [reuniaoRows] = await mariadb.query('SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao ORDER BY id')
const reuniaoInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao (id, data_hora, tipo, notas, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
bulkInsert('reuniao', reuniaoRows, r => reuniaoInsert.run(r.id, fmtDt(r.data_hora), r.tipo, r.notas ?? null, fmtDt(r.criado_em), fmtDt(r.atualizado_em)))

// ── reuniao_participante ──────────────────────────────────────────────────────
const [rpRows] = await mariadb.query('SELECT reuniao_id, participante_id FROM reuniao_participante')
const rpInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)')
bulkInsert('reuniao_participante', rpRows, r => rpInsert.run(r.reuniao_id, r.participante_id))

// ── reuniao_projeto ───────────────────────────────────────────────────────────
const [rpjRows] = await mariadb.query('SELECT reuniao_id, projeto_id FROM reuniao_projeto')
const rpjInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)')
bulkInsert('reuniao_projeto', rpjRows, r => rpjInsert.run(r.reuniao_id, r.projeto_id))

// ── pauta ─────────────────────────────────────────────────────────────────────
const [pautaRows] = await mariadb.query('SELECT id, reuniao_id, texto, ordem, criado_em FROM pauta ORDER BY id')
const pautaInsert = sqlite.prepare('INSERT OR IGNORE INTO pauta (id, reuniao_id, texto, ordem, criado_em) VALUES (?, ?, ?, ?, ?)')
bulkInsert('pauta', pautaRows, r => pautaInsert.run(r.id, r.reuniao_id, r.texto, r.ordem, fmtDt(r.criado_em)))

// ── link ──────────────────────────────────────────────────────────────────────
const [linkRows] = await mariadb.query('SELECT id, reuniao_id, nome, url, ordem, criado_em FROM link ORDER BY id')
const linkInsert = sqlite.prepare('INSERT OR IGNORE INTO link (id, reuniao_id, nome, url, ordem, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
bulkInsert('link', linkRows, r => linkInsert.run(r.id, r.reuniao_id, r.nome ?? null, r.url, r.ordem, fmtDt(r.criado_em)))

// ── projeto_link ──────────────────────────────────────────────────────────────
const [plRows] = await mariadb.query('SELECT id, projeto_id, nome, url, ordem, criado_em FROM projeto_link ORDER BY id')
const plInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto_link (id, projeto_id, nome, url, ordem, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
bulkInsert('projeto_link', plRows, r => plInsert.run(r.id, r.projeto_id, r.nome ?? null, r.url, r.ordem, fmtDt(r.criado_em)))

// ── arquivo ───────────────────────────────────────────────────────────────────
const [arquivoRows] = await mariadb.query('SELECT id, reuniao_id, filename_original, filename_stored, letter, mime_type, file_size, criado_em FROM arquivo ORDER BY id')
const arquivoInsert = sqlite.prepare('INSERT OR IGNORE INTO arquivo (id, reuniao_id, filename_original, filename_stored, letter, mime_type, file_size, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
bulkInsert('arquivo', arquivoRows, r => {
  const letter = r.letter instanceof Buffer ? r.letter.toString() : String(r.letter)
  arquivoInsert.run(r.id, r.reuniao_id, r.filename_original, r.filename_stored, letter, r.mime_type, r.file_size, fmtDt(r.criado_em))
})

sqlite.exec('PRAGMA foreign_keys = ON')
const violations = sqlite.prepare('PRAGMA foreign_key_check').all()
if (violations.length > 0) {
  console.warn('[migrate] Atenção: foreign key violations:', violations)
} else {
  console.log('[migrate] Integridade referencial: OK.')
}

await mariadb.end()
sqlite.close()
console.log(`\n[migrate] Concluído! Arquivo SQLite criado em: ${DB_PATH}`)
