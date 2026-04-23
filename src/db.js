import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

export const DB_PATH = process.env.DB_PATH || '/data/db/meetinglog.sqlite'

try { mkdirSync(dirname(DB_PATH), { recursive: true }) } catch { /* entrypoint creates the dir as root */ }

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
