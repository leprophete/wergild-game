"use client";

import { FACTIONS, type FactionId } from "@/lib/factions";

function formatRemaining(ms: number) {
  if (ms <= 0) return "The Knell tolls";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${p(h)}:${p(m)}:${p(s)}`;
}

const roman = (n: number) =>
  ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] ?? String(n);

export function TopBar({
  seasonNumber,
  seasonName,
  endsAt,
  now,
  children,
}: {
  seasonNumber: number;
  seasonName: string;
  endsAt: number;
  now: number;
  /** The miniature banners: they hang inside the header, never over the map. */
  children?: React.ReactNode;
}) {
  return (
    <header className="relative z-30 flex shrink-0 flex-col border-b border-gold/40 bg-charcoal md:h-[104px] md:flex-row md:items-start">
      <div className="pointer-events-none absolute inset-x-0 bottom-[3px] h-px bg-gold/20" />
      <div className="flex h-12 min-w-0 items-center gap-3 px-3 md:h-14 md:max-w-[calc(50%-180px)] md:px-5">
        <a href="/map" className="shrink-0 font-display text-lg font-bold tracking-[0.12em] text-gold md:text-xl">
          $WERGILD
        </a>
        <div className="hidden h-6 w-px shrink-0 bg-gold/30 sm:block" />
        <div className="min-w-0 leading-tight">
        <div className="truncate font-display text-[11px] tracking-[0.2em] text-parchment/90 md:text-xs">
          SEASON {roman(seasonNumber)} · {seasonName.toUpperCase()}
        </div>
        <div className="font-mono text-[11px] text-parchment/60 md:text-xs" suppressHydrationWarning>
          <span className="hidden sm:inline">The Knell in </span>
          <span className="text-parchment/90">{formatRemaining(endsAt - now)}</span>
        </div>
        </div>
      </div>
      {/* banner rail: its own row on mobile, centred in the header on desktop */}
      <div className="relative h-[66px] md:absolute md:inset-x-0 md:top-0 md:h-full md:pointer-events-none">{children}</div>
    </header>
  );
}

/** The five miniature banners hanging from the header rail; their length follows the season score. */
export function MiniBanners({
  scores,
  myFaction,
  onPick,
}: {
  scores: Record<FactionId, number>;
  myFaction: FactionId | null;
  onPick?: (f: FactionId) => void;
}) {
  const max = Math.max(1, ...Object.values(scores));
  const ranked = [...FACTIONS].sort((a, b) => scores[b.id] - scores[a.id]);
  const rank = Object.fromEntries(ranked.map((f, i) => [f.id, i + 1])) as Record<FactionId, number>;
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 items-start gap-3 md:gap-4">
      <div className="absolute -inset-x-3 top-[3px] h-[3px] rounded-full bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      {FACTIONS.map((f, i) => {
        const k = scores[f.id] / max;
        return (
          <button
            key={f.id}
            onClick={() => onPick?.(f.id)}
            className="banner-sway pointer-events-auto group flex flex-col items-center"
            style={{ animationDelay: `${-i * 0.9}s` }}
            title={`${f.name} — ${scores[f.id].toLocaleString("en-US")} pts`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.banner}
              alt={f.name}
              draggable={false}
              className="mini-banner w-auto drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] transition-[height] duration-700"
              style={{ ["--k" as string]: k }}
            />
            <span
              className={`-mt-1 rounded-sm border px-1 font-mono text-[9px] leading-4 md:text-[10px] ${
                f.id === myFaction ? "border-gold bg-charcoal text-gold" : "border-gold/30 bg-charcoal/90 text-parchment/80"
              }`}
            >
              <span className="text-parchment/50">#{rank[f.id]}</span> {scores[f.id].toLocaleString("en-US")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
