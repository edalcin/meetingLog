import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createReadStream, existsSync } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import { join, extname } from 'path'
import { Readable } from 'stream'
import db from '../db.js'
import { generateThumbnail } from '../services/thumbnails.js'

const files = new Hono()

const FILES_PATH = process.env.FILES_PATH || '/app/data/uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'application/pdf']

function detectMimeType(uint8Array) {
  if (uint8Array.length < 4) return null
  const b = uint8Array
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg'
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  return null
}

// List files for a meeting
files.get('/meetings/:meetingId/files', (c) => {
  const meetingId = Number(c.req.param('meetingId'))
  if (!meetingId) return c.json({ error: 'ID inválido' }, 400)
  const rows = db.prepare(
    `SELECT id, reuniao_id, filename_original, filename_stored, letter,
            mime_type, file_size, criado_em
     FROM arquivo WHERE reuniao_id = ? ORDER BY letter ASC`
  ).all(meetingId)
  return c.json(rows)
})

// Serve thumbnail
files.get('/files/:fileId/thumbnail', (c) => {
  const fileId = Number(c.req.param('fileId'))
  if (!fileId) return c.json({ error: 'ID inválido' }, 400)
  const row = db.prepare('SELECT filename_stored FROM arquivo WHERE id = ?').get(fileId)
  if (!row) return c.json({ error: 'Arquivo não encontrado' }, 404)
  const stem = row.filename_stored.replace(/\.[^.]+$/, '')
  const thumbPath = join(FILES_PATH, 'thumbnails', `${stem}.jpg`)
  if (!existsSync(thumbPath)) return c.json({ error: 'Thumbnail não encontrado' }, 404)
  const stream = createReadStream(thumbPath)
  return new Response(Readable.toWeb(stream), {
    headers: { 'Content-Type': 'image/jpeg' }
  })
})

// Serve original file
files.get('/files/:fileId/content', (c) => {
  const fileId = Number(c.req.param('fileId'))
  if (!fileId) return c.json({ error: 'ID inválido' }, 400)
  const row = db.prepare('SELECT filename_stored, mime_type FROM arquivo WHERE id = ?').get(fileId)
  if (!row) return c.json({ error: 'Arquivo não encontrado' }, 404)
  const filePath = join(FILES_PATH, row.filename_stored)
  if (!existsSync(filePath)) return c.json({ error: 'Arquivo não encontrado no disco' }, 404)
  const stream = createReadStream(filePath)
  return new Response(Readable.toWeb(stream), {
    headers: {
      'Content-Type': row.mime_type,
      'Content-Disposition': `inline; filename="${row.filename_stored}"`
    }
  })
})

// Upload file
files.post(
  '/meetings/:meetingId/files',
  bodyLimit({
    maxSize: MAX_FILE_SIZE,
    onError: (c) => c.json({ error: 'Arquivo muito grande. Limite: 10 MB.' }, 413)
  }),
  async (c) => {
    const meetingId = Number(c.req.param('meetingId'))
    if (!meetingId) return c.json({ error: 'ID inválido' }, 400)

    const body = await c.req.parseBody()
    const file = body['file']
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Nenhum arquivo enviado' }, 400)
    }

    if (!ALLOWED_MIMES.includes(file.type)) {
      return c.json({ error: 'Tipo de arquivo não permitido. Use PNG, JPG ou PDF.' }, 400)
    }

    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    const detectedMime = detectMimeType(uint8Array)
    if (!detectedMime) {
      return c.json({ error: 'Tipo de arquivo não permitido. Use PNG, JPG ou PDF.' }, 400)
    }

    const reunion = db.prepare(
      "SELECT id, strftime('%Y-%m-%d_%Hh%M', data_hora) AS base_filename FROM reuniao WHERE id = ?"
    ).get(meetingId)
    if (!reunion) return c.json({ error: 'Reunião não encontrada' }, 404)

    const letterRow = db.prepare(
      "SELECT COALESCE(MAX(letter), CHAR(96)) AS maxLetter FROM arquivo WHERE reuniao_id = ?"
    ).get(meetingId)
    const maxLetter = String(letterRow.maxLetter)
    const nextLetter = String.fromCharCode(maxLetter.charCodeAt(0) + 1)

    const origExt = (extname(file.name).toLowerCase()) ||
      (detectedMime === 'application/pdf' ? '.pdf' : detectedMime === 'image/png' ? '.png' : '.jpg')
    const filenameStored = `${reunion.base_filename}_${nextLetter}${origExt}`
    const storedPath = join(FILES_PATH, filenameStored)
    const thumbStem = `${reunion.base_filename}_${nextLetter}`
    const thumbPath = join(FILES_PATH, 'thumbnails', `${thumbStem}.jpg`)

    await writeFile(storedPath, Buffer.from(buffer))

    try {
      await generateThumbnail(storedPath, thumbPath, detectedMime)
    } catch (err) {
      console.error('[files] Thumbnail generation failed:', err)
      await unlink(storedPath).catch(() => {})
      return c.json({ error: 'Erro ao gerar thumbnail' }, 500)
    }

    const result = db.prepare(
      `INSERT INTO arquivo (reuniao_id, filename_original, filename_stored, letter, mime_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(meetingId, file.name, filenameStored, nextLetter, detectedMime, uint8Array.length)
    const created = db.prepare(
      `SELECT id, reuniao_id, filename_original, filename_stored, letter,
              mime_type, file_size, criado_em
       FROM arquivo WHERE id = ?`
    ).get(Number(result.lastInsertRowid))
    return c.json(created, 201)
  }
)

// Delete file
files.delete('/files/:fileId', async (c) => {
  const fileId = Number(c.req.param('fileId'))
  if (!fileId) return c.json({ error: 'ID inválido' }, 400)
  const row = db.prepare('SELECT filename_stored FROM arquivo WHERE id = ?').get(fileId)
  if (!row) return c.json({ error: 'Arquivo não encontrado' }, 404)

  const storedPath = join(FILES_PATH, row.filename_stored)
  const stem = row.filename_stored.replace(/\.[^.]+$/, '')
  const thumbPath = join(FILES_PATH, 'thumbnails', `${stem}.jpg`)

  await unlink(storedPath).catch(err => {
    if (err.code !== 'ENOENT') console.warn('[files] Could not delete file:', err.message)
  })
  await unlink(thumbPath).catch(err => {
    if (err.code !== 'ENOENT') console.warn('[files] Could not delete thumbnail:', err.message)
  })

  db.prepare('DELETE FROM arquivo WHERE id = ?').run(fileId)
  return c.json({ ok: true })
})

export default files
