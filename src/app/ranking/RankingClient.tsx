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
    <div className="mx-auto max-w-4xl overflow-x-clip">
      <IlluminatedPage>
        {!data ? (
          <p className="py-10 text-center font-fell text-lg italic text-ink/70">
            {failed ? "The heralds could not be reached. Try again in a moment." : "The heralds count the banners…"}
          </p>
        ) : (
          <>
            {data.season && (
              <p className="text-center font-fell text-[clamp(14px,2.4cqw,19px)] italic text-ink/80">
                Season {roman(data.season.number)} · {data.season.name}
              </p>
            )}

            <section aria-labelledby="rk-banners" className="mt-[2.5cqw]">
              <h2 id="rk-banners" className="font-display text-[clamp(11px,1.8cqw,14px)] font-semibold tracking-[0.2em] text-ink">
                THE BANNERS
              </h2>
              <ol className="mt-1.5">
                {data.factions.map((f, i) => {
                  const fac = FACTION_BY_ID[f.id];
                  const mine = f.id === myFaction;
                  return (
                    <li
                      key={f.id}
                      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-[1.6cqw] border-b border-ink/15 py-[0.9cqw] ${
                        mine ? "bg-gold/20" : ""
                      }`}
                    >
                      <Rank n={i + 1} lead={i === 0 && f.points > 0} />
                      <span className="flex w-[clamp(24px,4.8cqw,38px)] justify-center">
                        <img src={fac.crest} alt="" className="h-[clamp(20px,4.2cqw,34px)] w-auto" />
                      </span>
                      <Link
                        href={`/banner/${f.id}`}
                        className="font-display text-[clamp(12px,2.2cqw,17px)] leading-tight tracking-[0.06em] text-ink hover:underline"
                      >
                        {fac.name}
                        {mine && <span className="ml-1.5 font-sans text-[10px] uppercase tracking-wider text-[#7a5a14]">yours</span>}
                      </Link>
                      <span className="text-right font-mono text-[clamp(12px,2.2cqw,17px)] text-ink">
                        {fmt(f.points)}
                        <span className="block text-[clamp(9px,1.5cqw,11px)] text-ink/55">+{fmt(f.lastHour)}/h</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-labelledby="rk-renown" className="mt-[3.5cqw]">
              <h2 id="rk-renown" className="font-display text-[clamp(11px,1.8cqw,14px)] font-semibold tracking-[0.2em] text-ink">
                RENOWN
              </h2>
              <p className="mt-0.5 font-fell text-[clamp(12px,1.9cqw,15px)] italic text-ink/70">
                A cell&apos;s points are shared among its holders, pro rata to their force there.
              </p>
              {data.players.length === 0 ? (
                <p className="mt-3 font-fell italic text-ink/70">No deed has been sung yet this season. The first hour will tell.</p>
              ) : (
                <ol className="mt-1.5">
                  {data.players.map((p) => (
                    <PlayerRow key={p.wallet} p={p} mine={p.wallet === data.me?.wallet} />
                  ))}
                  {data.me && !meInTop && (
                    <>
                      <li aria-hidden className="py-0.5 text-center text-ink/40">
                        ⋯
                      </li>
                      <PlayerRow p={data.me} mine />
                    </>
                  )}
                </ol>
              )}
            </section>

            <p className="ml-[3cqw] mt-[3cqw] text-[clamp(10px,1.6cqw,12px)] leading-snug text-ink/60">
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
 */
function IlluminatedPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[760px] [container-type:inline-size]">
      <div className="relative mt-[15cqw]">
        {/* parchment, inside the frame's rails */}
        <div
          aria-hidden
          className="absolute bottom-[3.2cqw] left-[5.6cqw] right-[4.9cqw] top-[8.9cqw] rounded-[2px] bg-[radial-gradient(ellipse_at_45%_35%,#efe3c6_0%,#e6d8b8_55%,#cdb88d_100%)] shadow-[inset_0_0_40px_rgba(110,80,40,0.35)]"
        />
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
        <h1 className="absolute left-[28cqw] top-[5.4cqw] z-[3] flex h-[9.4cqw] w-[43cqw] items-center justify-center font-display text-[clamp(16px,4.4cqw,34px)] font-semibold tracking-[0.12em] text-ink [text-shadow:0_1px_0_rgba(255,244,214,0.6)]">
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
        <div className="relative z-[3] pb-[31cqw] pl-[29.5cqw] pr-[8cqw] pt-[22cqw] text-ink">{children}</div>
      </div>
    </div>
  );
}

/** Rank number; the leader's sits in the illuminated dropcap frame. */
function Rank({ n, lead }: { n: number; lead: boolean }) {
  if (lead) {
    return (
      <span className="relative grid h-[clamp(30px,6cqw,46px)] w-[clamp(30px,6cqw,46px)] place-items-center" aria-label="Rank 1">
        <img src="/ornaments/web/dropcap.webp" alt="" className="absolute inset-0 h-full w-full" />
        <span className="relative font-display text-[clamp(14px,2.8cqw,22px)] font-bold leading-none text-ink">1</span>
      </span>
    );
  }
  return (
    <span className="grid w-[clamp(30px,6cqw,46px)] place-items-center font-display text-[clamp(13px,2.2cqw,17px)] text-ink/70">
      {n}
    </span>
  );
}

function PlayerRow({ p, mine }: { p: RankingResponse["players"][number]; mine: boolean }) {
  const fac = p.faction ? FACTION_BY_ID[p.faction] : null;
  return (
    <li
      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-[1.6cqw] border-b border-ink/15 py-[0.7cqw] ${
        mine ? "bg-gold/20" : ""
      }`}
    >
      <span className="w-[clamp(30px,6cqw,46px)] text-center font-mono text-[clamp(11px,1.9cqw,15px)] text-ink/60">
        {p.rank > 0 ? p.rank : "—"}
      </span>
      <span className="flex w-[clamp(24px,4.8cqw,38px)] justify-center">
        {fac && <img src={fac.crest} alt={fac.name} title={fac.name} className="h-[clamp(16px,3.2cqw,26px)] w-auto" />}
      </span>
      <span className="truncate font-mono text-[clamp(11px,1.9cqw,15px)] text-ink" title={p.wallet}>
        {short(p.wallet)}
        {mine && <span className="ml-1.5 font-sans text-[10px] uppercase tracking-wider text-[#7a5a14]">you</span>}
      </span>
      <span className="text-right font-mono text-[clamp(11px,1.9cqw,15px)] text-ink">{fmtRenown(p.renown)}</span>
    </li>
  );
}

/** The five Banners on one rod, hanging lower the more they hold (SPEC). */
function HangingBanners({ data, myFaction }: { data: RankingResponse; myFaction: string | null }) {
  const max = Math.max(1, ...data.factions.map((f) => f.points));
  return (
    <section aria-label="Banners by season points" className="relative mx-auto mt-10 max-w-3xl">
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
                  className={`h-[130px] w-auto sm:h-[200px] ${
                    mine
                      ? "[filter:drop-shadow(0_0_6px_rgba(232,196,104,0.95))_drop-shadow(0_0_14px_rgba(201,162,75,0.7))]"
                      : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]"
                  }`}
                />
              </Link>
              <div className={`mt-2 text-center ${mine ? "text-gold" : "text-parchment/90"}`}>
                <div className="font-display text-[10px] tracking-[0.06em] sm:text-sm">{fac.name}</div>
                <div className="font-mono text-sm sm:text-lg">{fmt(f.points)} pts</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
