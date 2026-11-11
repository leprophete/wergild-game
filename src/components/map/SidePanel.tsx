"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BUY_URL, COOLDOWN_MINUTES, MAX_FORCE_PER_CELL, VETERAN_MAX_DAYS } from "@config/game";
import { useWalletModal } from "@/components/wallet/WalletModal";
import { FACTION_BY_ID } from "@/lib/factions";
import { STATIC_CELLS, cellLabel } from "@/lib/map/layout";
import {
  isContested,
  playerForce,
  rankedForces,
  veteranMultiplier,
  type CellState,
  type GameEvent,
  type PlayerState,
} from "@/lib/map/state";
import { inZone } from "@/lib/map/state";
import { deployBlocker, maxDeployable } from "@/lib/map/demoActions";

const fmt = (n: number) => n.toLocaleString("en-US");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gold/20 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-parchment/50">{label}</div>
      <div className="font-mono text-base text-parchment">{value}</div>
      {hint && <div className="text-[10px] text-parchment/45">{hint}</div>}
    </div>
  );
}

export function MyArmy({ player, deployed }: { player: PlayerState; deployed: number }) {
  const f = FACTION_BY_ID[player.faction];
  const force = playerForce(player);
  const mult = veteranMultiplier(player.ageDays);
  return (
    <section>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.crest} alt="" className="h-12 w-auto drop-shadow" />
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-gold">MY ARMY</h2>
          <div className="truncate text-sm text-parchment/85">
            {f.name} ·{" "}
            <span className="font-mono text-parchment/60">
              {player.wallet.length > 12 ? `${player.wallet.slice(0, 4)}…${player.wallet.slice(-4)}` : player.wallet}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Total force" value={fmt(force)} hint={`${fmt(player.soldiers)} soldiers × ${mult.toFixed(2)}`} />
        <Stat label="Reserve" value={fmt(force - deployed)} hint={`${fmt(deployed)} deployed`} />
        <Stat label="Seniority" value={`${player.ageDays} d`} hint={`×2 at ${VETERAN_MAX_DAYS} days`} />
        <Stat label="Veteran bonus" value={`+${Math.round((mult - 1) * 100)}%`} />
      </div>
      {player.soldiers === 0 && <RecruitNotice />}
    </section>
  );
}

function useMinuteTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);
}

