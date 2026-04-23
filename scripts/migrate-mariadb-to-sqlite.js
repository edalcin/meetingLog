/**
 * One-time migration script: MariaDB → SQLite
 *
 * Usage (set credentials as environment variables — never hardcode them):
 *
 *   MARIADB_HOST=192.168.1.10 \
 *   MARIADB_PORT=3333 \
 *   MARIADB_DB=reunioes \
 *   MARIADB_USER=reunioes_app \
 *   MARIADB_PASS=your_password \
 *   DB_PATH=/path/to/meetinglog.sqlite \
 *   node scripts/migrate-mariadb-to-sqlite.js
 *
 * On Windows (PowerShell):
 *   $env:MARIADB_HOST="192.168.1.10"; $env:MARIADB_PORT="3333"; $env:MARIADB_DB="reunioes"; `
 *   $env:MARIADB_USER="reunioes_app"; $env:MARIADB_PASS="your_password"; `
 *   $env:DB_PATH="D:\data\meetinglog.sqlite"; node scripts/migrate-mariadb-to-sqlite.js
 */
import mysql from 'mysql2/promise'
import Database from 'better-sqlite3'
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
  console.error('Missing required environment variables: MARIADB_HOST, MARIADB_DB, MARIADB_USER, MARIADB_PASS')
  process.exit(1)
}

console.log(`[migrate] Connecting to MariaDB at ${MARIADB_HOST}:${MARIADB_PORT}/${MARIADB_DB}...`)
const mariadb = await mysql.createConnection({
  host: MARIADB_HOST,
  port: MARIADB_PORT,
  database: MARIADB_DB,
  user: MARIADB_USER,
  password: MARIADB_PASS,
  charset: 'utf8mb4'
})

mkdirSync(dirname(DB_PATH), { recursive: true })
console.log(`[migrate] Opening SQLite at ${DB_PATH}...`)
const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = OFF') // Disabled during bulk import

// Apply the SQLite schema
const schemaSql = readFileSync(join(__dirname, '../migrations/001_sqlite_init.sql'), 'utf8')
sqlite.exec(schemaSql)
console.log('[migrate] SQLite schema applied.')

// Helper: format MariaDB DATETIME to ISO string SQLite can store
function fmtDt(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19)
  return String(v)
}

function migrate(table, mariaRows, insertFn) {
  console.log(`[migrate] ${table}: ${mariaRows.length} rows...`)
  const tx = sqlite.transaction(() => {
    for (const row of mariaRows) insertFn(row)
  })
  tx()
}

// ── instituicao ───────────────────────────────────────────────────────────────
const [instRows] = await mariadb.query('SELECT id, sigla, nome, criado_em FROM instituicao')
const instInsert = sqlite.prepare('INSERT OR IGNORE INTO instituicao (id, sigla, nome, criado_em) VALUES (?, ?, ?, ?)')
migrate('instituicao', instRows, r => instInsert.run(r.id, r.sigla, r.nome ?? null, fmtDt(r.criado_em)))

