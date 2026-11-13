"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FACTION_BY_ID } from "@/lib/factions";
import type { RankingResponse } from "@/lib/game/ranking";
import { roman } from "@/lib/roman";
import { useSession } from "@/components/wallet/SessionProvider";
import { Crown } from "@/components/map/TopBar";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtRenown = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

/** Cord length, in px: the more points, the lower the Banner hangs. */
const MIN_DROP = 12;
const MAX_DROP = 150;

/*
 * Sizes are in cqw (the page's width) with a floor in px, so the page reads well both on a
 * wide screen and on a phone. Under 560 px of page, each row stacks on two lines.
 */
const T = {
  season: "text-[clamp(16px,2.8cqw,22px)]",
  heading: "text-[clamp(13px,2.2cqw,18px)]",
  name: "text-[clamp(16px,3cqw,24px)]",
  points: "text-[clamp(16px,2.9cqw,24px)]",
  perHour: "text-[clamp(12px,1.9cqw,15px)]",
  note: "text-[clamp(14px,2.2cqw,18px)]",
  row: "text-[clamp(14px,2.4cqw,19px)]",
  foot: "text-[clamp(13px,2cqw,16px)]",
  rankBox: "w-[clamp(34px,6.4cqw,54px)]",
  crestBox: "w-[clamp(34px,6.6cqw,56px)]",
  crest: "h-[clamp(32px,6cqw,52px)]",
  crestSmall: "h-[clamp(24px,4.4cqw,36px)]",
};

