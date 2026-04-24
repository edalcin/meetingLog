import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createReadStream, statSync } from 'fs'
import { writeFile, unlink, rename } from 'fs/promises'
import { join, dirname } from 'path'
import { Readable } from 'stream'
import db, { DB_PATH, reloadDB } from '../db.js'

const maintenance = new Hono()

// POST /api/maintenance/replace-project
maintenance.post('/replace-project', async (c) => {
  const body = await c.req.json()
  const from_id  = Number(body.from_id)
  const to_id    = Number(body.to_id)
  const dry_run  = body.dry_run

  if (!from_id || !to_id) return c.json({ error: 'from_id e to_id são obrigatórios' }, 400)
  if (from_id === to_id)  return c.json({ error: 'from_id e to_id devem ser diferentes' }, 400)
  if (typeof dry_run !== 'boolean') return c.json({ error: 'dry_run deve ser boolean' }, 400)

  const fromRow = db.prepare('SELECT id FROM projeto WHERE id = ?').get(from_id)
  if (!fromRow) return c.json({ error: 'Projeto de origem não encontrado' }, 400)

  const toRow = db.prepare('SELECT id FROM projeto WHERE id = ?').get(to_id)
  if (!toRow) return c.json({ error: 'Projeto de destino não encontrado' }, 400)

  if (dry_run) {
    const rows = db.prepare(
      `SELECT r.id,
              strftime('%d/%m/%Y, %H:%M', r.data_hora) AS data_fmt,
              COALESCE((SELECT GROUP_CONCAT(nome, ', ') FROM (SELECT DISTINCT p2.nome FROM participante p2 JOIN reuniao_participante rp2 ON rp2.participante_id = p2.id WHERE rp2.reuniao_id = r.id ORDER BY p2.nome)), '—') AS participantes_nomes
       FROM reuniao r
       JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
       WHERE rp.projeto_id = ?
       ORDER BY r.data_hora DESC`
    ).all(from_id)
    return c.json({ affected: rows, count: rows.length })
  }

  db.transaction(() => {
    // Delete associations for meetings that already have the destination project (avoid duplicate key)
    db.prepare(
      `DELETE FROM reuniao_projeto
       WHERE projeto_id = ? AND reuniao_id IN (
         SELECT reuniao_id FROM reuniao_projeto WHERE projeto_id = ?
       )`
    ).run(from_id, to_id)

    // Remap remaining associations
    db.prepare('UPDATE reuniao_projeto SET projeto_id = ? WHERE projeto_id = ?').run(to_id, from_id)
  })()

  return c.json({ updated: true })
})

// GET /api/maintenance/backup
maintenance.get('/backup', async (c) => {
  const tmpPath = join('/tmp', `meetinglog-backup-${Date.now()}.sqlite`)
  try {
    await db.backup(tmpPath)
    const size = statSync(tmpPath).size
    const date = new Date().toISOString().slice(0, 10)
    const stream = createReadStream(tmpPath)
    setTimeout(() => unlink(tmpPath).catch(() => {}), 10000)
    return new Response(Readable.toWeb(stream), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="meetinglog-backup-${date}.sqlite"`,
        'Content-Length': String(size)
      }
    })
  } catch (err) {
    await unlink(tmpPath).catch(() => {})
    throw err
  }
})

// POST /api/maintenance/restore
maintenance.post(
  '/restore',
  bodyLimit({ maxSize: 512 * 1024 * 1024, onError: (c) => c.json({ error: 'Arquivo muito grande (máx 512 MB).' }, 413) }),
  async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    const confirm = body['confirm']

    if (confirm !== 'REPLACE') return c.json({ error: 'Confirmação necessária: envie confirm=REPLACE' }, 400)
    if (!file || !(file instanceof File)) return c.json({ error: 'Arquivo não enviado' }, 400)

    const buffer = await file.arrayBuffer()
    const magic = new Uint8Array(buffer, 0, 16)
    const expected = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0]
    const valid = expected.every((b, i) => magic[i] === b)
    if (!valid) return c.json({ error: 'Arquivo não é um banco SQLite válido' }, 400)

    const tmpPath = join(dirname(DB_PATH), `meetinglog-restore-${Date.now()}.sqlite.tmp`)
    await writeFile(tmpPath, Buffer.from(buffer))

    try {
      db.close()
      // Remove stale WAL/SHM from the old DB so they aren't misapplied to the restored file
      await unlink(`${DB_PATH}-wal`).catch(() => {})
      await unlink(`${DB_PATH}-shm`).catch(() => {})
      await rename(tmpPath, DB_PATH)
    } catch (err) {
      await unlink(tmpPath).catch(() => {})
      reloadDB() // re-open old DB since we closed it
      throw err
    }

    reloadDB() // hot-swap: open the restored DB without restarting the server
    return c.json({ ok: true, message: 'Restauração concluída.' })
  }
)

export default maintenance
