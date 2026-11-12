// Builds the map illustration pyramid from the 4x master (6344 × 3968):
//   public/map/world@1x.webp  ~1586 px wide — overview, phones, small previews
//   public/map/world@2x.webp  ~3172 px wide — medium zoom
//   public/map/tiles/4x/{col}_{row}.webp — the master cut into 1024 px tiles, loaded only
//                                          when zoomed in, only where you look
// Usage: node scripts/gen-map-images.mjs ~/Desktop/wergild_visual_assets/web_ready/map/world@4x.webp
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/gen-map-images.mjs <world@4x.webp>");
const out = path.resolve("public/map");
const TILE = 1024;

const master = sharp(src, { limitInputPixels: false });
const { width, height } = await master.metadata();
console.log(`master ${width} × ${height}`);

for (const [name, w, q] of [
  ["world@1x.webp", Math.round(width / 4), 82],
  ["world@2x.webp", Math.round(width / 2), 80],
]) {
  await sharp(src).resize({ width: w, kernel: "lanczos3" }).webp({ quality: q, effort: 5 }).toFile(path.join(out, name));
  console.log(name, w);
}

const tilesDir = path.join(out, "tiles", "4x");
await rm(tilesDir, { recursive: true, force: true });
await mkdir(tilesDir, { recursive: true });
const cols = Math.ceil(width / TILE);
const rows = Math.ceil(height / TILE);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const left = c * TILE;
    const top = r * TILE;
    await sharp(src)
      .extract({ left, top, width: Math.min(TILE, width - left), height: Math.min(TILE, height - top) })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(tilesDir, `${c}_${r}.webp`));
  }
}
await writeFile(path.join(out, "tiles", "4x", "meta.json"), JSON.stringify({ width, height, tile: TILE, cols, rows }));
console.log(`tiles ${cols} × ${rows}`);
