import { execFile } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

/**
 * Generate a 200x200 JPEG thumbnail from an uploaded file.
 * @param {string} storedPath  Absolute path to the stored original file
 * @param {string} thumbPath   Absolute path where the thumbnail should be written
 * @param {string} mimeType    MIME type of the original file
 */
export async function generateThumbnail(storedPath, thumbPath, mimeType) {
  if (mimeType === 'application/pdf') {
    // Use pdftoppm (from poppler-utils) to render page 1 to a temp JPEG,
    // then resize with sharp. pdftoppm appends .jpg to the output base path.
    const tempBase = `/tmp/thumb-${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      await execFileAsync('pdftoppm', [
        '-singlefile', '-f', '1', '-l', '1', '-jpeg',
        storedPath, tempBase
      ])
      await sharp(`${tempBase}.jpg`)
        .resize(200, 200, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
    } finally {
      await unlink(`${tempBase}.jpg`).catch(() => {})
    }
  } else {
    // PNG or JPEG — resize directly with sharp
    await sharp(storedPath)
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath)
  }
}
