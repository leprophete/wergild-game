"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The map's loading screen, on the first load of a visit only (sessionStorage).
 *
 * A raven flies in from the right along a curve (wings up / wings down every 100 ms), lands
 * on the branch in the top-right corner (perched sprite), the branch bends 4° around its
 * base and springs back with a small bounce. While the map loads, the raven tilts every 2 s.
 * When the map is ready (the event "wg:map-ready"), it flies off to the left, flapping, and
 * the parchment fades in 400 ms.
 *
 * Timing: shown at least 1.2 s, and never more than 1.5 s beyond the real loading (the exit
 * starts at max(ready, landed) and lasts 0.8 s; the flight in lasts 0.7 s). One
 * requestAnimationFrame loop, stopped at the end. prefers-reduced-motion: the raven sits on
 * the branch from the start, no flight; the parchment only fades.
 */

export const MAP_READY_EVENT = "wg:map-ready";

/** Tells the loading screen that the map can be seen (or that it cannot load at all). */
export function signalMapReady() {
  const w = window as unknown as { __wgMapReady?: boolean };
  if (w.__wgMapReady) return;
  w.__wgMapReady = true;
  window.dispatchEvent(new Event(MAP_READY_EVENT));
}
const SEEN_KEY = "wg_map_intro_seen";

const FLY_IN = 700;
const FLAP = 100;
const BEND = 900;
const TILT_EVERY = 2000;
const TILT_FOR = 500;
const FLY_OUT = 650;
const FADE_AFTER = 400; // the fade starts this long after the take-off…
const FADE = 400; // …and lasts 400 ms: the screen is gone 0.8 s after the take-off
const MIN_SHOWN = 1200;

// geometry, measured on the sprites (scripts/cut-crow-sheet.mjs)
const BRANCH_RATIO = 348 / 830;
const PERCH = { x: 0.48, y: 0.525 }; // top of the wood, in the branch image
const CROW_W = 0.36; // perched raven width, as a share of the branch width
const PERCHED_RATIO = 452 / 548;
const FEET = { x: 0.42, y: 0.96 }; // its claws, in the perched image

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t;
const quad = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

