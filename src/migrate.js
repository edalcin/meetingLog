import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, readFileSync } from 'fs'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true
})

const migrationsDir = join(__dirname, '../migrations')
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

for (const file of files) {
  const [[row]] = await conn.query(
    'SELECT COUNT(*) AS c FROM schema_migrations WHERE filename = ?', [file]
  ).catch(() => [[{ c: 0 }]])

  if (row.c > 0) {
    console.log(`[migrate] Skip: ${file}`)
    continue
  }

  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  await conn.query(sql)
  await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
  console.log(`[migrate] Applied: ${file}`)
}

await conn.end()
console.log('[migrate] Done')