// ── participante ─────────────────────────────────────────────────────────────
const [partRows] = await mariadb.query('SELECT id, nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas, criado_em FROM participante')
const partInsert = sqlite.prepare('INSERT OR IGNORE INTO participante (id, nome, instituicao, lotacao, cargo, email, ativo, ativo_manual, notas, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
migrate('participante', partRows, r => partInsert.run(r.id, r.nome, r.instituicao ?? null, r.lotacao ?? null, r.cargo ?? null, r.email ?? null, r.ativo ? 1 : 0, r.ativo_manual ? 1 : 0, r.notas ?? null, fmtDt(r.criado_em)))

// ── projeto ───────────────────────────────────────────────────────────────────
const [projRows] = await mariadb.query('SELECT id, nome, ativo, notas, criado_em FROM projeto')
const projInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto (id, nome, ativo, notas, criado_em) VALUES (?, ?, ?, ?, ?)')
migrate('projeto', projRows, r => projInsert.run(r.id, r.nome, r.ativo ? 1 : 0, r.notas ?? null, fmtDt(r.criado_em)))

// ── projeto_instituicao ───────────────────────────────────────────────────────
const [piRows] = await mariadb.query('SELECT projeto_id, instituicao_id FROM projeto_instituicao')
const piInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto_instituicao (projeto_id, instituicao_id) VALUES (?, ?)')
migrate('projeto_instituicao', piRows, r => piInsert.run(r.projeto_id, r.instituicao_id))

// ── reuniao ───────────────────────────────────────────────────────────────────
const [reuniaoRows] = await mariadb.query('SELECT id, data_hora, tipo, notas, criado_em, atualizado_em FROM reuniao')
const reuniaoInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao (id, data_hora, tipo, notas, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
migrate('reuniao', reuniaoRows, r => reuniaoInsert.run(r.id, fmtDt(r.data_hora), r.tipo, r.notas ?? null, fmtDt(r.criado_em), fmtDt(r.atualizado_em)))

// ── reuniao_participante ──────────────────────────────────────────────────────
const [rpRows] = await mariadb.query('SELECT reuniao_id, participante_id FROM reuniao_participante')
const rpInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao_participante (reuniao_id, participante_id) VALUES (?, ?)')
migrate('reuniao_participante', rpRows, r => rpInsert.run(r.reuniao_id, r.participante_id))

// ── reuniao_projeto ───────────────────────────────────────────────────────────
const [rpjRows] = await mariadb.query('SELECT reuniao_id, projeto_id FROM reuniao_projeto')
const rpjInsert = sqlite.prepare('INSERT OR IGNORE INTO reuniao_projeto (reuniao_id, projeto_id) VALUES (?, ?)')
migrate('reuniao_projeto', rpjRows, r => rpjInsert.run(r.reuniao_id, r.projeto_id))

// ── pauta ─────────────────────────────────────────────────────────────────────
const [pautaRows] = await mariadb.query('SELECT id, reuniao_id, texto, ordem, criado_em FROM pauta')
const pautaInsert = sqlite.prepare('INSERT OR IGNORE INTO pauta (id, reuniao_id, texto, ordem, criado_em) VALUES (?, ?, ?, ?, ?)')
migrate('pauta', pautaRows, r => pautaInsert.run(r.id, r.reuniao_id, r.texto, r.ordem, fmtDt(r.criado_em)))

// ── link ──────────────────────────────────────────────────────────────────────
const [linkRows] = await mariadb.query('SELECT id, reuniao_id, nome, url, ordem, criado_em FROM link')
const linkInsert = sqlite.prepare('INSERT OR IGNORE INTO link (id, reuniao_id, nome, url, ordem, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
migrate('link', linkRows, r => linkInsert.run(r.id, r.reuniao_id, r.nome ?? null, r.url, r.ordem, fmtDt(r.criado_em)))

// ── projeto_link ──────────────────────────────────────────────────────────────
const [plRows] = await mariadb.query('SELECT id, projeto_id, nome, url, ordem, criado_em FROM projeto_link')
const plInsert = sqlite.prepare('INSERT OR IGNORE INTO projeto_link (id, projeto_id, nome, url, ordem, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
migrate('projeto_link', plRows, r => plInsert.run(r.id, r.projeto_id, r.nome ?? null, r.url, r.ordem, fmtDt(r.criado_em)))

// ── arquivo ───────────────────────────────────────────────────────────────────
const [arquivoRows] = await mariadb.query('SELECT id, reuniao_id, filename_original, filename_stored, letter, mime_type, file_size, criado_em FROM arquivo')
const arquivoInsert = sqlite.prepare('INSERT OR IGNORE INTO arquivo (id, reuniao_id, filename_original, filename_stored, letter, mime_type, file_size, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
migrate('arquivo', arquivoRows, r => {
  const letter = r.letter instanceof Buffer ? r.letter.toString() : String(r.letter)
  arquivoInsert.run(r.id, r.reuniao_id, r.filename_original, r.filename_stored, letter, r.mime_type, r.file_size, fmtDt(r.criado_em))
})

// Re-enable foreign keys and verify integrity
sqlite.pragma('foreign_keys = ON')
const integrity = sqlite.prepare('PRAGMA foreign_key_check').all()
if (integrity.length > 0) {
  console.warn('[migrate] Foreign key violations found:', integrity)
} else {
  console.log('[migrate] Foreign key integrity check passed.')
}

await mariadb.end()
sqlite.close()
console.log('[migrate] Migration complete! SQLite file:', DB_PATH)
