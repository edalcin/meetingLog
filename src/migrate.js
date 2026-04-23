import Database from 'better-sqlite3'
import { mkdirSync, readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DB_PATH || '/data/db/meetinglog.sqlite'
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

const migrationsDir = join(__dirname, '../migrations')
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM schema_migrations WHERE filename = ?').get(file)
  if (row.c > 0) {
    console.log(`[migrate] Skip: ${file}`)
    continue
  }
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  try {
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file)
    console.log(`[migrate] Applied: ${file}`)
  } catch (err) {
    console.error(`[migrate] Failed on ${file}:`, err.message)
    process.exit(1)
  }
}

db.close()
console.log('[migrate] Done')
