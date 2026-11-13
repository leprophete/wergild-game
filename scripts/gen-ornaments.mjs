// Web-sized copies of the illuminated ornaments (the originals in public/ornaments stay untouched).
// Usage: node scripts/gen-ornaments.mjs
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const out = "public/ornaments/web";
await mkdir(out, { recursive: true });
const jobs = [
  ["map_frame", { width: 2400 }],
  ["map_rider", { height: 1400 }],
  ["ranking_frame", { width: 1400 }],
  ["ranking_scribe", { width: 640 }],
  ["dropcap", { width: 256 }],
  ["chronicle_scroll", { width: 1400 }],
  ["wax_seal", { width: 360 }],
];
for (const [name, size] of jobs) {
  const info = await sharp(`public/ornaments/${name}.webp`).resize({ ...size, kernel: "lanczos3" }).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toFile(`${out}/${name}.webp`);
  console.log(name, info.width, "×", info.height, Math.round(info.size / 1024), "kB");
}
