import { WORLD_H, WORLD_W } from "./render";

/**
 * The map illustration as a small pyramid (scripts/gen-map-images.mjs):
 *   1x  — whole image, ~1586 px wide (overview, phones)
 *   2x  — whole image, ~3172 px wide (medium zoom)
 *   4x  — the 6344 px master cut into 1024 px tiles, fetched only when zoomed in,
 *         and only the tiles on screen.
 * Each frame draws the coarsest level that is still sharp for the current zoom and screen
 * (devicePixelRatio included), and only the visible part of it — never a blown-up bitmap.
 */
const MASTER_W = 6344;
const MASTER_H = 3968;
const TILE = 1024;
const COLS = Math.ceil(MASTER_W / TILE);
const ROWS = Math.ceil(MASTER_H / TILE);

/** Image pixels per world unit at each level. */
export const LEVEL_RES = { l1: MASTER_W / 4 / WORLD_W, l2: MASTER_W / 2 / WORLD_W, l4: MASTER_W / WORLD_W } as const;
/** A level may be stretched this much before it looks soft. */
const STRETCH = 1.12;
/** The zoom limit: the master may be stretched a little more than that, never beyond. */
export const MAX_STRETCH = 1.25;

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

export class WorldImagery {
  private l1: HTMLImageElement | null = null;
  private l2: HTMLImageElement | null = null;
  private l2Loading = false;
  private tiles = new Map<number, HTMLImageElement | "loading" | "failed">();

  /** Called when a better level or a tile arrives: the caller repaints. */
  constructor(private onUpdate: () => void) {}

  /** Resolves once the overview level is ready to draw. */
  async init(): Promise<boolean> {
    this.l1 = await load("/map/world@1x.webp");
    return !!this.l1;
  }

  /** Starts loading the medium level ahead of time (desktop). */
  prefetchMedium() {
    if (this.l2 || this.l2Loading) return;
    this.l2Loading = true;
    void load("/map/world@2x.webp").then((img) => {
      this.l2 = img;
      this.l2Loading = false;
      if (img) this.onUpdate();
    });
  }

  private tile(c: number, r: number): HTMLImageElement | null {
    const key = r * COLS + c;
    const t = this.tiles.get(key);
    if (t instanceof HTMLImageElement) return t;
    if (!t) {
      this.tiles.set(key, "loading");
      void load(`/map/tiles/4x/${c}_${r}.webp`).then((img) => {
        this.tiles.set(key, img ?? "failed");
        if (img) this.onUpdate();
      });
    }
    return null;
  }

  /** Draws the part of the map inside `view` (world units). `devPxPerUnit` = device pixels per world unit. */
  draw(ctx: CanvasRenderingContext2D, view: WorldRect, devPxPerUnit: number) {
    const x0 = Math.max(0, view.x0);
    const y0 = Math.max(0, view.y0);
    const x1 = Math.min(WORLD_W, view.x1);
    const y1 = Math.min(WORLD_H, view.y1);
    if (x1 <= x0 || y1 <= y0) return;

    const wantL2 = devPxPerUnit > LEVEL_RES.l1 * STRETCH;
    const wantTiles = devPxPerUnit > LEVEL_RES.l2 * STRETCH;
    if (wantL2) this.prefetchMedium();

    const base = wantL2 && this.l2 ? this.l2 : this.l1;
    if (base) {
      const k = base.naturalWidth / WORLD_W;
      const kh = base.naturalHeight / WORLD_H;
      // one device pixel of margin so neighbouring regions never leave a hairline
      const m = 1 / devPxPerUnit;
      const a = Math.max(0, x0 - m);
      const b = Math.max(0, y0 - m);
      const w = Math.min(WORLD_W, x1 + m) - a;
      const h = Math.min(WORLD_H, y1 + m) - b;
      ctx.drawImage(base, a * k, b * kh, w * k, h * kh, a, b, w, h);
    }
    if (!wantTiles) return;

    // sharp tiles over the medium level (which hides any seam or a tile still on its way)
    const ku = MASTER_W / WORLD_W;
    const kv = MASTER_H / WORLD_H;
    const c0 = Math.max(0, Math.floor((x0 * ku) / TILE));
    const c1 = Math.min(COLS - 1, Math.floor((x1 * ku) / TILE));
    const r0 = Math.max(0, Math.floor((y0 * kv) / TILE));
    const r1 = Math.min(ROWS - 1, Math.floor((y1 * kv) / TILE));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const img = this.tile(c, r);
        if (!img) continue;
        ctx.drawImage(img, (c * TILE) / ku, (r * TILE) / kv, img.naturalWidth / ku, img.naturalHeight / kv);
      }
    }
  }
}
