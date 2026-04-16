#!/usr/bin/env node
/**
 * generate-icons.mjs
 * Generates icon.ico (multi-resolution) and icon.png (512px) from icon.svg
 * Uses sharp (already a dep via @excalidraw) — no external tools needed.
 *
 * Usage: node apps/desktop/scripts/generate-icons.mjs
 */

import { createRequire } from "module";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, "../build");
const svgPath = join(buildDir, "icon.svg");

console.log("Inkflow Icon Generator");
console.log("======================");
console.log(`Source: ${svgPath}`);

const svgBuffer = readFileSync(svgPath);

// --- 1. Generate PNG at each ICO resolution ---
const icoSizes = [16, 32, 48, 64, 128, 256];
const pngBuffers = [];

console.log("\nGenerating PNGs...");
for (const size of icoSizes) {
  const buf = await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toBuffer();
  pngBuffers.push({ size, buf });
  console.log(`  ✓ ${size}x${size} (${buf.length} bytes)`);
}

// --- 2. Generate 512px PNG for AboutDialog ---
const png512 = await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toBuffer();
const png512Path = join(buildDir, "icon.png");
writeFileSync(png512Path, png512);
console.log(`  ✓ 512x512 → icon.png (${png512.length} bytes)`);

// --- 3. Compose .ico from PNG buffers ---
// ICO format reference: https://en.wikipedia.org/wiki/ICO_(file_format)
// Header: 6 bytes
// Directory entries: 16 bytes × N
// Image data: concatenated PNGs (modern ICO supports PNG compression)

function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const headerAndDir = headerSize + dirEntrySize * count;

  // Calculate offsets
  let offset = headerAndDir;
  const entries = images.map(({ size, buf }) => {
    const entry = { size, buf, offset };
    offset += buf.length;
    return entry;
  });

  const totalSize = offset;
  const ico = Buffer.allocUnsafe(totalSize);

  // ICONDIR header
  ico.writeUInt16LE(0, 0); // Reserved
  ico.writeUInt16LE(1, 2); // Type: 1 = ICO
  ico.writeUInt16LE(count, 4); // Number of images

  // ICONDIRENTRY for each image
  entries.forEach(({ size, buf, offset }, i) => {
    const base = headerSize + i * dirEntrySize;
    ico.writeUInt8(size === 256 ? 0 : size, base + 0); // Width (0 = 256)
    ico.writeUInt8(size === 256 ? 0 : size, base + 1); // Height (0 = 256)
    ico.writeUInt8(0, base + 2); // Color count (0 = no palette)
    ico.writeUInt8(0, base + 3); // Reserved
    ico.writeUInt16LE(1, base + 4); // Color planes
    ico.writeUInt16LE(32, base + 6); // Bits per pixel
    ico.writeUInt32LE(buf.length, base + 8); // Size of image data
    ico.writeUInt32LE(offset, base + 12); // Offset of image data
    buf.copy(ico, offset);
  });

  return ico;
}

const icoBuffer = buildIco(pngBuffers);
const icoPath = join(buildDir, "icon.ico");
writeFileSync(icoPath, icoBuffer);
console.log(`\n✓ icon.ico written (${icoBuffer.length} bytes, ${icoSizes.length} sizes: ${icoSizes.join(", ")}px)`);

// --- 4. Validate ---
const readBack = readFileSync(icoPath);
const magic = readBack.readUInt16LE(2);
const numImages = readBack.readUInt16LE(4);
if (magic !== 1) throw new Error(`ICO magic mismatch: expected 1, got ${magic}`);
if (numImages !== icoSizes.length) throw new Error(`ICO image count: expected ${icoSizes.length}, got ${numImages}`);

console.log(`✓ Validation passed: ICO type=${magic}, images=${numImages}`);

// --- 5. Generate .icns for macOS ---
// ICNS format: magic "icns" header + ic10 entry (1024x1024 PNG)
console.log("\nGenerating .icns for macOS...");
const png1024 = await sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toBuffer();
console.log(`  ✓ 1024x1024 PNG buffer (${png1024.length} bytes)`);

function buildIcns(pngBuffer) {
  const type = Buffer.from("ic10", "ascii"); // 1024x1024 retina icon
  const entrySize = pngBuffer.length + 8; // 4 bytes type + 4 bytes size + PNG data
  const totalSize = 8 + entrySize; // 4 bytes magic + 4 bytes file size + entry

  const icns = Buffer.allocUnsafe(totalSize);

  // File header
  icns.write("icns", 0, 4, "ascii"); // Magic
  icns.writeUInt32BE(totalSize, 4); // Total file size

  // ic10 entry
  type.copy(icns, 8); // Entry type
  icns.writeUInt32BE(entrySize, 12); // Entry size (including type + size fields)
  pngBuffer.copy(icns, 16); // Raw PNG data

  return icns;
}

const icnsBuffer = buildIcns(png1024);
const icnsPath = join(buildDir, "icon.icns");
writeFileSync(icnsPath, icnsBuffer);
console.log(`✓ icon.icns written (${icnsBuffer.length} bytes)`);

// Validate .icns
const readBackIcns = readFileSync(icnsPath);
const icnsMagic = readBackIcns.toString("ascii", 0, 4);
if (icnsMagic !== "icns") throw new Error(`ICNS magic mismatch: expected "icns", got "${icnsMagic}"`);
console.log(`✓ ICNS validation passed: magic="${icnsMagic}"`);

console.log("\nDone. Files written:");
console.log(`  ${icoPath}`);
console.log(`  ${png512Path}`);
console.log(`  ${icnsPath}`);
