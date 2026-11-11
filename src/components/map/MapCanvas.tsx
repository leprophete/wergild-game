"use client";

import { useEffect, useRef, useState } from "react";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import type { CellState, GameEvent } from "@/lib/map/state";
import {
  CHARCOAL,
  WORLD_H,
  WORLD_W,
  cx,
  cy,
  diffAnimations,
  drawAnimations,
  drawBackground,
  drawOverlay,
  type CellAnim,
  drawTerritory,
  worldToCell,
  type Fonts,
  type MapFilter,
} from "@/lib/map/render";

interface Props {
  cells: CellState[];
  myFaction: FactionId | null;
  selectedId: number | null;
  filter: MapFilter;
  events: GameEvent[];
  seasonTitle: string;
  seasonSub: string;
  onSelect: (id: number | null) => void;
}

interface View {
  s: number;
  tx: number;
  ty: number;
}

const MAX_ZOOM_CELL_PX = 140;
/** Screen strip kept clear at the top of the map, under the filter bar, when the whole map is shown. */
const TOP_INSET = 52;

/** A quill cursor for the map (the interface keeps the normal cursor). */
const QUILL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M2 26 L9 17' stroke='#2A1F14' stroke-width='1.6' stroke-linecap='round'/><path d='M8 18 C 10 9, 17 3, 26 2 C 24 10, 18 17, 8 18 Z' fill='#E6D8B8' stroke='#2A1F14' stroke-width='1.2'/><path d='M9 17 L22 6' stroke='#2A1F14' stroke-width='0.8'/></svg>`,
)}") 1 27, crosshair`;

function readFonts(): Fonts {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
  return { cinzel: v("--nf-cinzel", "serif"), fell: v("--nf-fell", "serif"), mono: v("--nf-mono", "monospace") };
}

