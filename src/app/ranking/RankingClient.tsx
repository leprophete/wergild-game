"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FACTION_BY_ID } from "@/lib/factions";
import type { RankingResponse } from "@/lib/game/ranking";
import { useSession } from "@/components/wallet/SessionProvider";
import { Crown } from "@/components/map/TopBar";
import { Divider, Lore } from "@/components/Ornaments";

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

  if (!data) {
    return (
      <p className="text-center font-fell italic text-parchment/60">
        {failed ? "The heralds could not be reached. Try again in a moment." : "The heralds count the banners…"}
      </p>
    );
  }

  const max = Math.max(1, ...data.factions.map((f) => f.points));
  const myFaction = session?.faction ?? null;
  const meInTop = data.me && data.players.some((p) => p.wallet === data.me!.wallet);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="text-center">
        <h1 className="font-display text-2xl tracking-[0.2em] text-gold">THE RANKING</h1>
        {data.season && (
          <p className="mt-1 font-fell text-lg italic text-parchment/75">
            Season {data.season.number} · {data.season.name}
          </p>
        )}
      </header>

      {/* the five Banners on one rod, hanging lower the more they hold */}
      <section aria-label="Banners by season points" className="relative mx-auto mt-8 max-w-3xl">
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
                <Link href={`/banner/${f.id}`} aria-label={`${fac.name}: the Banner's page`} className="banner-sway block" style={{ animationDelay: `${-i * 0.9}s` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <div className="font-display text-[10px] tracking-[0.06em] sm:text-sm">
                    <span className="text-parchment/45">#{i + 1}</span> {fac.name}
                  </div>
                  <div className="font-mono text-sm sm:text-lg">{fmt(f.points)} pts</div>
                  <div className="font-mono text-[11px] text-parchment/45">
                    +{fmt(f.lastHour)}
                    <span className="sm:hidden">/h</span>
                    <span className="hidden sm:inline"> last hour</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-center text-xs text-parchment/45">
          Scored every full hour (UTC), on each player&apos;s lowest force of the hour: 1 point per cell held (base camps excepted), 3 per
          watchtower, ×3 inside the Tithe.
          {data.lastTick && (
            <span suppressHydrationWarning> Last tick {new Date(data.lastTick).toISOString().slice(11, 16)} UTC.</span>
          )}
        </p>
      </section>

      <Divider className="mt-10" />

      <section aria-label="Renown of the players" className="mx-auto max-w-2xl">
        <h2 className="text-center font-display text-sm tracking-[0.18em] text-gold">RENOWN</h2>
        <p className="mt-1 text-center text-xs text-parchment/45">
          A cell&apos;s points are shared among its holders, pro rata to their force there.
        </p>
        {data.players.length === 0 ? (
          <Lore className="mx-auto mt-5 max-w-xl">No deed has been sung yet this season. The first hour will tell.</Lore>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gold/25 text-left text-[11px] uppercase tracking-wider text-parchment/45">
                <th className="w-12 py-1.5 pr-2 text-right font-medium">#</th>
                <th className="py-1.5 pl-2 font-medium">Wallet</th>
                <th className="py-1.5 font-medium">Banner</th>
                <th className="py-1.5 text-right font-medium">Renown</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p) => (
                <Row key={p.wallet} p={p} mine={p.wallet === data.me?.wallet} />
              ))}
              {data.me && !meInTop && (
                <>
                  <tr aria-hidden>
                    <td colSpan={4} className="py-1 text-center text-parchment/30">
                      ⋯
                    </td>
                  </tr>
                  <Row p={data.me} mine />
                </>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Row({ p, mine }: { p: RankingResponse["players"][number]; mine: boolean }) {
  const fac = p.faction ? FACTION_BY_ID[p.faction] : null;
  return (
    <tr className={`border-b border-white/5 ${mine ? "bg-gold/10 text-gold" : "text-parchment/85"}`}>
      <td className="py-1.5 pr-2 text-right font-mono text-parchment/55">{p.rank > 0 ? p.rank : "—"}</td>
      <td className="py-1.5 pl-2 font-mono" title={p.wallet}>
        {short(p.wallet)}
        {mine && <span className="ml-2 font-sans text-[11px] uppercase tracking-wider">you</span>}
      </td>
      <td className="py-1.5">
        {fac ? (
          <span className="inline-flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fac.crest} alt="" className="h-4 w-auto" />
            {fac.name}
          </span>
        ) : (
          <span className="text-parchment/40">—</span>
        )}
      </td>
      <td className="py-1.5 text-right font-mono">{fmtRenown(p.renown)}</td>
    </tr>
  );
}
