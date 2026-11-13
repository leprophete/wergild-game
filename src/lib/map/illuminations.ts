import { WORLD_H, WORLD_W } from "./render";
import type { WorldRect } from "./imagery";

/**
 * Where the illuminations sit, in world units (1 cell = 32). Placed with the land/water mask
 * (scripts kept out of the repo; numbers below are their result):
 *
 * - map_frame.webp (same 1.6 format as the map) is scaled ×1.34 and raised by 2 cells so that
 *   its opening holds the whole land: drawn exactly over the map it would hide 285 playable
 *   cells. Here it only grazes two edge cells (3,1 and 44,24) by a vine tip (< 7 %).
 * - map_rider.webp, 14 cells tall, mirrored so it leaps INTO the map, sits on the frame's
 *   bottom-right corner, half a cell beyond its outer edge: over 9 sea cells, not one pixel
 *   on a playable cell (checked at full resolution).
 */
// keep in sync with scripts/gen-sea-surround.mjs (the sea between the map and the frame)
const FRAME_SCALE = 1.34;
const FRAME_W = WORLD_W * FRAME_SCALE;
const FRAME_H = WORLD_H * FRAME_SCALE;
const FRAME_X = (WORLD_W - FRAME_W) / 2 - 16; // half a cell to the left
const FRAME_Y = (WORLD_H - FRAME_H) / 2 - 64; // two cells up

export const FRAME_RECT: WorldRect = { x0: FRAME_X, y0: FRAME_Y, x1: FRAME_X + FRAME_W, y1: FRAME_Y + FRAME_H };

const RIDER_H = 14 * 32;
const RIDER_W = (RIDER_H * 2016) / 3042; // the image's own proportions
const RIDER_OUT = 16; // half a cell beyond the frame's outer edge

export const RIDER_RECT: WorldRect = {
  x0: FRAME_RECT.x1 + RIDER_OUT - RIDER_W,
  y0: FRAME_RECT.y1 + RIDER_OUT - RIDER_H,
  x1: FRAME_RECT.x1 + RIDER_OUT,
  y1: FRAME_RECT.y1 + RIDER_OUT,
};

/** What the view fits and pans within on wide screens: the frame and the rider, plus a margin. */
export const FRAMED_EXTENT: WorldRect = {
  x0: FRAME_RECT.x0 - 8,
  y0: FRAME_RECT.y0 - 8,
  x1: RIDER_RECT.x1 + 8,
  y1: RIDER_RECT.y1 + 8,
};

/**
 * On wide screens the frame hides the map's corners, so the season cartouche and the compass
 * rose sit on the frame's bands instead (measured on map_frame.webp: top band ≈ 2–8 %,
 * bottom band ≈ 90–97 % of its height), each over the band's central fleur-de-lis.
 */
const frameW = FRAME_RECT.x1 - FRAME_RECT.x0;
const frameH = FRAME_RECT.y1 - FRAME_RECT.y0;
export const CARTOUCHE_ON_FRAME = { cx: FRAME_RECT.x0 + frameW / 2, cy: FRAME_RECT.y0 + frameH * 0.935, w: 300, h: 64 };
export const COMPASS_ON_FRAME = { cx: FRAME_RECT.x0 + frameW / 2, cy: FRAME_RECT.y0 + frameH * 0.05, r: 34 };
