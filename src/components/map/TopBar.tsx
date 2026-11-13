"use client";

import { roman } from "@/lib/roman";
import Link from "next/link";
import { FACTIONS, type FactionId } from "@/lib/factions";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { SiteNav } from "@/components/SiteNav";
import { useNow } from "@/lib/useNow";

/** Only this span re-renders every second. */
export function Countdown({ endsAt }: { endsAt: number }) {
  const now = useNow(1000);
  // the server and the browser tick a second apart: the text may differ at hydration
  return (
    <span className="text-parchment/90" suppressHydrationWarning>
      {formatRemaining(endsAt - now)}
    </span>
  );
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "The Knell tolls";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${p(h)}:${p(m)}:${p(s)}`;
}


export function TopBar({
  seasonNumber,
  seasonName,
  endsAt,
  children,
}: {
  seasonNumber: number;
  seasonName: string;
  endsAt: number;
  /** The miniature banners: they hang inside the header, never over the map. */
  children?: React.ReactNode;
}) {
  return (
    <header className="relative z-30 flex shrink-0 flex-col border-b border-gold/40 bg-charcoal lg:h-[196px] lg:flex-row lg:items-start">
      <div className="pointer-events-none absolute inset-x-0 bottom-[3px] h-px bg-gold/20" />
      <div className="flex h-12 min-w-0 items-center gap-3 px-3 max-md:pr-36 md:px-5 lg:h-14 lg:max-w-[calc(50%-300px)] 2xl:max-w-[calc(50%-480px)]">
        <Link href="/" className="shrink-0 font-display text-lg font-bold tracking-[0.12em] text-gold md:text-xl">
          $WERGILD
        </Link>
        {/* the site menu, on the map too */}
        <div className="relative z-40 shrink-0">
          <SiteNav compact />
        </div>
        <div className="hidden h-6 w-px shrink-0 bg-gold/30 sm:block" />
        <div className="min-w-0 leading-tight">
        <div className="truncate font-display text-[11px] tracking-[0.2em] text-parchment/90 md:text-xs">
          SEASON {roman(seasonNumber)} · {seasonName.toUpperCase()}
        </div>
        <div className="whitespace-nowrap font-mono text-[11px] text-parchment/60 md:text-xs" suppressHydrationWarning>
          <span className="hidden sm:inline">The Knell in </span>
          <Countdown endsAt={endsAt} />
        </div>
        </div>
      </div>
      <ConnectButton className="absolute right-3 top-2 z-10 md:right-5 md:top-3" />
      {/* banner rail: its own row on mobile, centred in the header on desktop */}
      <div className="relative h-[132px] md:h-[192px] lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:h-full">{children}</div>
    </header>
  );
}

/** A small gold crown, above the leading Banner. */
export function Crown() {
  return (
    <svg viewBox="0 0 24 14" className="h-3 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] md:h-[14px] md:w-7" aria-label="First">
      <path
        d="M2 12 L3.5 3.5 L8 8 L12 1.5 L16 8 L20.5 3.5 L22 12 Z"
        fill="#C9A24B"
        stroke="#2A1F14"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="3.5" cy="3.2" r="1.3" fill="#E6D8B8" stroke="#2A1F14" strokeWidth="0.6" />
      <circle cx="12" cy="1.4" r="1.3" fill="#E6D8B8" stroke="#2A1F14" strokeWidth="0.6" />
      <circle cx="20.5" cy="3.2" r="1.3" fill="#E6D8B8" stroke="#2A1F14" strokeWidth="0.6" />
    </svg>
  );
}

/**
 * The five banners of the header, ranked by season score (highest on the left), with a
 * crown above the first. Under each: the Banner's name and its points. The player's own
 * Banner has a golden halo.
 */
export function MiniBanners({
  scores,
  myFaction,
  onPick,
}: {
  scores: Record<FactionId, number>;
  myFaction: FactionId | null;
  onPick?: (f: FactionId) => void;
}) {
  const ranked = FACTIONS.map((f, i) => ({ f, i }))
    .sort((a, b) => scores[b.f.id] - scores[a.f.id] || a.i - b.i)
    .map((e) => e.f);
  const leader = ranked[0];
  const leads = scores[leader.id] > 0;
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 items-start gap-1 md:gap-2">
      <div className="absolute -inset-x-3 top-[3px] h-[3px] rounded-full bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      {ranked.map((f, i) => {
        const mine = f.id === myFaction;
        const pts = scores[f.id].toLocaleString("en-US");
        return (
          <button
            key={f.id}
            onClick={() => onPick?.(f.id)}
            className="pointer-events-auto group flex w-[68px] flex-col items-center md:w-[128px] 2xl:w-[196px]"
            title={`#${i + 1} ${f.name} · ${pts} pts`}
            aria-label={`Rank ${i + 1}: ${f.name}, ${pts} points${mine ? " (your Banner)" : ""}`}
          >
            <div className="flex h-3 items-end md:h-[14px]">{i === 0 && leads ? <Crown /> : null}</div>
            <div className="banner-sway" style={{ animationDelay: `${-i * 0.9}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.banner}
                alt=""
                draggable={false}
                className={`h-[80px] w-auto md:h-[134px] ${
                  mine
                    ? "drop-shadow-[0_0_6px_rgba(232,196,104,0.95)] [filter:drop-shadow(0_0_6px_rgba(232,196,104,0.95))_drop-shadow(0_0_14px_rgba(201,162,75,0.7))]"
                    : "drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
                }`}
              />
            </div>
            <div
              className={`mt-0.5 text-center leading-tight ${mine ? "text-gold" : "text-parchment/85"}`}
            >
              <span className="block font-display text-[9px] leading-[10px] tracking-[0.04em] md:inline md:whitespace-nowrap md:text-[12px] md:leading-tight md:tracking-[0.06em]">{f.name}</span>
              {/* one line "The Goblins · 120 pts" when there is room, two lines otherwise */}
              <span className="hidden text-parchment/45 2xl:inline"> · </span>
              <span className="block whitespace-nowrap font-mono text-[10px] text-parchment/75 md:text-[12px] 2xl:inline">
                {pts} pts
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