export default function RankingClient() {
  const { me: session } = useSession();
  const [data, setData] = useState<RankingResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ranking", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    // the score moves once an hour; a minute is plenty
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => clearInterval(t);
  }, [load, session?.wallet]);

  const myFaction = session?.faction ?? null;
  const meInTop = !!data?.me && data.players.some((p) => p.wallet === data.me!.wallet);

  return (
    <div className="mx-auto max-w-5xl overflow-x-clip">
      <IlluminatedPage>
        {!data ? (
          <p className={`py-10 text-center font-fell italic text-ink/80 ${T.season}`}>
            {failed ? "The heralds could not be reached. Try again in a moment." : "The heralds count the banners…"}
          </p>
        ) : (
          <>
            {data.season && (
              <p className={`text-center font-fell italic text-ink/85 ${T.season}`}>
                Season {roman(data.season.number)} · {data.season.name}
              </p>
            )}

            <section aria-labelledby="rk-banners" className="mt-[3cqw]">
              <h2 id="rk-banners" className={`font-display font-bold tracking-[0.2em] text-ink ${T.heading}`}>
                THE BANNERS
              </h2>
              <ol className="mt-2">
                {data.factions.map((f, i) => {
                  const fac = FACTION_BY_ID[f.id];
                  const mine = f.id === myFaction;
                  return (
                    <li
                      key={f.id}
                      className={`flex items-center gap-x-[clamp(6px,1.6cqw,14px)] border-b border-ink/30 py-[clamp(6px,1.2cqw,11px)] ${
                        mine ? "bg-[#c9a24b]/30" : ""
                      }`}
                    >
                      <Rank n={i + 1} lead={i === 0 && f.points > 0} />
                      <span className={`flex shrink-0 justify-center ${T.crestBox}`}>
                        <img src={fac.crest} alt="" className={`${T.crest} w-auto drop-shadow-[0_2px_2px_rgba(42,31,20,0.45)]`} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col @[560px]:flex-row @[560px]:items-center @[560px]:justify-between @[560px]:gap-3">
                        <Link
                          href={`/banner/${f.id}`}
                          className={`font-display font-semibold leading-tight tracking-[0.05em] text-ink hover:underline ${T.name}`}
                        >
                          {fac.name}
                          {mine && <span className="ml-2 font-sans text-[12px] uppercase tracking-wider text-[#5c3f0c]">yours</span>}
                        </Link>
                        <span className={`whitespace-nowrap font-mono text-ink @[560px]:text-right ${T.points}`}>
                          {fmt(f.points)}
                          <span className={`ml-2 text-ink/80 @[560px]:ml-0 @[560px]:block ${T.perHour}`}>+{fmt(f.lastHour)}/h</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-labelledby="rk-renown" className="mt-[4cqw]">
              <h2 id="rk-renown" className={`font-display font-bold tracking-[0.2em] text-ink ${T.heading}`}>
                RENOWN
              </h2>
              <p className={`mt-1 font-fell italic leading-snug text-ink/85 ${T.note}`}>
                A cell&apos;s points are shared among its holders, pro rata to their force there.
              </p>
              {data.players.length === 0 ? (
                <p className={`mt-3 font-fell italic text-ink/85 ${T.note}`}>No deed has been sung yet this season. The first hour will tell.</p>
              ) : (
                <ol className="mt-2">
                  {data.players.map((p) => (
                    <PlayerRow key={p.wallet} p={p} mine={p.wallet === data.me?.wallet} />
                  ))}
                  {data.me && !meInTop && (
                    <>
                      <li aria-hidden className="py-0.5 text-center text-ink/60">
                        ⋯
                      </li>
                      <PlayerRow p={data.me} mine />
                    </>
                  )}
                </ol>
              )}
            </section>

            <p className={`ml-[6cqw] mt-[3.5cqw] leading-snug text-ink/90 ${T.foot}`}>
              Scored every full hour (UTC), on each player&apos;s lowest force of the hour: 1 point per cell held (base camps
              excepted), 3 per watchtower, ×3 inside the Tithe.
              {data.lastTick && (
                <span suppressHydrationWarning> Last tick {new Date(data.lastTick).toISOString().slice(11, 16)} UTC.</span>
              )}
            </p>
          </>
        )}
      </IlluminatedPage>

      {data && <HangingBanners data={data} myFaction={myFaction} />}
    </div>
  );
}

/**
 * The illuminated page: ranking_frame.webp drawn with border-image, so the corners and the
 * cartouche keep their proportions whatever the length of the list (only the left vine repeats).
 * Every size is in cqw of the page width, the frame's own unit. The frame has a border on the
 * left and the bottom only: thin gold rules close it at the top and on the right.
 * Measured on the 2048 × 3072 original: slices top 480, right 120, bottom 700, left 600.
 * The leaf itself is an old grimoire page (scripts/gen-grimoire-paper.mjs), with a faint
 * esoteric seal and a double rule drawn in ink.
 */
function IlluminatedPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container mx-auto max-w-[940px]">
      <div className="relative mt-[15cqw]">
        {/* the grimoire leaf, inside the frame's rails */}
        <div aria-hidden className="grimoire-page absolute bottom-[3.2cqw] left-[5.6cqw] right-[4.9cqw] top-[8.9cqw] overflow-hidden rounded-[2px]">
          {/* double rule in ink, like a scribe's ruling */}
          <div className="absolute bottom-[3cqw] left-[22cqw] right-[4.2cqw] top-[12cqw] border border-ink/45" />
          <div className="absolute bottom-[3.7cqw] left-[22.7cqw] right-[4.9cqw] top-[12.7cqw] border-[0.5px] border-ink/30" />
          <Seal className="absolute left-[56%] top-[42%] w-[58cqw] -translate-x-1/2 -translate-y-1/2 opacity-[0.11]" />
          <SunMoon className="absolute bottom-[6cqw] right-[5cqw] w-[13cqw] opacity-[0.22]" />
        </div>
        {/* gold rules closing the page (under the frame, so its vines run over them): top, from the
            cartouche to the corner, and right, down to the gilded post of the bottom-right corner */}
        <div aria-hidden className="pointer-events-none absolute z-[1] left-[70cqw] right-[3.2cqw] top-[7.1cqw] h-[3px] rounded-full bg-gradient-to-r from-[#8a6a22] via-[#C9A24B] to-[#e8c468] shadow-[0_1px_0_rgba(0,0,0,0.6)]" />
        <div aria-hidden className="pointer-events-none absolute z-[1] left-[70cqw] right-[4.4cqw] top-[8.1cqw] h-px bg-gold/50" />
        <div aria-hidden className="pointer-events-none absolute z-[1] bottom-[32.6cqw] right-[3.2cqw] top-[7.1cqw] w-[3px] rounded-full bg-gradient-to-b from-[#e8c468] via-[#C9A24B] to-[#8a6a22] shadow-[1px_0_0_rgba(0,0,0,0.6)]" />
        <div aria-hidden className="pointer-events-none absolute z-[1] bottom-[32.6cqw] right-[4.4cqw] top-[8.1cqw] w-px bg-gold/50" />
        {/* the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            borderStyle: "solid",
            borderWidth: "23.44cqw 5.86cqw 34.18cqw 29.3cqw",
            borderImageSource: "url(/ornaments/web/ranking_frame.webp)",
            borderImageSlice: "328 82 479 410",
            borderImageRepeat: "stretch round",
          }}
        />
        {/* the title, in the cartouche */}
        <h1 className="absolute left-[28cqw] top-[5.4cqw] z-[3] flex h-[9.4cqw] w-[43cqw] items-center justify-center font-display text-[clamp(18px,4.4cqw,40px)] font-semibold tracking-[0.12em] text-ink [text-shadow:0_1px_0_rgba(255,244,214,0.6)]">
          The Ranking
        </h1>
        {/* the scribe, perched on the top-right corner and leaning out of the frame */}
        <img
          src="/ornaments/web/ranking_scribe.webp"
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute right-[max(-7cqw,-14px)] top-[-15cqw] z-[3] w-[24cqw] max-w-none select-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]"
        />
        {/* the list, clear of the vine on the left and of the flourishes at the bottom */}
        <div className="relative z-[3] pb-[31cqw] pl-[29.5cqw] pr-[11cqw] pt-[22cqw] text-ink">{children}</div>
      </div>
    </div>
  );
}

