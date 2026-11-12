"use client";

import { useEffect, useRef, useState } from "react";
import { GRID_H, GRID_W } from "@config/game";
import { BASE_CAMPS, WATCHTOWER_CELLS, WORLD_MASK } from "@/lib/map/mask";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";

const NEXT: Record<string, string> = { ".": "~", "~": "=", "=": "." };
const rowName = (y: number) => (y < 26 ? String.fromCharCode(65 + y) : "A" + String.fromCharCode(65 + y - 26));

export default function MaskEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mask, setMask] = useState<string[]>(WORLD_MASK);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.src = "/map/world@1x.webp";
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    const W = c.width;
    const H = c.height;
    const cw = W / GRID_W;
    const ch = H / GRID_H;
    ctx.drawImage(img, 0, 0, W, H);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const k = mask[y][x];
        if (k === "~") {
          ctx.fillStyle = "rgba(40,110,220,0.45)";
          ctx.fillRect(x * cw, y * ch, cw, ch);
        } else if (k === "=") {
          ctx.fillStyle = "rgba(255,140,0,0.6)";
          ctx.fillRect(x * cw, y * ch, cw, ch);
        }
      }
    }
    // proposed base camps (2×2) and watchtowers
    for (const [f, b] of Object.entries(BASE_CAMPS) as [FactionId, { x: number; y: number }][]) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = FACTION_BY_ID[f].color;
      ctx.strokeRect(b.x * cw + 2, b.y * ch + 2, cw * 2 - 4, ch * 2 - 4);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#C9A24B";
      ctx.strokeRect(b.x * cw, b.y * ch, cw * 2, ch * 2);
      ctx.fillStyle = "rgba(20,18,16,0.85)";
      ctx.fillRect(b.x * cw, b.y * ch - 14, 70, 13);
      ctx.fillStyle = "#E6D8B8";
      ctx.font = "10px sans-serif";
      ctx.fillText(FACTION_BY_ID[f].name, b.x * cw + 3, b.y * ch - 4);
    }
    for (const [x, y] of WATCHTOWER_CELLS) {
      ctx.fillStyle = "#8E1B1B";
      ctx.beginPath();
      ctx.arc((x + 0.5) * cw, (y + 0.5) * ch, cw * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x++) {
      ctx.moveTo(x * cw, 0);
      ctx.lineTo(x * cw, H);
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.moveTo(0, y * ch);
      ctx.lineTo(W, y * ch);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.font = "10px monospace";
    for (let x = 0; x < GRID_W; x += 1) ctx.fillText(String(x + 1), x * cw + 2, 10);
    for (let y = 0; y < GRID_H; y += 1) ctx.fillText(rowName(y), 2, y * ch + 12);
  }, [mask, loaded]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * GRID_H);
    setMask((m) => m.map((row, yy) => (yy === y ? row.slice(0, x) + NEXT[row[x]] + row.slice(x + 1) : row)));
    setCopied(false);
  };

  const text = mask.map((r, y) => `  "${r}", // ${y}`).join("\n");
  const counts = mask.join("").split("").reduce<Record<string, number>>((a, c) => ((a[c] = (a[c] ?? 0) + 1), a), {});

  return (
    <div className="min-h-dvh bg-charcoal p-4 text-parchment">
      <h1 className="font-display text-lg tracking-[0.2em] text-gold">LAND / WATER MASK</h1>
      <p className="mt-1 text-sm text-parchment/70">
        Blue = sea or river (not playable) · orange = bridge (playable) · clear = land · coloured squares = base
        camps · red dots = watchtowers. Click a cell to cycle land → water →
        bridge. Playable: <span className="font-mono">{(counts["."] ?? 0) + (counts["="] ?? 0)}</span> cells, water:{" "}
        <span className="font-mono">{counts["~"] ?? 0}</span>.
      </p>
      <canvas
        ref={canvasRef}
        width={1600}
        height={1000}
        onClick={onClick}
        className="mt-3 w-full max-w-[1600px] cursor-crosshair border border-gold/40"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
          className="rounded bg-gold px-3 py-1.5 text-sm font-semibold text-charcoal"
        >
          {copied ? "Copied" : "Copy mask"}
        </button>
        <button onClick={() => setMask(WORLD_MASK)} className="rounded border border-gold/40 px-3 py-1.5 text-sm">
          Reset
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-tight text-parchment/80">{text}</pre>
    </div>
  );
}