export function CellPanel({
  cells,
  cellId,
  player,
  reserve,
  events,
  onDeploy,
  onWithdraw,
  onClose,
  actionsLocked,
}: {
  cells: CellState[];
  cellId: number;
  /** null = spectator: read-only, no actions */
  player: PlayerState | null;
  /** when set, actions are not available yet and this explains why */
  actionsLocked?: string;
  reserve: number;
  events: GameEvent[];
  onDeploy: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onClose: () => void;
}) {
  useMinuteTick();
  const c = cells[cellId];
  const sc = STATIC_CELLS[cellId];
  const owner = c.owner ? FACTION_BY_ID[c.owner] : null;
  const ranked = rankedForces(c);
  const total = ranked.reduce((s, r) => s + r.force, 0);
  const contested = isContested(c);
  const now = Date.now();
  const wetMin = c.wetUntil && c.wetUntil > now ? Math.ceil((c.wetUntil - now) / 60_000) : 0;
  const blocker = player ? deployBlocker(cells, cellId, player.faction) : "Connect your wallet to deploy.";
  const maxDeploy = blocker ? 0 : maxDeployable(c, reserve);
  const [mode, setMode] = useState<"deploy" | "withdraw">("deploy");
  const max = mode === "deploy" ? maxDeploy : wetMin ? 0 : c.mine;
  const [amount, setAmount] = useState(0);
  useEffect(() => setAmount(0), [cellId, mode]);
  const amt = Math.min(amount, max);
  const cellEvents = events.filter((e) => e.endsAt > now && inZone(sc.x, sc.y, e.zone));

  const tags: string[] = [];
  if (sc.baseOf) tags.push(`Base camp of ${FACTION_BY_ID[sc.baseOf].name}`);
  if (sc.kind === "bonus") tags.push("Watchtower · 3 pts/h");
  if (sc.kind === "bridge") tags.push("Bridge");
  if (sc.kind === "blocked") tags.push("River · impassable");
  if (sc.region && !sc.baseOf) tags.push(FACTION_BY_ID[sc.region].homeland);

  return (
    <section className="mt-5 border-t border-gold/25 pt-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-parchment/50">Cell</div>
          <h3 className="font-mono text-xl text-parchment">{cellLabel(cellId)}</h3>
        </div>
        <button onClick={onClose} className="rounded px-2 py-1 text-parchment/60 hover:bg-white/5 hover:text-parchment" aria-label="Close">
          ✕
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-sm border border-gold/30 px-1.5 py-0.5 text-[11px] text-parchment/75">
            {t}
          </span>
        ))}
        {contested && <span className="rounded-sm border border-blood bg-blood/25 px-1.5 py-0.5 text-[11px] text-[#e7b4a8]">Contested</span>}
        {cellEvents.map((e) => (
          <span key={e.id} className="rounded-sm border border-gold bg-gold/15 px-1.5 py-0.5 text-[11px] text-gold">
            {e.type === "tithe" ? "The Tithe ×3" : e.type === "plague" ? "The Plague is coming" : "The Rush"}
          </span>
        ))}
      </div>

      {sc.kind !== "blocked" && (
        <>
          <div className="mt-4 flex items-center gap-3">
            {owner ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={owner.crest} alt="" className="h-10 w-auto" />
                <div>
                  <div className="font-display text-sm tracking-wider text-parchment">{owner.name.toUpperCase()}</div>
                  <div className="font-fell text-sm italic text-parchment/60">“{owner.motto}”</div>
                </div>
              </>
            ) : (
              <div className="font-fell italic text-parchment/60">Unclaimed land. No Banner flies here.</div>
            )}
          </div>

          {ranked.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {ranked.map((r) => {
                const f = FACTION_BY_ID[r.faction];
                return (
                  <li key={r.faction} className="text-sm">
                    <div className="flex justify-between">
                      <span className={r.faction === c.owner ? "text-parchment" : "text-parchment/65"}>{f.name}</span>
                      <span className="font-mono text-parchment/85">{fmt(r.force)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full" style={{ width: `${(r.force / total) * 100}%`, background: f.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!player || actionsLocked ? (
            <div className="mt-4 rounded-md border border-gold/20 bg-white/[0.03] p-3 text-sm text-parchment/60">
              {player && (
                <div className="mb-2 flex items-baseline justify-between text-parchment/80">
                  <span>My soldiers here</span>
                  <span className="font-mono text-parchment">{fmt(c.mine)}</span>
                </div>
              )}
              {actionsLocked ?? "Connect your wallet to deploy or withdraw soldiers here."}
            </div>
          ) : (
          <div className="mt-4 rounded-md border border-gold/20 bg-white/[0.03] p-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-parchment/70">My soldiers here</span>
              <span className="font-mono text-parchment">{fmt(c.mine)}</span>
            </div>
            {wetMin > 0 && (
              <div className="mt-1 text-xs text-[#9fb0d8]">Ink still wet · locked for {wetMin} min</div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-black/30 p-1 text-sm">
              {(["deploy", "withdraw"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded py-1.5 font-medium capitalize ${mode === m ? "bg-gold text-charcoal" : "text-parchment/70 hover:text-parchment"}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {mode === "deploy" && blocker && <p className="mt-3 text-xs text-[#e7b4a8]">{blocker}</p>}
            {mode === "withdraw" && c.mine === 0 && <p className="mt-3 text-xs text-parchment/55">You have no soldiers on this cell.</p>}
            {mode === "withdraw" && c.mine > 0 && wetMin > 0 && (
              <p className="mt-3 text-xs text-parchment/55">Soldiers can leave once the ink has dried ({COOLDOWN_MINUTES} min cooldown).</p>
            )}

            {max > 0 && (
              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={Math.max(1, Math.round(max / 200))}
                  value={amt}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-[#C9A24B]"
                  aria-label="Amount"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <input
                    type="number"
                    min={0}
                    max={max}
                    value={amt}
                    onChange={(e) => setAmount(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
                    className="w-28 rounded border border-gold/30 bg-black/30 px-2 py-1 font-mono text-sm text-parchment"
                  />
                  <button onClick={() => setAmount(max)} className="text-xs text-gold hover:underline">
                    Max {fmt(max)}
                  </button>
                </div>
                <button
                  disabled={amt <= 0}
                  onClick={() => (mode === "deploy" ? onDeploy(amt) : onWithdraw(amt))}
                  className="mt-3 w-full rounded-md bg-gold py-2 text-sm font-semibold text-charcoal transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {mode === "deploy" ? `Deploy ${fmt(amt)}` : `Withdraw ${fmt(amt)}`}
                </button>
                {mode === "deploy" && (
                  <p className="mt-2 text-[11px] text-parchment/45">
                    Max {fmt(MAX_FORCE_PER_CELL)} force per player per cell. Soldiers stay {COOLDOWN_MINUTES} min.
                  </p>
                )}
              </div>
            )}
          </div>
          )}
        </>
      )}
    </section>
  );
}

export function SpectatorCard() {
  const { open } = useWalletModal();
  return (
    <section>
      <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-gold">SPECTATOR</h2>
      <p className="mt-2 text-sm text-parchment/70">
        You are watching the war. Tap a cell to see which Banners hold it and with what force.
      </p>
      <button
        onClick={open}
        className="mt-4 w-full rounded-md bg-gold py-2 text-sm font-semibold text-charcoal transition hover:brightness-110"
      >
        Connect wallet to play
      </button>
    </section>
  );
}

/** Signed in, but no oath sworn yet. */
export function ChooseBannerCard({ soldiers }: { soldiers: number }) {
  return (
    <section>
      <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-gold">NO BANNER YET</h2>
      <p className="mt-2 text-sm text-parchment/70">Swear your oath to one of the five Banners to march on the map.</p>
      <Link
        href="/join"
        className="mt-4 block w-full rounded-md bg-gold py-2 text-center text-sm font-semibold text-charcoal transition hover:brightness-110"
      >
        Choose a Banner
      </Link>
      {soldiers === 0 && <RecruitNotice />}
    </section>
  );
}

/** Onboarding step 3: no $WERGILD yet. */
export function RecruitNotice() {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-blood/60 bg-blood/15 px-3 py-2">
      <span className="text-sm text-parchment/85">You have 0 soldiers.</span>
      <a
        href={BUY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded bg-gold px-2.5 py-1 text-xs font-semibold text-charcoal hover:brightness-110"
      >
        Recruit
      </a>
    </div>
  );
}

export function HomelandCard({ factionId }: { factionId: PlayerState["faction"] }) {
  const f = FACTION_BY_ID[factionId];
  return (
    <section className="mt-5 border-t border-gold/25 pt-4">
      <p className="text-sm text-parchment/60">Tap a cell to inspect it, deploy or withdraw.</p>
      <div className="mt-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.homelandImg} alt={f.homeland} className="h-20 w-auto" />
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-parchment/50">Homeland</div>
          <div className="font-fell text-lg italic text-parchment">{f.homeland}</div>
          <div className="font-display text-[11px] tracking-[0.15em] text-gold/80">{f.motto.toUpperCase()}</div>
        </div>
      </div>
    </section>
  );
}