/** A faint esoteric seal behind the list: rings of runes, a triangle, planetary signs. */
function Seal({ className = "" }: { className?: string }) {
  const runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ".repeat(2);
  return (
    <svg viewBox="-100 -100 200 200" className={className} fill="none" stroke="#2A1F14">
      <circle r="96" strokeWidth="1.6" />
      <circle r="90" strokeWidth="0.7" />
      <circle r="72" strokeWidth="1.2" />
      <defs>
        <path id="runeRing" d="M0 -81 A81 81 0 1 1 -0.01 -81" />
      </defs>
      <text fontSize="9.5" fill="#2A1F14" stroke="none" letterSpacing="2.2">
        <textPath href="#runeRing">{runes}</textPath>
      </text>
      <path d="M0 -72 L62.4 36 L-62.4 36 Z" strokeWidth="1.3" />
      <path d="M0 72 L-62.4 -36 L62.4 -36 Z" strokeWidth="0.6" strokeDasharray="3 3" />
      <circle r="30" strokeWidth="1.1" />
      {[
        [0, -72, "♄"],
        [62.4, 36, "☿"],
        [-62.4, 36, "♃"],
      ].map(([x, y, s]) => (
        <g key={String(s)} transform={`translate(${x} ${y})`}>
          <circle r="11" fill="#d9bf8c" strokeWidth="1.1" />
          <text y="4.5" textAnchor="middle" fontSize="13" fill="#2A1F14" stroke="none">
            {s}
          </text>
        </g>
      ))}
      <text y="9" textAnchor="middle" fontSize="28" fill="#2A1F14" stroke="none" fontFamily="var(--nf-cinzel), serif">
        W
      </text>
    </svg>
  );
}

/** A small sun and crescent, as drawn in the margins of old grimoires. */
function SunMoon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} fill="none" stroke="#2A1F14" strokeWidth="1.3">
      <circle cx="28" cy="30" r="10" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        // rounded: the server and the browser must write the very same path (hydration)
        const p = (r: number) => `${(28 + Math.cos(a) * r).toFixed(2)} ${(30 + Math.sin(a) * r).toFixed(2)}`;
        return <path key={i} d={`M${p(14)} L${p(21)}`} />;
      })}
      <path d="M95 12 A18 18 0 1 0 95 48 A13 13 0 1 1 95 12 Z" fill="#2A1F14" fillOpacity="0.15" />
    </svg>
  );
}

