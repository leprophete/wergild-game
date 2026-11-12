"use client";

import { useEffect, useRef, useState } from "react";
import { GRID_W } from "@config/game";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { rankedForces, type CellState, type GameEvent } from "@/lib/map/state";
import { STATIC_CELLS, cellLabel } from "@/lib/map/layout";
import {
  CELL,
  CHARCOAL,
  WORLD_H,
  WORLD_W,
  buildOverlayIndex,
  buildDecor,
  buildOverlayIndex as buildIndex,
  buildTerritoryGeometry,
  ownersKey,
  cx,
  cy,
  diffAnimations,
  drawAnimations,
  drawDecor,
  drawOverlay,
  drawTerritory,
  hoverArea,
  worldToCell,
  type CellAnim,
  type Decor,
  type Fonts,
  type MapFilter,
  type OverlayIndex,
  type TerritoryGeometry,
} from "@/lib/map/render";
import { LEVEL_RES, MAX_STRETCH, WorldImagery, type WorldRect } from "@/lib/map/imagery";

interface Props {
  cells: CellState[];
  myFaction: FactionId | null;
  selectedId: number | null;
  filter: MapFilter;
  events: GameEvent[];
  seasonTitle: string;
  seasonSub: string;
  onSelect: (id: number | null) => void;
  /** Home page preview: the live map, no input, no tooltip, no zoom buttons. */
  preview?: boolean;
  /** Cells that glow gently (the guided first deployment). */
  highlight?: number[];
  /** Hands the parent a way to draw the whole map elsewhere (the capture for X). */
  onApi?: (api: MapApi) => void;
}

export interface MapApi {
  /** Draws the whole world at `s` px per world unit, origin at the context's current transform. */
  drawWorld: (ctx: CanvasRenderingContext2D, s: number) => boolean;
}

interface View {
  s: number;
  tx: number;
  ty: number;
}

/** Never more than this on screen per cell (CSS px), whatever the screen. */
const MAX_ZOOM_CELL_PX = 140;
/** Canvas backing store: devicePixelRatio, capped (memory on 3× phones). */
const MAX_DPR = 2;
/** Screen strip kept clear at the top of the map, under the filter bar, when the whole map is shown. */
const TOP_INSET_PX = 52;
/** Wet ink dries and event countdowns tick: a full redraw this often, no more. */
const SLOW_TICK_MS = 30_000;
/** Margin around a cell repainted with it (selection ticks, dotted borders). */
const PAD = 7;

/** A quill cursor for the map (the interface keeps the normal cursor). */
const QUILL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M2 26 L9 17' stroke='#2A1F14' stroke-width='1.6' stroke-linecap='round'/><path d='M8 18 C 10 9, 17 3, 26 2 C 24 10, 18 17, 8 18 Z' fill='#E6D8B8' stroke='#2A1F14' stroke-width='1.2'/><path d='M9 17 L22 6' stroke='#2A1F14' stroke-width='0.8'/></svg>`,
)}") 1 27, crosshair`;

