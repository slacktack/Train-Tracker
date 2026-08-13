// Generates Train Tracker app icons (PNG) with zero dependencies.
// Usage: node scripts/gen-icons.mjs
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Minimal PNG encoder ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── Icon art ───────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

/** Draw a stylised loco (body + cab window + wheels + headlight) as RGBA. */
function drawIcon(size) {
  const px = new Float32Array(size * size * 4);
  const S = size;
  const bgTop = [0x63, 0x66, 0xf1];
  const bgBottom = [0x43, 0x38, 0xca];
  const white = [0xff, 0xff, 0xff];

  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const bg = [lerp(bgTop[0], bgBottom[0], t), lerp(bgTop[1], bgBottom[1], t), lerp(bgTop[2], bgBottom[2], t)];
    for (let x = 0; x < S; x++) {
      let r = bg[0], g = bg[1], b = bg[2], a = 255;

      const nx = x / S, ny = y / S;

      // Rounded-rect body
      const bodyD = roundedRectSDF(nx, ny, 0.5, 0.47, 0.28, 0.17, 0.09);
      if (bodyD < 0) {
        // subtle two-tone: nose gradient on the left
        const shade = 1 - Math.max(0, (0.22 - nx)) * 0.55;
        r = white[0] * shade; g = white[1] * shade; b = white[2] * shade;
        // soft anti-aliased edge
        if (bodyD > -0.012) {
          const cover = Math.min(1, -bodyD / 0.012);
          r = lerp(bg[0], r, cover); g = lerp(bg[1], g, cover); b = lerp(bg[2], b, cover);
        }
      }

      // Cab window (indigo rounded rect inside the body)
      const winD = roundedRectSDF(nx, ny, 0.5, 0.40, 0.17, 0.075, 0.035);
      if (winD < 0) {
        r = bgBottom[0]; g = bgBottom[1]; b = bgBottom[2];
        if (winD > -0.012) {
          const cover = Math.min(1, -winD / 0.012);
          r = lerp(r, bgBottom[0], cover); g = lerp(g, bgBottom[1], cover); b = lerp(b, bgBottom[2], cover);
        }
      }

      // Headlight (amber circle at front-bottom of body)
      const hx = nx - 0.68, hy = ny - 0.53;
      const headD = Math.hypot(hx, hy) - 0.035;
      if (headD < 0) {
        r = 0xff; g = 0xd6; b = 0x0a;
        if (headD > -0.01) {
          const cover = Math.min(1, -headD / 0.01);
          r = lerp(r, 0xff, cover); g = lerp(g, 0xd6, cover); b = lerp(b, 0x0a, cover);
        }
      }

      // Two wheels (dark circles hanging below the body)
      for (const wx of [0.39, 0.61]) {
        const dx = nx - wx, dy = ny - 0.62;
        const d = Math.hypot(dx, dy) - 0.05;
        if (d < 0) {
          r = 0x1e; g = 0x1b; b = 0x4b;
          if (d > -0.01) {
            const cover = Math.min(1, -d / 0.01);
            r = lerp(r, 0x1e, cover); g = lerp(g, 0x1b, cover); b = lerp(b, 0x4b, cover);
          }
        }
      }

      const i = (y * S + x) * 4;
      px[i] = Math.max(0, Math.min(255, Math.round(r)));
      px[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      px[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      px[i + 3] = a;
    }
  }
  return Buffer.from(px);
}

// ── Emit ───────────────────────────────────────────────────────────────────
const targets = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/apple-touch-icon.png', 180],
  ['app/icon.png', 512], // Next.js favicon convention
];

for (const [rel, size] of targets) {
  const out = join(root, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePNG(size, size, drawIcon(size)));
  console.log(`wrote ${rel} (${size}x${size})`);
}