/** Rank number; the leader's sits in the illuminated dropcap frame. */
function Rank({ n, lead }: { n: number; lead: boolean }) {
  if (lead) {
    return (
      <span className={`relative grid aspect-square shrink-0 place-items-center ${T.rankBox}`} aria-label="Rank 1">
        <img src="/ornaments/web/dropcap.webp" alt="" className="absolute inset-0 h-full w-full" />
        <span className="relative font-display text-[clamp(18px,3.4cqw,28px)] font-bold leading-none text-ink">1</span>
      </span>
    );
  }
  return (
    <span className={`grid shrink-0 place-items-center font-display text-[clamp(16px,2.8cqw,22px)] font-semibold text-ink/85 ${T.rankBox}`}>
      {n}
    </span>
  );
}

function PlayerRow({ p, mine }: { p: RankingResponse["players"][number]; mine: boolean }) {
  const fac = p.faction ? FACTION_BY_ID[p.faction] : null;
  return (
    <li
      className={`flex items-center gap-x-[clamp(6px,1.6cqw,14px)] border-b border-ink/30 py-[clamp(5px,0.9cqw,9px)] ${
        mine ? "bg-[#c9a24b]/30" : ""
      }`}
    >
      <span className={`shrink-0 text-center font-mono text-ink/85 ${T.rankBox} ${T.row}`}>{p.rank > 0 ? p.rank : "—"}</span>
      <span className={`flex shrink-0 justify-center ${T.crestBox}`}>
        {fac && <img src={fac.crest} alt={fac.name} title={fac.name} className={`${T.crestSmall} w-auto`} />}
      </span>
      <span className={`min-w-0 flex-1 truncate font-mono text-ink ${T.row}`} title={p.wallet}>
        {short(p.wallet)}
        {mine && <span className="ml-1.5 font-sans text-[12px] uppercase tracking-wider text-[#5c3f0c]">you</span>}
      </span>
      <span className={`shrink-0 text-right font-mono font-semibold text-ink ${T.row}`}>{fmtRenown(p.renown)}</span>
    </li>
  );
}

/** The five Banners on one rod, hanging lower the more they hold (SPEC). */
function HangingBanners({ data, myFaction }: { data: RankingResponse; myFaction: string | null }) {
  const max = Math.max(1, ...data.factions.map((f) => f.points));
  return (
    <section aria-label="Banners by season points" className="relative mx-auto mt-10 max-w-4xl">
      <div className="absolute inset-x-0 top-0 h-[5px] rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
      <ol className="flex items-start justify-around">
        {data.factions.map((f, i) => {
          const fac = FACTION_BY_ID[f.id];
          const drop = MIN_DROP + (MAX_DROP - MIN_DROP) * (f.points / max);
          const mine = f.id === myFaction;
          return (
            <li key={f.id} className="flex w-[19%] flex-col items-center">
              <div className="w-px bg-gold/50 transition-[height] duration-700" style={{ height: drop }} />
              <div className="flex h-4 items-end">{i === 0 && f.points > 0 ? <Crown /> : null}</div>
              <Link
                href={`/banner/${f.id}`}
                aria-label={`${fac.name}: the Banner's page`}
                className="banner-sway block"
                style={{ animationDelay: `${-i * 0.9}s` }}
              >
                <img
                  src={fac.banner}
                  alt=""
                  draggable={false}
                  className={`h-[160px] w-auto sm:h-[270px] ${
                    mine
                      ? "[filter:drop-shadow(0_0_6px_rgba(232,196,104,0.95))_drop-shadow(0_0_14px_rgba(201,162,75,0.7))]"
                      : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]"
                  }`}
                />
              </Link>
              <div className={`mt-2 text-center ${mine ? "text-gold" : "text-parchment/90"}`}>
                <div className="font-display text-[11px] tracking-[0.06em] sm:text-sm">{fac.name}</div>
                <div className="font-mono text-sm sm:text-lg">{fmt(f.points)} pts</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