export function MapLoader() {
  // SSR draws the screen (no flash of the map); a later load in the same visit removes it
  // before the first paint
  const [shown, setShown] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLImageElement>(null);
  const downRef = useRef<HTMLImageElement>(null);
  const perchedRef = useRef<HTMLImageElement>(null);
  const readyAt = useRef<number | null>(null);

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") setShown(false);
    } catch {
      /* private mode: show it */
    }
  }, []);

  useEffect(() => {
    if (!shown) return;
    const start = performance.now();
    const onReady = () => {
      if (readyAt.current === null) readyAt.current = performance.now();
    };
    window.addEventListener(MAP_READY_EVENT, onReady);
    if ((window as unknown as { __wgMapReady?: boolean }).__wgMapReady) onReady();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current!;
    const branch = branchRef.current!;
    const anchor = anchorRef.current!;
    const up = upRef.current!;
    const down = downRef.current!;
    const perched = perchedRef.current!;

    const show = (which: "up" | "down" | "perched") => {
      up.style.opacity = which === "up" ? "1" : "0";
      down.style.opacity = which === "down" ? "1" : "0";
      perched.style.opacity = which === "perched" ? "1" : "0";
    };
    const place = (x: number, y: number, rot = 0) => {
      anchor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    };

    let raf = 0;
    let landedAt = still ? start : 0;
    let exitAt = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = branch.getBoundingClientRect().width;

    const frame = (now: number) => {
      const t = now - start;

      if (!exitAt) {
        const ready = readyAt.current;
        const landed = landedAt || start + FLY_IN;
        // leave when the map is ready and the raven has landed, and keep the screen at least
        // MIN_SHOWN in all (the exit itself lasts FADE_AFTER + FADE)
        if (ready !== null && now >= landed && now - start >= MIN_SHOWN - (FADE_AFTER + FADE)) exitAt = Math.max(now, ready);
      }

      if (still) {
        // reduced motion: perched from the start, only the parchment fades
        show("perched");
        place(0, 0);
      } else if (!landedAt && t < FLY_IN) {
        // flying in from the right, along a curve swooping down to the branch
        const p = easeOut(t / FLY_IN);
        const x = quad(vw * 0.55, bw * 0.15, 0, p);
        const y = quad(-vh * 0.12, bw * 0.55, 0, p);
        show(Math.floor(t / FLAP) % 2 ? "down" : "up");
        place(x, y, -8 * (1 - p));
      } else if (!exitAt) {
        if (!landedAt) landedAt = now;
        show("perched");
        // the raven tilts its head every 2 s while the map loads
        const since = now - landedAt;
        const phase = since % TILT_EVERY;
        const tilt = since > 600 && phase < TILT_FOR ? -7 * Math.sin((Math.PI * phase) / TILT_FOR) : 0;
        place(0, 0, tilt);
      } else {
        // take-off to the left, flapping, rising out of the screen
        const e = now - exitAt;
        const p = easeIn(Math.min(1, e / FLY_OUT));
        const x = quad(0, -vw * 0.25, -vw * 1.1, p);
        const y = quad(0, bw * 0.15, -vh * 0.35, p);
        show(Math.floor(e / FLAP) % 2 ? "down" : "up");
        place(x, y, 10 * p);
      }

      // the branch bends 4° under the landing, then springs back with a little bounce
      let bend = 0;
      if (!still && landedAt && now - landedAt < BEND) {
        const b = (now - landedAt) / 1000;
        bend = b < 0.12 ? -4 * easeOut(b / 0.12) : -4 * Math.exp(-(b - 0.12) / 0.2) * Math.cos(((b - 0.12) * 2 * Math.PI) / 0.4);
      }
      branch.style.transform = `rotate(${bend.toFixed(2)}deg)`;

      // the parchment fades away
      if (exitAt) {
        const f = Math.min(1, Math.max(0, (now - exitAt - (still ? 0 : FADE_AFTER)) / FADE));
        root.style.opacity = String(1 - f);
        if (f >= 1) {
          try {
            sessionStorage.setItem(SEEN_KEY, "1");
          } catch {
            /* private mode */
          }
          setShown(false);
          return; // the loop stops here
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(MAP_READY_EVENT, onReady);
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] overflow-hidden bg-[#c69d63] bg-[url(/ornaments/web/grimoire_paper.webp)] bg-[length:100%_100%]"
    >
      <span className="sr-only">Unrolling the map…</span>
      {/* the branch, in the top-right corner; it bends around its base (right end) */}
      <div
        ref={branchRef}
        className="absolute right-0 top-[12vh] w-[var(--bw)] origin-[100%_55%] [--bw:clamp(260px,40vw,480px)] will-change-transform"
        style={{ aspectRatio: `${1 / BRANCH_RATIO}` }}
      >
        <img src="/ornaments/web/crow_branch.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        {/* the raven's anchor = its claws on the perch */}
        <div
          ref={anchorRef}
          className="absolute h-0 w-0 will-change-transform"
          style={{ left: `${PERCH.x * 100}%`, top: `${PERCH.y * 100}%` }}
        >
          <img
            ref={perchedRef}
            src="/ornaments/web/crow_perched.webp"
            alt=""
            draggable={false}
            className="absolute max-w-none select-none motion-reduce:opacity-100!"
            style={{
              width: `calc(var(--bw) * ${CROW_W})`,
              left: `calc(var(--bw) * ${-CROW_W * FEET.x})`,
              top: `calc(var(--bw) * ${-CROW_W * PERCHED_RATIO * FEET.y + 0.004})`,
              opacity: 0,
            }}
          />
          {/* flying: centred a little above the claws */}
          <img
            ref={upRef}
            src="/ornaments/web/crow_wings_up.webp"
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: `calc(var(--bw) * 0.46)`, left: `calc(var(--bw) * -0.23)`, top: `calc(var(--bw) * -0.36)`, opacity: 0 }}
          />
          <img
            ref={downRef}
            src="/ornaments/web/crow_wings_down.webp"
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: `calc(var(--bw) * 0.5)`, left: `calc(var(--bw) * -0.25)`, top: `calc(var(--bw) * -0.3)`, opacity: 0 }}
          />
        </div>
      </div>
      <p className="absolute bottom-[12vh] left-0 right-0 text-center font-fell text-[clamp(18px,2.4vw,26px)] italic text-ink/80">
        Unrolling the map…
      </p>
    </div>
  );
}
