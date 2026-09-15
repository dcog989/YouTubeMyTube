import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'assets/icons');
const SIZES = [16, 48, 128];
const SUPERSAMPLE = 4;

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

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

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

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function renderIcon(size) {
  const hi = size * SUPERSAMPLE;
  const hiBuf = new Uint8ClampedArray(hi * hi * 4);
  const center = hi / 2;
  const radius = hi * 0.48;
  const barHalf = hi * 0.055;

  for (let y = 0; y < hi; y += 1) {
    for (let x = 0; x < hi; x += 1) {
      const offset = (y * hi + x) * 4;
      const inCircle = Math.hypot(x + 0.5 - center, y + 0.5 - center) <= radius;
      if (!inCircle) continue;

      const onBar =
        distanceToSegment(x + 0.5, y + 0.5, hi * 0.3, hi * 0.3, hi * 0.7, hi * 0.7) <= barHalf;

      if (onBar) {
        hiBuf[offset] = 255;
        hiBuf[offset + 1] = 255;
        hiBuf[offset + 2] = 255;
        hiBuf[offset + 3] = 255;
      } else {
        hiBuf[offset] = 229;
        hiBuf[offset + 1] = 57;
        hiBuf[offset + 2] = 53;
        hiBuf[offset + 3] = 255;
      }
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
          r += hiBuf[offset];
          g += hiBuf[offset + 1];
          b += hiBuf[offset + 2];
          a += hiBuf[offset + 3];
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

export function generateIcons() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    writeFileSync(resolve(OUT_DIR, `${size}.png`), renderIcon(size));
  }
  return SIZES.map((size) => resolve(OUT_DIR, `${size}.png`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = generateIcons();
  console.log(`Generated ${files.length} icons in ${OUT_DIR}`);
}