function readFonts(): Fonts {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
  return { cinzel: v("--nf-cinzel", "serif"), fell: v("--nf-fell", "serif"), mono: v("--nf-mono", "monospace") };
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Dev-only counters, read by the performance check (`window.__wgRender`). */
interface RenderStats {
  full: number;
  region: number;
  lastFullMs: number;
  lastTerritoryMs: number;
  /** number of zones in the last build */
  territoryCells: number;
  geometryBuilds?: number;
}

/**
 * The war map. Rendering is ON DEMAND:
 *  - the parchment (rough.js terrain, river, decor) is drawn once into a cached canvas;
 *  - the territory layer is a second cached canvas, repainted only for cells that changed;
 *  - the screen canvas is recomposed only when something changes (data, pan, zoom, hover,
 *    selection, filter) — never in a permanent loop;
 *  - animations (deploy/conquest/retreat) redraw only their own cells,
 *    stop when they end, and pause while the tab is hidden.
 */
export default function MapCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageryRef = useRef<WorldImagery | null>(null);
  const decorRef = useRef<Decor | null>(null);
  const terrRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const resRef = useRef(2);
  const fontsRef = useRef<Fonts | null>(null);
  const crestsRef = useRef<Partial<Record<FactionId, HTMLImageElement>>>({});
  const viewRef = useRef<View>({ s: 1, tx: 0, ty: 0 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const fittedRef = useRef(false);
  const hoverRef = useRef<number | null>(null);
  const animsRef = useRef<CellAnim[]>([]);
  const prevCellsRef = useRef<CellState[] | null>(null);
  const indexRef = useRef<OverlayIndex>({ contested: [], garrisons: [], mine: [], veil: null, matches: null, events: [] });
  const geoRef = useRef<TerritoryGeometry>({ key: "", zones: [] });
  const propsRef = useRef(props);
  propsRef.current = props;
  /** The home preview has no filter bar to keep clear. */
  const inset = () => (propsRef.current.preview ? 0 : TOP_INSET_PX);
  const [ready, setReady] = useState(false);
  const pulseRef = useRef(0);

  // --- render scheduler -----------------------------------------------------
  const sched = useRef({ raf: 0, full: false, region: new Set<number>() });
  const statsRef = useRef<RenderStats>({ full: 0, region: 0, lastFullMs: 0, lastTerritoryMs: 0, territoryCells: 0 });

  /** The part of the world on screen (world units). */
  const visibleRect = (): WorldRect => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    return { x0: -v.tx / v.s, y0: -v.ty / v.s, x1: (w - v.tx) / v.s, y1: (h - v.ty) / v.s };
  };

  const overlayInput = (now: number, view: WorldRect) => {
    const p = propsRef.current;
    return {
      cells: p.cells,
      index: indexRef.current,
      territory: geoRef.current,
      selectedId: p.selectedId,
      hoverId: hoverRef.current,
      now,
      fonts: fontsRef.current!,
      crests: crestsRef.current,
      scale: viewRef.current.s,
      view,
      highlight: p.highlight,
      pulse: pulseRef.current,
    };
  };

  /** Illustration + decor + watercolour for a world rectangle (the canvas may be clipped to it). */
  const drawBase = (ctx: CanvasRenderingContext2D, rect: WorldRect, devPx?: number) => {
    const { dpr } = sizeRef.current;
    const v = viewRef.current;
    const p = propsRef.current;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    imageryRef.current!.draw(ctx, rect, devPx ?? dpr * v.s);
    // watercolour bands: multiply, like pigment on paper (soft by nature: a cached layer)
    const terr = terrRef.current!;
    const R = resRef.current;
    const x0 = Math.max(0, rect.x0);
    const y0 = Math.max(0, rect.y0);
    const x1 = Math.min(WORLD_W, rect.x1);
    const y1 = Math.min(WORLD_H, rect.y1);
    if (x1 > x0 && y1 > y0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(terr, x0 * R, y0 * R, (x1 - x0) * R, (y1 - y0) * R, x0, y0, x1 - x0, y1 - y0);
      ctx.globalCompositeOperation = "source-over";
    }
    // towers, names, cartouche, compass: vector, redrawn at this zoom
    drawDecor(ctx, decorRef.current!, fontsRef.current!, p.seasonTitle, p.seasonSub);
  };

  const renderFull = (ctx: CanvasRenderingContext2D, t: number) => {
    const { dpr } = sizeRef.current;
    const v = viewRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CHARCOAL;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
    const view = visibleRect();
    drawBase(ctx, view);
    animsRef.current = drawAnimations(ctx, animsRef.current, t);
    drawOverlay(ctx, overlayInput(Date.now(), view), t);
  };

  /** Repaints only the given cells (plus a small margin): used by hover and the animations. */
  const renderRegion = (ctx: CanvasRenderingContext2D, ids: Set<number>, t: number) => {
    const { dpr } = sizeRef.current;
    const v = viewRef.current;
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
    ctx.save();
    ctx.beginPath();
    const touched = new Set<number>();
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const id of ids) {
      const x = cx(id % GRID_W) - PAD;
      const y = cy(Math.floor(id / GRID_W)) - PAD;
      ctx.rect(x, y, CELL + PAD * 2, CELL + PAD * 2);
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x + CELL + PAD * 2);
      box.y1 = Math.max(box.y1, y + CELL + PAD * 2);
      touched.add(id);
      // neighbours share the padded margin: redraw their marks too
      for (const n of [id - 1, id + 1, id - GRID_W, id + GRID_W]) if (n >= 0 && n < GRID_W * 30) touched.add(n);
    }
    ctx.clip();
    drawBase(ctx, box);
    animsRef.current = drawAnimations(ctx, animsRef.current, t);
    drawOverlay(ctx, overlayInput(Date.now(), visibleRect()), t, touched);
    ctx.restore();
  };

  const frame = (t: number) => {
    const s = sched.current;
    s.raf = 0;
    const canvas = canvasRef.current;
    if (!canvas || !imageryRef.current || !decorRef.current || !terrRef.current || !fontsRef.current) return;
    if (document.hidden) {
      s.full = true; // repaint everything when the tab comes back
      return;
    }
    const ctx = canvas.getContext("2d")!;
    const before = animsRef.current.map((a) => a.cell);
    const t0 = performance.now();
    if (s.full) {
      renderFull(ctx, t);
      statsRef.current.full++;
      statsRef.current.lastFullMs = performance.now() - t0;
    } else if (s.region.size) {
      renderRegion(ctx, s.region, t);
      statsRef.current.region++;
    }
    s.full = false;
    s.region = new Set();
    // keep animating only the cells still in motion; repaint the ones that just ended once
    const alive = new Set(animsRef.current.map((a) => a.cell));
    const next = new Set<number>(alive);
    for (const c of before) if (!alive.has(c)) next.add(c);
    if (next.size) invalidate(next);
  };

  /** Ask for a repaint: everything (default) or only some cells. Coalesced into one frame. */
  const invalidate = (cells?: Iterable<number>) => {
    const s = sched.current;
    if (cells) for (const c of cells) s.region.add(c);
    else s.full = true;
    if (!s.raf && typeof document !== "undefined" && !document.hidden) s.raf = requestAnimationFrame(frame);
  };

  // --- view helpers ---------------------------------------------------------
  const fitScale = () => {
    const { w, h } = sizeRef.current;
    return Math.min(w / WORLD_W, (h - inset()) / WORLD_H);
  };
  /** The closest zoom that stays sharp: the 4× master, stretched at most MAX_STRETCH on this screen. */
  const maxScale = () => Math.min(MAX_ZOOM_CELL_PX / CELL, (LEVEL_RES.l4 * MAX_STRETCH) / sizeRef.current.dpr);
  const clampView = (v: View): View => {
    const { w, h } = sizeRef.current;
    const min = fitScale() * 0.9;
    const max = Math.max(min, maxScale());
    const s = Math.min(max, Math.max(min, v.s));
    const mw = WORLD_W * s;
    const mh = WORLD_H * s;
    const pad = 40;
    const tx = mw <= w ? (w - mw) / 2 : Math.min(pad, Math.max(w - mw - pad, v.tx));
    const ty =
      mh <= h - inset() ? inset() + (h - inset() - mh) / 2 : Math.min(inset(), Math.max(h - mh - pad, v.ty));
    return { s, tx, ty };
  };
  const setView = (v: View) => {
    viewRef.current = clampView(v);
    invalidate();
  };
  const zoomAt = (px: number, py: number, wanted: number) => {
    const v = viewRef.current;
    // clamp first, so the point under the cursor stays put at the zoom limits
    const ns = Math.min(Math.max(fitScale() * 0.9, maxScale()), Math.max(fitScale() * 0.9, wanted));
    const wx = (px - v.tx) / v.s;
    const wy = (py - v.ty) / v.s;
    setView({ s: ns, tx: px - wx * ns, ty: py - wy * ns });
  };
  const fit = () => {
    const { w, h } = sizeRef.current;
    // On narrow screens open at a readable zoom centred on the player's homeland.
    const s = fitScale();
    const mine = propsRef.current.myFaction;
    if (w < 700 && !propsRef.current.preview) {
      const ns = Math.max(s, (h - inset()) / WORLD_H);
      const b = mine ? FACTION_BY_ID[mine].base : null;
      const fx = b ? cx(b.x + 1) : WORLD_W / 2;
      const fy = b ? cy(b.y + 1) : WORLD_H / 2;
      setView({ s: ns, tx: w / 2 - fx * ns, ty: h / 2 - fy * ns });
    } else setView({ s, tx: 0, ty: 0 });
  };

  // --- one-time setup: fonts, crests, the cached parchment --------------------
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
      // the illustration: overview level first; sharper levels and tiles come with the zoom
      const imagery = new WorldImagery(() => invalidate());
      if (!(await imagery.init()) || cancelled) return;
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
      if (!mobile) imagery.prefetchMedium();
      imageryRef.current = imagery;
      decorRef.current = buildDecor();
      // the watercolour layer is soft by nature: a modest cached resolution is enough
      const R = mobile ? 1.3 : 2;
      resRef.current = R;
      const terr = document.createElement("canvas");
      terr.width = Math.round(WORLD_W * R);
      terr.height = Math.round(WORLD_H * R);
      terrRef.current = terr;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- data changes: repaint only the cells that changed ---------------------
  useEffect(() => {
    if (!ready || !terrRef.current) return;
    const prev = prevCellsRef.current;
    const t0 = performance.now();
    // frontiers, gradients and crests: rebuilt only when an owner changes
    const key = ownersKey(props.cells);
    if (key !== geoRef.current.key) {
      geoRef.current = buildTerritoryGeometry(props.cells);
      drawTerritory(terrRef.current, resRef.current, geoRef.current);
      statsRef.current.territoryCells = geoRef.current.zones.length;
      statsRef.current.geometryBuilds = (statsRef.current.geometryBuilds ?? 0) + 1;
    }
    if (prev && prev !== props.cells) {
      if (!reducedMotion()) {
        animsRef.current = [...animsRef.current, ...diffAnimations(prev, props.cells, performance.now())];
      }
    }
    statsRef.current.lastTerritoryMs = performance.now() - t0;
    prevCellsRef.current = props.cells;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.cells]);

  // overlay lists (contested, mine, filter fog): once per data or filter change, never per frame
  useEffect(() => {
    indexRef.current = buildOverlayIndex(props.cells, props.events, props.filter, Date.now());
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.cells, props.events, props.filter]);

  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedId]);

  // --- slow clock: wet ink dries and countdowns tick (no permanent animation) ----
  useEffect(() => {
    if (!ready) return;
    const sc = sched.current;
    const slow = setInterval(() => {
      if (!document.hidden && (indexRef.current.mine.length || indexRef.current.events.length)) invalidate();
    }, SLOW_TICK_MS);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(sc.raf);
        sc.raf = 0;
      } else invalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __wgRender: RenderStats }).__wgRender = statsRef.current;
    }
    return () => {
      clearInterval(slow);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(sc.raf);
      sc.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // --- the capture: the whole map drawn into another canvas -------------------
  useEffect(() => {
    if (!ready || !props.onApi) return;
    props.onApi({
      drawWorld: (ctx, s) => {
        if (!imageryRef.current || !decorRef.current || !terrRef.current || !fontsRef.current) return false;
        const p = propsRef.current;
        const rect = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };
        drawBase(ctx, rect, s);
        drawOverlay(
          ctx,
          {
            cells: p.cells,
            index: buildIndex(p.cells, p.events, "all", Date.now()),
            territory: geoRef.current,
            selectedId: null,
            hoverId: null,
            now: Date.now(),
            fonts: fontsRef.current,
            crests: crestsRef.current,
            scale: s,
            view: rect,
          },
          0,
        );
        return true;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // --- the guided first deployment: the cells you may deploy on glow gently ---------
  // A slow pulse (about 12 repaints a second, only those cells), and only while the guide runs.
  const highlightKey = (props.highlight ?? []).join(",");
  useEffect(() => {
    const ids = propsRef.current.highlight ?? [];
    if (!ready) return;
    invalidate();
    if (!ids.length) return;
    const still = reducedMotion();
    pulseRef.current = still ? 0.6 : 0;
    if (still) return;
    const t0 = performance.now();
    const timer = setInterval(() => {
      if (document.hidden) return;
      pulseRef.current = 0.5 - 0.5 * Math.cos(((performance.now() - t0) / 1800) * Math.PI * 2);
      invalidate(ids);
    }, 85);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, highlightKey]);

  // --- size ---------------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      if (!fittedRef.current && r.width > 0) {
        fit();
        fittedRef.current = true;
      } else setView(viewRef.current);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    // moving the window to a screen with another pixel density: re-measure (sharpness, zoom limit)
    let mq: MediaQueryList | null = null;
    const watchDpr = () => {
      mq?.removeEventListener("change", onDpr);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", onDpr);
    };
    const onDpr = () => {
      measure();
      watchDpr();
    };
    watchDpr();
    return () => {
      ro.disconnect();
      mq?.removeEventListener("change", onDpr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- input: pan, pinch, wheel, tap ----------------------------------------
  useEffect(() => {
    if (propsRef.current.preview) return;
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
    const tip = tipRef.current;
    const fmt = (n: number) => n.toLocaleString("en-US");
    const fillTip = (id: number | null) => {
      if (!tip) return;
      if (id === null || STATIC_CELLS[id].terrain === "water") {
        tip.style.display = "none";
        return;
      }
      const c = propsRef.current.cells[id];
      tip.replaceChildren();
      const head = document.createElement("div");
      head.className = "font-mono text-[11px] text-gold";
      head.textContent = cellLabel(id);
      tip.append(head);
      const ranked = c ? rankedForces(c) : [];
      if (!ranked.length) {
        const none = document.createElement("div");
        none.className = "font-fell italic text-parchment/70";
        none.textContent = "Unclaimed";
        tip.append(none);
      }
      for (const r of ranked) {
        const row = document.createElement("div");
        row.className = "flex justify-between gap-3";
        // a colour swatch + the name in clear text: readable for every Banner colour
        const name = document.createElement("span");
        name.className = "flex items-center gap-1.5";
        const dot = document.createElement("i");
        dot.className = "inline-block h-2 w-2 rounded-full ring-1 ring-parchment/40";
        dot.style.background = FACTION_BY_ID[r.faction].color;
        name.append(dot, FACTION_BY_ID[r.faction].name);
        const val = document.createElement("span");
        val.className = "font-mono text-parchment";
        val.textContent = fmt(r.force);
        row.append(name, val);
        tip.append(row);
      }
      if (c && c.mine > 0) {
        const mine = document.createElement("div");
        mine.className = "mt-0.5 border-t border-gold/25 pt-0.5 text-gold";
        mine.textContent = `Mine: ${fmt(c.mine)}`;
        tip.append(mine);
      }
      tip.style.display = "block";
    };
    const placeTip = (x: number, y: number) => {
      if (!tip || tip.style.display === "none") return;
      const { w } = sizeRef.current;
      const left = x + 16 + tip.offsetWidth > w ? x - 12 - tip.offsetWidth : x + 16;
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(y + 14)}px)`;
    };

    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      fillTip(null); // dragging or touching: no tooltip
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) tap = { ...p, time: performance.now(), moved: false };
      if (pointers.size === 2) {
        pinch = { ...pinchState(), s: viewRef.current.s };
        if (tap) tap.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === "mouse") {
          const h = pickCell(p.x, p.y);
          if (h !== hoverRef.current) {
            const old = hoverRef.current;
            hoverRef.current = h;
            fillTip(h);
            // hover only touches the small grid around the old and the new cell
            invalidate([...hoverArea(old), ...hoverArea(h)]);
          }
          placeTip(p.x, p.y);
        }
        return;
      }
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        const v = viewRef.current;
        setView({ s: v.s, tx: v.tx + p.x - prev.x, ty: v.ty + p.y - prev.y });
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
    const leave = () => {
      fillTip(null);
      if (hoverRef.current !== null) {
        const old = hoverRef.current;
        hoverRef.current = null;
        invalidate(hoverArea(old));
      }
    };
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
        style={{ cursor: props.preview ? "default" : QUILL }}
        aria-label="War map of the five Banners"
        role="img"
      />
      {/* exact numbers, on hover only (desktop) */}
      <div
        ref={tipRef}
        style={{ display: "none" }}
        className="pointer-events-none absolute left-0 top-0 z-20 min-w-[150px] rounded-md border border-gold/40 bg-charcoal/95 px-2.5 py-1.5 text-[12px] leading-snug text-parchment/85 shadow-xl"
        role="tooltip"
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center font-fell text-lg italic text-parchment/70">
          Unrolling the map…
        </div>
      )}
      {!props.preview && (
      <div className="absolute bottom-5 right-[68px] z-10 hidden flex-col overflow-hidden rounded-md border border-gold/40 bg-charcoal/85 text-parchment shadow-lg md:flex">
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
      )}
    </div>
  );
}
