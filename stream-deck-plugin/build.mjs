#!/usr/bin/env node
/**
 * Build script: compiles TypeScript → single CJS bundle in the .sdPlugin dir,
 * then generates minimal placeholder PNG icons so Stream Deck software has
 * something to display in the action gallery.
 *
 * Usage:
 *   node build.mjs           # one-shot build
 *   node build.mjs --watch   # rebuild on source changes (dev)
 */

import esbuild from "esbuild";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const OUT_DIR = join(__dirname, "com.scorehub.sdPlugin", "bin");
mkdirSync(OUT_DIR, { recursive: true });

// ── esbuild ──────────────────────────────────────────────────────────────────

const buildOptions = {
  entryPoints: [join(__dirname, "src", "plugin.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: join(OUT_DIR, "plugin.mjs"),
  external: [
    // Stream Deck injects these at runtime; don't bundle them.
    "@elgato/streamdeck",
  ],
  logLevel: "info",
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("[ScoreHub] watching for changes…");
} else {
  await esbuild.build(buildOptions);
  generatePlaceholderIcons();
}

// ── Placeholder icon generator ────────────────────────────────────────────────
// Produces minimal 40×40 and 80×80 solid-colour PNGs. Real artwork should
// replace these before distribution, but they're sufficient for development
// and let the plugin appear correctly in the Stream Deck action gallery.

function generatePlaceholderIcons() {
  const icons = [
    { path: "imgs/plugin/icon.png",            color: [99, 102, 241] },  // indigo
    { path: "imgs/plugin/category.png",        color: [99, 102, 241] },
    { path: "imgs/actions/clock/key.png",      color: [99, 102, 241] },
    { path: "imgs/actions/clock/stopped.png",  color: [34, 197, 94] },   // green
    { path: "imgs/actions/clock/running.png",  color: [239, 68, 68] },   // red
    { path: "imgs/actions/score/key.png",      color: [245, 158, 11] },  // amber
    { path: "imgs/actions/period/key.png",     color: [129, 140, 248] }, // violet
  ];

  for (const { path: relPath, color } of icons) {
    const fullPath = join(__dirname, "com.scorehub.sdPlugin", relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeSolidPNG(fullPath, 40, 40, color[0], color[1], color[2]);

    // @2x variant at 80×80
    const path2x = fullPath.replace(".png", "@2x.png");
    writeSolidPNG(path2x, 80, 80, color[0], color[1], color[2]);
  }

  console.log("[ScoreHub] placeholder icons written");
}

/**
 * Writes a minimal RGB PNG using only Node's built-in zlib.
 * No external image library required.
 */
function writeSolidPNG(filePath, width, height, r, g, b) {
  // Build raw scanline data: filter byte (0x00 = None) + RGB pixels per row
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      raw[off + 1 + x * 3] = r;
      raw[off + 1 + x * 3 + 1] = g;
      raw[off + 1 + x * 3 + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw);
  const out = createWriteStream(filePath);

  // PNG signature
  out.write(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  writeChunk(out, "IHDR", ihdr);

  // IDAT
  writeChunk(out, "IDAT", idat);

  // IEND
  writeChunk(out, "IEND", Buffer.alloc(0));

  out.end();
}

function writeChunk(stream, type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  stream.write(len);
  stream.write(typeBytes);
  stream.write(data);

  // CRC32 over type + data
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  stream.write(crcBuf);
}

function crc32(buf) {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
