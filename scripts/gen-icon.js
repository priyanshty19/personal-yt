'use strict';

// Generates a macOS menu-bar "template" icon (black pixels + alpha) as PNGs,
// with no third-party dependencies. Template images let macOS recolor the
// glyph automatically for light/dark menu bars.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 16x16 eighth-note glyph. '#' = opaque black, '.' = transparent.
const GLYPH = [
  '................',
  '................',
  '.........##.....',
  '.........###....',
  '.........####...',
  '.........##.##..',
  '.........##..#..',
  '.........##.....',
  '.........##.....',
  '.........##.....',
  '...###...##.....',
  '..#####..##.....',
  '.#######.##.....',
  '.#######.#......',
  '..#####.........',
  '...###..........',
];

// --- CRC32 (PNG spec) -------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Build an RGBA PNG from the glyph at the given integer scale.
function makePNG(scale) {
  const w = GLYPH[0].length * scale;
  const h = GLYPH.length * scale;

  // Raw image data with a 0 (None) filter byte per scanline.
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h, 0);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter
    const gy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const gx = (x / scale) | 0;
      const on = GLYPH[gy][gx] === '#';
      const o = y * stride + 1 + x * 4;
      raw[o] = 0; // R
      raw[o + 1] = 0; // G
      raw[o + 2] = 0; // B
      raw[o + 3] = on ? 255 : 0; // A
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12 = compression/filter/interlace = 0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'trayTemplate.png'), makePNG(1)); // 16x16
fs.writeFileSync(path.join(outDir, 'trayTemplate@2x.png'), makePNG(2)); // 32x32
console.log('Wrote build/trayTemplate.png and build/trayTemplate@2x.png');
