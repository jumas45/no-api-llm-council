// Generates the extension icon set (no external deps — pure Node + zlib).
// Design: three glowing orbs (ChatGPT green, Claude orange, Gemini blue) in a
// triad, additively blended on a dark rounded tile. Supersampled 4x for smooth
// edges. Run: `npm run icons`.

import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

const SS = 4 // supersample factor for anti-aliasing
const SIZES = [16, 32, 48, 128]

const ORB_COLORS = [
  [16, 163, 127], // ChatGPT green
  [217, 119, 87], // Claude orange
  [66, 133, 244], // Gemini blue
]

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))

function insideRoundRect(px, py, x, y, w, h, rad) {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const minx = x + rad
  const maxx = x + w - rad
  const miny = y + rad
  const maxy = y + h - rad
  if (px < minx && py < miny) return Math.hypot(px - minx, py - miny) <= rad
  if (px > maxx && py < miny) return Math.hypot(px - maxx, py - miny) <= rad
  if (px < minx && py > maxy) return Math.hypot(px - minx, py - maxy) <= rad
  if (px > maxx && py > maxy) return Math.hypot(px - maxx, py - maxy) <= rad
  return true
}

function renderHiRes(S) {
  const buf = Buffer.alloc(S * S * 4)
  const cx = S / 2
  const cy = S / 2
  const orbRadius = S * 0.3
  const orbDist = S * 0.2
  const centers = [-90, 30, 150].map((deg) => {
    const r = (deg * Math.PI) / 180
    return [cx + Math.cos(r) * orbDist, cy + Math.sin(r) * orbDist]
  })
  const margin = S * 0.06
  const corner = S * 0.22

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 12
      let g = 16
      let b = 26
      let a = 0
      if (insideRoundRect(x, y, margin, margin, S - 2 * margin, S - 2 * margin, corner)) {
        const t = y / S
        r = 12 + t * 8
        g = 16 + t * 10
        b = 26 + t * 18
        a = 255
        for (let i = 0; i < 3; i++) {
          const [ox, oy] = centers[i]
          const d = Math.hypot(x - ox, y - oy)
          const intensity = Math.max(0, 1 - d / orbRadius)
          // Soft halo plus a tight, bright core so each orb reads distinctly.
          const halo = Math.pow(intensity, 1.6) * 1.25
          const core = Math.pow(intensity, 5) * 1.4
          const glow = halo + core
          r += ORB_COLORS[i][0] * glow + 255 * core * 0.25
          g += ORB_COLORS[i][1] * glow + 255 * core * 0.25
          b += ORB_COLORS[i][2] * glow + 255 * core * 0.25
        }
      }
      const idx = (y * S + x) * 4
      buf[idx] = clamp(r)
      buf[idx + 1] = clamp(g)
      buf[idx + 2] = clamp(b)
      buf[idx + 3] = a
    }
  }
  return buf
}

// Box-downsample the SS-supersampled buffer to the target size (anti-aliasing).
function downsample(hi, S, size) {
  const out = Buffer.alloc(size * size * 4)
  const n = SS * SS
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const idx = ((y * SS + dy) * S + (x * SS + dx)) * 4
          r += hi[idx]
          g += hi[idx + 1]
          b += hi[idx + 2]
          a += hi[idx + 3]
        }
      }
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Add filter byte (0) per scanline.
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const S = size * SS
  const hi = renderHiRes(S)
  const rgba = downsample(hi, S, size)
  const png = encodePNG(size, rgba)
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), png)
  console.log(`wrote icons/icon-${size}.png (${png.length} bytes)`)
}
