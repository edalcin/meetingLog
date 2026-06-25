import { createRequire } from 'module'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dir = dirname(fileURLToPath(import.meta.url))
const src = join(__dir, '../meeting.png')
const pub = join(__dir, '../frontend/public')

mkdirSync(join(pub, 'icons'), { recursive: true })

// Standard PNGs
const pngJobs = [
  { size: 16,  out: 'favicon-16x16.png' },
  { size: 32,  out: 'favicon-32x32.png' },
  { size: 180, out: 'icons/apple-touch-icon.png' },
  { size: 192, out: 'icons/icon-192.png' },
  { size: 512, out: 'icons/icon-512.png' },
]

for (const { size, out } of pngJobs) {
  await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(join(pub, out))
  console.log(`✓ ${out}`)
}

// Maskable: icon at 80% centered on #f9fafb bg
const makeMaskable = async (size, outFile) => {
  const inner = Math.round(size * 0.8)
  const offset = Math.round(size * 0.1)
  const icon = await sharp(src).resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 249, g: 250, b: 251, alpha: 1 } }
  })
    .composite([{ input: icon, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(join(pub, outFile))
  console.log(`✓ ${outFile} (maskable)`)
}

await makeMaskable(192, 'icons/icon-maskable-192.png')
await makeMaskable(512, 'icons/icon-maskable-512.png')

// favicon.ico: embed 16, 32, 48 PNGs in ICO container
const icoSizes = [16, 32, 48]
const pngs = await Promise.all(icoSizes.map(s => sharp(src).resize(s, s).png().toBuffer()))

const numImages = pngs.length
let dataOffset = 6 + numImages * 16

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(numImages, 4)

const dirs = pngs.map((png, i) => {
  const s = icoSizes[i]
  const dir = Buffer.alloc(16)
  dir.writeUInt8(s >= 256 ? 0 : s, 0)
  dir.writeUInt8(s >= 256 ? 0 : s, 1)
  dir.writeUInt8(0, 2)
  dir.writeUInt8(0, 3)
  dir.writeUInt16LE(1, 4)
  dir.writeUInt16LE(32, 6)
  dir.writeUInt32LE(png.length, 8)
  dir.writeUInt32LE(dataOffset, 12)
  dataOffset += png.length
  return dir
})

writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([header, ...dirs, ...pngs]))
console.log('✓ favicon.ico (16+32+48)')

console.log('\nDone.')
