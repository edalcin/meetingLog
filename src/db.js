import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

export const DB_PATH = process.env.DB_PATH || '/data/db/meetinglog.sqlite'

try { mkdirSync(dirname(DB_PATH), { recursive: true }) } catch { /* entrypoint creates the dir as root */ }

function openDB() {
  const instance = new Database(DB_PATH)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  return instance
}

let _db = openDB()

export function reloadDB() {
  if (_db.open) _db.close()
  _db = openDB()
}

// Proxy so all existing `import db from '../db.js'` consumers automatically
// use the current _db instance after a hot-reload (reloadDB()).
const db = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined // prevent Promise-unwrap
    const val = _db[prop]
    return typeof val === 'function' ? val.bind(_db) : val
  }
})

export default db
