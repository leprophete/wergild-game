// The sea around the map, between the map and its illuminated frame (wide screens).
// The map's own outer sea is mirrored outward (seamless at the map's edge, since the
// outermost row and column of the map are open sea), then darkens softly toward the frame.
// Output: public/map/sea-surround.webp, covering the frame's rectangle (world units ×1.0326).
// Usage: node scripts/gen-sea-surround.mjs
import sharp from "sharp";

const WORLD_W = 1536, WORLD_H = 960;
// keep in sync with src/lib/map/illuminations.ts
const FRAME_SCALE = 1.34;
const FW = WORLD_W * FRAME_SCALE, FH = WORLD_H * FRAME_SCALE;
const FX = (WORLD_W - FW) / 2 - 16, FY = (WORLD_H - FH) / 2 - 64;

const src = sharp("public/map/world@1x.webp").removeAlpha();
const { data: S, info } = await src.raw().toBuffer({ resolveWithObject: true });
const SW = info.width, SH = info.height;
const u = SW / WORLD_W; // px per world unit
const OW = Math.round(FW * u), OH = Math.round(FH * u);
const ox = Math.round(-FX * u), oy = Math.round(-FY * u); // the map's top-left inside the output
const STRIP = Math.round(30 * u); // the map's outer sea band (under one cell), mirrored outward

// reflect a coordinate into [0, n) using a band of width `band` at the edges, ping-pong
function reflect(v, n, band) {
  if (v >= 0 && v < n) return v;
  if (v < 0) {
    const d = -v - 1; // distance outside, 0 = first pixel out
    const k = Math.floor(d / band), r = d % band;
    return k % 2 === 0 ? r : band - 1 - r; // mirror, then mirror back…
  }
  const d = v - n;
  const k = Math.floor(d / band), r = d % band;
  return k % 2 === 0 ? n - 1 - r : n - band + r;
}

const out = Buffer.alloc(OW * OH * 4);
const DARK = [20, 18, 16];
const fade = 260 * u; // how far the sea fades into the dark matte
for (let y = 0; y < OH; y++) {
  for (let x = 0; x < OW; x++) {
    const mx = x - ox, my = y - oy; // position relative to the map
    const sx = reflect(mx, SW, STRIP), sy = reflect(my, SH, STRIP);
    const i = (sy * SW + sx) * 3, o = (y * OW + x) * 4;
    // distance outside the map (0 inside)
    const dx = Math.max(0, -mx, mx - (SW - 1)), dy = Math.max(0, -my, my - (SH - 1));
    const d = Math.hypot(dx, dy);
    const t = Math.min(1, d / fade);
    const k = 0.15 + 0.85 * (1 - t * t * (3 - 2 * t)); // keep a little sea even at the frame
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(S[i + c] * k + DARK[c] * (1 - k));
    out[o + 3] = 255;
  }
}
const info2 = await sharp(out, { raw: { width: OW, height: OH, channels: 4 } }).webp({ quality: 80 }).toFile("public/map/sea-surround.webp");
console.log(`sea-surround ${OW} × ${OH}, ${Math.round(info2.size / 1024)} kB, map at (${ox}, ${oy})`);