export default function MapCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const terrRef = useRef<HTMLCanvasElement | null>(null);
  const resRef = useRef(2);
  const fontsRef = useRef<Fonts | null>(null);
  const crestsRef = useRef<Partial<Record<FactionId, HTMLImageElement>>>({});
  const viewRef = useRef<View>({ s: 1, tx: 0, ty: 0 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const fittedRef = useRef(false);
  const hoverRef = useRef<number | null>(null);
  const animsRef = useRef<CellAnim[]>([]);
  const prevCellsRef = useRef<CellState[] | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [ready, setReady] = useState(false);

  // --- view helpers ---------------------------------------------------------
  const fitScale = () => {
    const { w, h } = sizeRef.current;
    return Math.min(w / WORLD_W, (h - TOP_INSET) / WORLD_H);
  };
  const clampView = (v: View): View => {
    const { w, h } = sizeRef.current;
    const min = fitScale() * 0.9;
    const max = MAX_ZOOM_CELL_PX / 32;
    const s = Math.min(max, Math.max(min, v.s));
    const mw = WORLD_W * s;
    const mh = WORLD_H * s;
    const pad = 40;
    const tx = mw <= w ? (w - mw) / 2 : Math.min(pad, Math.max(w - mw - pad, v.tx));
    const ty =
      mh <= h - TOP_INSET
        ? TOP_INSET + (h - TOP_INSET - mh) / 2
        : Math.min(TOP_INSET, Math.max(h - mh - pad, v.ty));
    return { s, tx, ty };
  };
  const zoomAt = (px: number, py: number, ns: number) => {
    const v = viewRef.current;
    const wx = (px - v.tx) / v.s;
    const wy = (py - v.ty) / v.s;
    viewRef.current = clampView({ s: ns, tx: px - wx * ns, ty: py - wy * ns });
  };
  const fit = () => {
    const { w, h } = sizeRef.current;
    // On narrow screens open at a readable zoom centred on the player's homeland.
    const s = fitScale();
    const mine = propsRef.current.myFaction;
    if (w < 700 && mine) {
      const b = FACTION_BY_ID[mine].base;
      const ns = Math.max(s, (h - TOP_INSET) / WORLD_H);
      viewRef.current = clampView({ s: ns, tx: w / 2 - cx(b.x + 1) * ns, ty: h / 2 - cy(b.y + 1) * ns });
    } else viewRef.current = clampView({ s, tx: 0, ty: 0 });
  };

  // --- one-time setup: fonts, crests, static layers -------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fonts = readFonts();
      fontsRef.current = fonts;
      await Promise.all([
        document.fonts.load(`600 22px ${fonts.cinzel}`),
        document.fonts.load(`italic 15px ${fonts.fell}`),
        document.fonts.load(`15px ${fonts.fell}`),
      ]).catch(() => {});
      await Promise.all(
        FACTIONS.map(
          (f) =>
            new Promise<void>((res) => {
              const img = new Image();
              img.onload = () => res();
              img.onerror = () => res();
              img.src = f.crest;
              crestsRef.current[f.id] = img;
            }),
        ),
      );
      if (cancelled) return;
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
      const R = mobile ? 1.5 : Math.min(2.25, Math.max(1.5, window.devicePixelRatio || 1) * 1.1);
      resRef.current = R;
      const bg = document.createElement("canvas");
      bg.width = Math.round(WORLD_W * R);
      bg.height = Math.round(WORLD_H * R);
      drawBackground(bg, R, fonts, propsRef.current.seasonTitle, propsRef.current.seasonSub);
      const terr = document.createElement("canvas");
      terr.width = bg.width;
      terr.height = bg.height;
      bgRef.current = bg;
      terrRef.current = terr;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- territory layer: redrawn when cells change ---------------------------
  useEffect(() => {
    if (!ready || !terrRef.current) return;
    drawTerritory(terrRef.current, resRef.current, props.cells);
    // play the change (deploy / conquest / retreat) on top of the new state
    const prev = prevCellsRef.current;
    if (prev && prev !== props.cells && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animsRef.current = [...animsRef.current, ...diffAnimations(prev, props.cells, performance.now())];
    }
    prevCellsRef.current = props.cells;
  }, [ready, props.cells]);

  // --- size ---------------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      if (!fittedRef.current && r.width > 0) {
        fit();
        fittedRef.current = true;
      } else viewRef.current = clampView(viewRef.current);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- render loop --------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const { dpr } = sizeRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = CHARCOAL;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const bg = bgRef.current;
      const terr = terrRef.current;
      const fonts = fontsRef.current;
      if (!bg || !terr || !fonts) return;
      const v = viewRef.current;
      ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bg, 0, 0, WORLD_W, WORLD_H);
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(terr, 0, 0, WORLD_W, WORLD_H);
      ctx.globalCompositeOperation = "source-over";
      if (animsRef.current.length) animsRef.current = drawAnimations(ctx, animsRef.current, t);
      const p = propsRef.current;
      drawOverlay(
        ctx,
        {
          cells: p.cells,
          myFaction: p.myFaction,
          selectedId: p.selectedId,
          hoverId: hoverRef.current,
          filter: p.filter,
          events: p.events,
          now: Date.now(),
          fonts,
          crests: crestsRef.current,
          scale: v.s,
        },
        t,
      );
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- input: pan, pinch, wheel, tap ----------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let tap: { x: number; y: number; time: number; moved: boolean } | null = null;
    let pinch: { dist: number; s: number; mx: number; my: number } | null = null;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pickCell = (x: number, y: number) => {
      const v = viewRef.current;
      return worldToCell((x - v.tx) / v.s, (y - v.ty) / v.s);
    };
    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) tap = { ...p, time: performance.now(), moved: false };
      if (pointers.size === 2) {
        const ps = pinchState();
        pinch = { ...ps, s: viewRef.current.s };
        if (tap) tap.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === "mouse") hoverRef.current = pickCell(p.x, p.y);
        return;
      }
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        const v = viewRef.current;
        viewRef.current = clampView({ s: v.s, tx: v.tx + p.x - prev.x, ty: v.ty + p.y - prev.y });
        if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) tap.moved = true;
      } else if (pointers.size === 2 && pinch) {
        const ps = pinchState();
        const v = viewRef.current;
        viewRef.current = clampView({ s: v.s, tx: v.tx + ps.mx - pinch.mx, ty: v.ty + ps.my - pinch.my });
        zoomAt(ps.mx, ps.my, pinch.s * (ps.dist / pinch.dist));
        pinch.mx = ps.mx;
        pinch.my = ps.my;
      }
    };
    const up = (e: PointerEvent) => {
      const p = local(e);
      if (pointers.size === 1 && tap && !tap.moved && performance.now() - tap.time < 500) {
        propsRef.current.onSelect(pickCell(p.x, p.y));
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) tap = null;
    };
    const leave = () => (hoverRef.current = null);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const k = e.ctrlKey ? 0.01 : 0.0018; // trackpad pinch arrives as ctrl+wheel
      zoomAt(p.x, p.y, viewRef.current.s * Math.exp(-e.deltaY * k));
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (k: number) => {
    const { w, h } = sizeRef.current;
    zoomAt(w / 2, h / 2, viewRef.current.s * k);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        style={{ cursor: QUILL }}
        aria-label="War map of the five Banners"
        role="img"
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center font-fell text-lg italic text-parchment/70">
          Unrolling the map…
        </div>
      )}
      <div className="absolute bottom-4 right-4 z-10 hidden flex-col overflow-hidden rounded-md border border-gold/40 bg-charcoal/85 text-parchment shadow-lg md:flex">
        <button className="h-9 w-9 text-lg hover:bg-gold/15" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          +
        </button>
        <button className="h-9 w-9 border-t border-gold/25 text-lg hover:bg-gold/15" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          −
        </button>
        <button className="h-9 w-9 border-t border-gold/25 text-xs hover:bg-gold/15" onClick={fit} aria-label="Fit map">
          ⤢
        </button>
      </div>
    </div>
  );
}
