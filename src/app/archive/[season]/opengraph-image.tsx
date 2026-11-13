import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { loadArchive } from "@/lib/game/archive";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { roman } from "@/lib/roman";

/**
 * The share image of a sealed season (Open Graph / X card), 1200 × 630: the map at the knell,
 * the winning Banner and the three most renowned.
 */
export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A sealed season of the war of the five Banners";

const PUBLIC = path.join(process.cwd(), "public");
const MAP_W = 704;
const MAP_H = 440;

async function dataUrl(file: string, mime = "image/png") {
  return `data:${mime};base64,${(await readFile(path.join(PUBLIC, file))).toString("base64")}`;
}

/** The map as it stood at the knell: the illustration with each held cell washed in its colour. */
async function mapImage(cells: [number, number, FactionId][]) {
  const cw = MAP_W / 48;
  const ch = MAP_H / 30;
  const rects = cells
    .map(([x, y, f]) => `<rect x="${(x * cw).toFixed(2)}" y="${(y * ch).toFixed(2)}" width="${(cw + 0.4).toFixed(2)}" height="${(ch + 0.4).toFixed(2)}" fill="${FACTION_BY_ID[f]?.color ?? "#000"}"/>`)
    .join("");
  const wash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}"><g opacity="0.55">${rects}</g></svg>`);
  const png = await sharp(path.join(PUBLIC, "map/world@1x.webp"))
    .resize(MAP_W, MAP_H, { fit: "fill" })
    .composite([{ input: wash, blend: "multiply" }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export default async function Image({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  const sb = getServerReadSupabase();
  const a = /^\d{1,6}$/.test(season) && sb ? await loadArchive(sb, Number(season)).catch(() => null) : null;

  const gold = "#C9A24B";
  const parchment = "#E6D8B8";
  if (!a) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#141210", color: gold, fontSize: 64 }}>
          $WERGILD — The Chronicles
        </div>
      ),
      size,
    );
  }

  const win = a.winner ? FACTION_BY_ID[a.winner] : null;
  const [map, winCrest, ...topCrests] = await Promise.all([
    mapImage(a.cells),
    win ? dataUrl(win.crest.replace(/^\//, "")) : Promise.resolve(null),
    ...a.top.slice(0, 3).map((t) => (t.faction ? dataUrl(FACTION_BY_ID[t.faction].crest.replace(/^\//, "")) : Promise.resolve(null))),
  ]);
  const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#141210", padding: 36, gap: 32 }}>
        {/* the map, framed in gold */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", padding: 6, border: `3px solid ${gold}`, borderRadius: 4 }}>
            <img src={map} width={MAP_W} height={MAP_H} alt="" />
          </div>
          <div style={{ display: "flex", marginTop: 14, color: parchment, opacity: 0.6, fontSize: 20 }}>Every token has a price in blood.</div>
        </div>
        {/* the season, its winner, its three most renowned */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, color: parchment }}>
          <div style={{ display: "flex", color: gold, fontSize: 34, fontWeight: 700, letterSpacing: 4 }}>$WERGILD</div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 20, letterSpacing: 3, color: gold, opacity: 0.85 }}>THE CHRONICLES</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 30, fontWeight: 700 }}>Season {roman(a.number)}</div>
          <div style={{ display: "flex", fontSize: 24, opacity: 0.8 }}>{a.name}</div>
          {win && winCrest ? (
            <div style={{ display: "flex", alignItems: "center", marginTop: 24, gap: 14 }}>
              <img src={winCrest} height={84} alt="" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 18, color: gold, letterSpacing: 2 }}>WINNER</div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>{win.name}</div>
                <div style={{ display: "flex", fontSize: 22, opacity: 0.8 }}>{(a.scores[win.id] ?? 0).toLocaleString("en-US")} points</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", marginTop: 24, fontSize: 24, opacity: 0.7 }}>No Banner held the field.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, gap: 8 }}>
            <div style={{ display: "flex", fontSize: 18, color: gold, letterSpacing: 2 }}>MOST RENOWNED</div>
            {a.top.slice(0, 3).map((t, i) => (
              <div key={t.wallet} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22 }}>
                <div style={{ display: "flex", width: 22, color: gold }}>{i + 1}</div>
                {topCrests[i] ? <img src={topCrests[i]!} height={28} alt="" /> : <div style={{ display: "flex", width: 24 }} />}
                <div style={{ display: "flex", flex: 1 }}>{short(t.wallet)}</div>
                <div style={{ display: "flex" }}>{Math.round(t.renown).toLocaleString("en-US")}</div>
              </div>
            ))}
            {a.top.length === 0 && <div style={{ display: "flex", fontSize: 20, opacity: 0.6 }}>Nobody earned Renown.</div>}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
