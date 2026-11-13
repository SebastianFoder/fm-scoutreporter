/**
 * Makes the desktop app's icons from the website's icon (apps/web/app/icon.svg), so the exe, the
 * installer, the shortcuts, the taskbar and the window all show the Scout Reporter pitch mark
 * instead of Electron's logo:
 *
 *   build/icon.ico   every Windows size (16 to 256 px); electron-builder uses it for the exe and installer
 *   build/icon.png   512 px, the window icon in development (the installed app takes the exe's icon)
 *
 * The outputs are committed. Run again after changing icon.svg:
 *
 *   node apps/desktop/scripts/make-icon.mjs
 *
 * Uses sharp, which Next.js already installs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(desktopDir, "..", "web", "app", "icon.svg"));
const outDir = join(desktopDir, "build");
mkdirSync(outDir, { recursive: true });

/** The 24-unit SVG drawn at `size` px: rendered at that size directly, so small icons stay sharp. */
const png = (size) =>
  sharp(svg, { density: (72 * size) / 24 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

/** An .ico holding PNG images (supported since Windows Vista), largest last. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // no palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })));
writeFileSync(join(outDir, "icon.ico"), ico(images));
writeFileSync(join(outDir, "icon.png"), await png(512));
console.log(`Wrote build/icon.ico (${sizes.join(", ")} px) and build/icon.png (512 px).`);
