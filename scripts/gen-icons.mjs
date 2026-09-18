import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'assets/icons');
export const ICON_SIZES = [16, 32, 48, 64, 96, 128];
const SUPERSAMPLE = 4;

const LOZENGE_WIDTH = 0.88;
const LOZENGE_HEIGHT = 0.6;
const LOZENGE_CORNER_RADIUS = 0.14;

const GLYPH_BOX = 0.48;
const GLYPH_VIEWBOX = 24;
const LUCIDE_UNIT = GLYPH_BOX / GLYPH_VIEWBOX;
const RING_RADIUS = 10 * LUCIDE_UNIT;
// Lucide uses 2/1 units; widened so the ring and dots survive at 16px.
const RING_STROKE = 3.2 * LUCIDE_UNIT;
const DOT_RADIUS = 1.7 * LUCIDE_UNIT;
const DOT_OFFSET = 5 * LUCIDE_UNIT;

const LOZENGE_COLOR = { r: 224, g: 49, b: 64 };
const GLYPH_COLOR = { r: 255, g: 255, b: 255 };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Buffer} buffer
 * @returns {number}
 */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (buffer[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} type
 * @param {Buffer} data
 * @returns {Buffer}
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba
 * @returns {Buffer}
 */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} cx
 * @param {number} cy
 * @param {number} halfWidth
 * @param {number} halfHeight
 * @param {number} radius
 * @returns {boolean}
 */
function inRoundedRect(px, py, cx, cy, halfWidth, halfHeight, radius) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  if (dx > halfWidth || dy > halfHeight) return false;
  const innerX = halfWidth - radius;
  const innerY = halfHeight - radius;
  if (dx <= innerX || dy <= innerY) return true;
  return Math.hypot(dx - innerX, dy - innerY) <= radius;
}

/**
 * @param {number} size
 * @returns {Buffer}
 */
function renderIcon(size) {
  const hi = size * SUPERSAMPLE;
  const hiBuf = new Uint8ClampedArray(hi * hi * 4);
  const center = hi / 2;

  const halfWidth = hi * (LOZENGE_WIDTH / 2);
  const halfHeight = hi * (LOZENGE_HEIGHT / 2);
  const cornerRadius = hi * LOZENGE_CORNER_RADIUS;
  const ringInner = hi * (RING_RADIUS - RING_STROKE / 2);
  const ringOuter = hi * (RING_RADIUS + RING_STROKE / 2);
  const dotRadius = hi * DOT_RADIUS;
  const dotOffset = hi * DOT_OFFSET;
  const dotCenters = [center - dotOffset, center, center + dotOffset];

  for (let y = 0; y < hi; y += 1) {
    for (let x = 0; x < hi; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (!inRoundedRect(px, py, center, center, halfWidth, halfHeight, cornerRadius)) continue;

      const offset = (y * hi + x) * 4;
      const radius = Math.hypot(px - center, py - center);
      const onRing = radius >= ringInner && radius <= ringOuter;
      const onDot = dotCenters.some((dotX) => Math.hypot(px - dotX, py - center) <= dotRadius);
      const isGlyph = onRing || onDot;

      hiBuf[offset] = isGlyph ? GLYPH_COLOR.r : LOZENGE_COLOR.r;
      hiBuf[offset + 1] = isGlyph ? GLYPH_COLOR.g : LOZENGE_COLOR.g;
      hiBuf[offset + 2] = isGlyph ? GLYPH_COLOR.b : LOZENGE_COLOR.b;
      hiBuf[offset + 3] = 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const offset = ((y * SUPERSAMPLE + sy) * hi + (x * SUPERSAMPLE + sx)) * 4;
          r += hiBuf[offset] ?? 0;
          g += hiBuf[offset + 1] ?? 0;
          b += hiBuf[offset + 2] ?? 0;
          a += hiBuf[offset + 3] ?? 0;
        }
      }
      const outOffset = (y * size + x) * 4;
      out[outOffset] = Math.round(r / samples);
      out[outOffset + 1] = Math.round(g / samples);
      out[outOffset + 2] = Math.round(b / samples);
      out[outOffset + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, out);
}

/**
 * @returns {string[]}
 */
export function generateIcons() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of ICON_SIZES) {
    writeFileSync(resolve(OUT_DIR, `${size}.png`), renderIcon(size));
  }
  return ICON_SIZES.map((size) => resolve(OUT_DIR, `${size}.png`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = generateIcons();
  console.log(`Generated ${files.length} icons in ${OUT_DIR}`);
}
