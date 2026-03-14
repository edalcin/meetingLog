import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32BE(n)
  return b
}

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[i] = c
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const crcBuf = Buffer.concat([t, d])
  return Buffer.concat([uint32BE(d.length), t, d, uint32BE(crc32(crcBuf))])
}

function createPNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const rowSize = width * 3
  const raw = Buffer.allocUnsafe(height * (rowSize + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (rowSize + 1)] = 0
    for (let x = 0; x < width; x++) {
      const off = y * (rowSize + 1) + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }
  const compressed = deflateSync(raw)
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public/icons', { recursive: true })
const icons = [
  ['public/icons/icon-192.png', 192, 192],
  ['public/icons/icon-512.png', 512, 512],
  ['public/icons/apple-touch-icon.png', 180, 180]
]
for (const [path, w, h] of icons) {
  writeFileSync(path, createPNG(w, h, 0x1e, 0x40, 0xaf))
  console.log('Generated', path)
}
