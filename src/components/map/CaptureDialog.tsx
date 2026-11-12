"use client";

import { useEffect, useRef, useState } from "react";
import { FACTIONS, type FactionId } from "@/lib/factions";
import { WORLD_H, WORLD_W } from "@/lib/map/render";
import { roman } from "@/lib/roman";
import type { MapApi } from "./MapCanvas";

/** The image shared on X: 16:9, the map with the logo, the season and the score. */
const W = 1600;
const H = 900;
const HEAD = 150;
const FOOT = 46;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

async function renderCapture(
  api: MapApi,
  season: { number: number; name: string },
  scores: Record<FactionId, number>,
): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const cinzel = css.getPropertyValue("--nf-cinzel").trim() || "serif";
  const fell = css.getPropertyValue("--nf-fell").trim() || "serif";
  const mono = css.getPropertyValue("--nf-mono").trim() || "monospace";
  await document.fonts.ready;

  ctx.fillStyle = "#141210";
  ctx.fillRect(0, 0, W, H);

  // the map, framed in gold
  const s = Math.min((W - 60) / WORLD_W, (H - HEAD - FOOT - 10) / WORLD_H);
  const mw = WORLD_W * s;
  const mh = WORLD_H * s;
  const ox = (W - mw) / 2;
  const oy = HEAD + 4;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, mw, mh);
  ctx.clip();
  ctx.scale(s, s);
  const ok = api.drawWorld(ctx, s);
  ctx.restore();
  if (!ok) return null;
  ctx.strokeStyle = "#C9A24B";
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 6, oy - 6, mw + 12, mh + 12);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 10, oy - 10, mw + 20, mh + 20);
  ctx.globalAlpha = 1;

  // header: logo and season on the left
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#C9A24B";
  ctx.font = `700 60px ${cinzel}`;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "6px";
  ctx.fillText("$WERGILD", 40, 82);
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "4px";
  ctx.font = `600 20px ${cinzel}`;
  ctx.fillStyle = "rgba(230,216,184,0.85)";
  ctx.fillText(`SEASON ${roman(season.number)} · ${season.name.toUpperCase()}`, 42, 118);
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";

  // header: the five Banners ranked, with their points
  const ranked = FACTIONS.map((f, i) => ({ f, i }))
    .sort((a, b) => scores[b.f.id] - scores[a.f.id] || a.i - b.i)
    .map((e) => e.f);
  const crests = await Promise.all(ranked.map((f) => loadImage(f.crest)));
  const colW = 128;
  let x = W - 40 - colW * ranked.length;
  ranked.forEach((f, i) => {
    const img = crests[i];
    const cx = x + colW / 2;
    if (img) {
      const h = 58;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.drawImage(img, cx - w / 2, 22, w, h);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = i === 0 ? "#C9A24B" : "rgba(230,216,184,0.8)";
    ctx.font = `600 14px ${cinzel}`;
    ctx.fillText(f.name.replace(/^The /, "").toUpperCase(), cx, 102);
    ctx.font = `500 18px ${mono}`;
    ctx.fillStyle = i === 0 ? "#E6D8B8" : "rgba(230,216,184,0.75)";
    ctx.fillText(`${scores[f.id].toLocaleString("en-US")} pts`, cx, 126);
    x += colW;
  });

  // footer
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(230,216,184,0.7)";
  ctx.font = `italic 20px ${fell}`;
  ctx.fillText("“Every token has a price in blood.”", 40, H - 16);
  ctx.textAlign = "right";
  ctx.fillStyle = "#C9A24B";
  ctx.font = `500 18px ${mono}`;
  ctx.fillText(location.host, W - 40, H - 16);
  return canvas;
}

export function CaptureDialog({
  api,
  season,
  scores,
  onClose,
}: {
  api: MapApi | null;
  season: { number: number; name: string };
  scores: Record<FactionId, number>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    closeRef.current?.focus();
    void (async () => {
      const canvas = api ? await renderCapture(api, season, scores) : null;
      if (!alive) return;
      if (!canvas) return setFailed(true);
      canvas.toBlob((b) => {
        if (!alive || !b) return setFailed(!b);
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      }, "image/png");
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leader = FACTIONS.slice().sort((a, b) => scores[b.id] - scores[a.id])[0];
  const text = `Season ${roman(season.number)} of $WERGILD: ${leader.name} lead with ${scores[leader.id].toLocaleString("en-US")} points. Every token has a price in blood.`;
  const file = blob ? new File([blob], `wergild-season-${season.number}.png`, { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(typeof location !== "undefined" ? location.origin : "")}`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="capture-title" className="fixed inset-0 z-50 grid place-items-center bg-charcoal/85 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-md border border-gold/50 bg-[#191613] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="capture-title" className="font-display text-sm tracking-[0.2em] text-gold">
            CAPTURE THE MAP
          </h2>
          <button ref={closeRef} onClick={onClose} className="text-parchment/60 hover:text-parchment" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mt-3 grid aspect-video place-items-center overflow-hidden rounded-sm border border-gold/20 bg-charcoal">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="The war map, ready to share" className="h-full w-full object-contain" />
          ) : (
            <span className="font-fell italic text-parchment/60">{failed ? "The map could not be captured." : "The scribe is copying the map…"}</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {url && (
            <a href={url} download={`wergild-season-${season.number}.png`} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
              Download image
            </a>
          )}
          {canShareFile && (
            <button
              onClick={() => void navigator.share({ files: [file!], text }).catch(() => {})}
              className="rounded-md border border-gold/60 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
            >
              Share…
            </button>
          )}
          <a href={xUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-gold/60 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
            Post on X ↗
          </a>
          <span className="text-xs text-parchment/45">On X, attach the downloaded image to your post.</span>
        </div>
      </div>
    </div>
  );
}
