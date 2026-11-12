"use client";

import { useCallback, useEffect, useState } from "react";
import { EVENT_NOTICE_HOURS, GRID_H, GRID_W, PLAGUE_SIZE, TITHE_SIZE } from "@config/game";
import { FACTION_BY_ID } from "@/lib/factions";
import type { AdminState } from "@/lib/game/admin";
import { roman } from "@/lib/roman";
import { useSession } from "@/components/wallet/SessionProvider";
import { useWalletModal } from "@/components/wallet/WalletModal";

type EventType = "tithe" | "plague" | "rush";
const EVENT_NAME: Record<EventType, string> = { tithe: "The Tithe", plague: "The Plague", rush: "The Rush" };
const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

async function post(path: string, body: object): Promise<string | null> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.message ?? `Error ${r.status}`;
  } catch {
    return "Network error.";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-gold/20 bg-white/[0.02] p-4 md:p-5">
      <h2 className="font-display text-sm tracking-[0.18em] text-gold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const input = "rounded border border-gold/30 bg-charcoal px-2 py-1 text-sm text-parchment outline-none focus:border-gold";
const btn = "rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-charcoal hover:brightness-110 disabled:opacity-40";
const ghost = "rounded-md border border-gold/40 px-3 py-1 text-xs text-gold hover:bg-gold/10 disabled:opacity-40";

export default function AdminClient() {
  const { status: sessionStatus, me } = useSession();
  const { open } = useWalletModal();
  const [state, setState] = useState<AdminState | null>(null);
  const [denied, setDenied] = useState<401 | 403 | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/state", { cache: "no-store" });
    if (r.status === 401 || r.status === 403) return setDenied(r.status);
    if (!r.ok) return setMsg({ ok: false, text: "Could not load the admin state." });
    setDenied(null);
    setState(await r.json());
  }, []);

  useEffect(() => {
    if (sessionStatus !== "loading") void load();
  }, [load, sessionStatus, me?.wallet]);

  const act = async (path: string, body: object, done: string) => {
    setBusy(true);
    setMsg(null);
    const err = await post(path, body);
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: done });
    if (!err) await load();
    return !err;
  };

  if (denied === 401 || (sessionStatus !== "loading" && sessionStatus !== "signed-in")) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl tracking-[0.2em] text-gold">ADMIN</h1>
        <p className="mt-2 text-parchment/70">Connect the admin wallet.</p>
        <button onClick={open} className={`${btn} mt-5 px-5 py-2`}>
          Connect wallet
        </button>
      </div>
    );
  }
  if (denied === 403) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl tracking-[0.2em] text-gold">ADMIN</h1>
        <p className="mt-2 text-parchment/70">This page is for the admin wallet only.</p>
      </div>
    );
  }
  if (!state) return <p className="text-center font-fell italic text-parchment/60">Opening the war room…</p>;

  const open_ = state.seasons.filter((s) => s.status !== "ended");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl tracking-[0.2em] text-gold">ADMIN</h1>
        <span className="font-mono text-xs text-parchment/50">{short(state.wallet)}</span>
      </header>
      {msg && (
        <p role="status" className={`rounded px-3 py-2 text-sm ${msg.ok ? "bg-[#2c3a1c] text-[#cfe3a8]" : "bg-[#3a1c1c] text-[#e7b4a8]"}`}>
          {msg.text}
        </p>
      )}

      <Section title="SEASONS">
        <SeasonsTable state={state} busy={busy} act={act} />
        {open_.length === 0 && <CreateSeason busy={busy} act={act} />}
      </Section>

      <Section title="EVENTS">
        <Events state={state} busy={busy} act={act} />
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="EXCLUDED WALLETS (RULE 10)">
          <Excluded state={state} busy={busy} act={act} />
        </Section>
        <Section title="PARAMETERS">
          <table className="w-full text-sm">
            <tbody>
              {state.params.map((p) => (
                <tr key={p.label} className="border-b border-white/5">
                  <td className="py-1 text-parchment/65">{p.label}</td>
                  <td className="break-all py-1 text-right font-mono text-parchment/90">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-parchment/45">
            Set in <code>config/game.ts</code>; a change takes effect at the next deploy. Values in force for a season
            are never changed mid-season.
          </p>
        </Section>
      </div>
    </div>
  );
}

type Act = (path: string, body: object, done: string) => Promise<boolean>;

function SeasonsTable({ state, busy, act }: { state: AdminState; busy: boolean; act: Act }) {
  const [rename, setRename] = useState<{ id: number; name: string } | null>(null);
  const [knell, setKnell] = useState<{ id: number; word: string } | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gold/25 text-left text-[11px] uppercase tracking-wider text-parchment/45">
            <th className="py-1.5 font-medium">#</th>
            <th className="py-1.5 font-medium">Name</th>
            <th className="py-1.5 font-medium">Dates</th>
            <th className="py-1.5 font-medium">Status</th>
            <th className="py-1.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {state.seasons.map((s) => (
            <tr key={s.id} className="border-b border-white/5 align-top">
              <td className="py-1.5 font-mono text-parchment/60">{roman(s.number)}</td>
              <td className="py-1.5">
                {rename?.id === s.id ? (
                  <form
                    className="flex gap-1"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await act("/api/admin/season", { action: "rename", seasonId: s.id, name: rename.name }, "Season renamed.")) setRename(null);
                    }}
                  >
                    <input className={`${input} w-48`} value={rename.name} maxLength={60} onChange={(e) => setRename({ id: s.id, name: e.target.value })} />
                    <button className={ghost} disabled={busy}>
                      Save
                    </button>
                  </form>
                ) : (
                  s.name
                )}
              </td>
              <td className="py-1.5 font-mono text-xs text-parchment/65">
                {utc(s.startsAt)}
                <br />→ {utc(s.endsAt)}
              </td>
              <td className="py-1.5">
                {s.status === "ended" ? `ended · ${s.winner ? FACTION_BY_ID[s.winner as keyof typeof FACTION_BY_ID]?.name : "no winner"}` : s.status}
              </td>
              <td className="py-1.5 text-right">
                {s.status !== "ended" && (
                  <div className="flex flex-col items-end gap-1">
                    <button className={ghost} onClick={() => setRename({ id: s.id, name: s.name })}>
                      Rename
                    </button>
                    {s.status === "active" &&
                      (knell?.id === s.id ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (await act("/api/admin/season", { action: "end", seasonId: s.id, confirm: knell.word }, "The knell has rung.")) setKnell(null);
                          }}
                        >
                          <input
                            className={`${input} w-24`}
                            placeholder="type KNELL"
                            value={knell.word}
                            onChange={(e) => setKnell({ id: s.id, word: e.target.value })}
                          />
                          <button className={`${ghost} border-[#b5543c] text-[#e7b4a8]`} disabled={busy || knell.word !== "KNELL"}>
                            Ring
                          </button>
                        </form>
                      ) : (
                        <button className={`${ghost} border-[#b5543c]/70 text-[#e7b4a8]`} onClick={() => setKnell({ id: s.id, word: "" })}>
                          Ring the knell now…
                        </button>
                      ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-parchment/45">
        The knell rings by itself at the end date (checked every minute): final score, archive, badges, soldiers back
        to reserve, and the next season opens on a fresh map named after the winner. Ringing it early ends the season
        now; the next one still opens on the planned Monday.
      </p>
    </div>
  );
}

/** Next Monday 17:00 UTC (rule 8), as yyyy-mm-dd. */
function nextMonday() {
  const d = new Date();
  const add = (8 - d.getUTCDay()) % 7 || 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add)).toISOString().slice(0, 10);
}

function CreateSeason({ busy, act }: { busy: boolean; act: Act }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(nextMonday);
  const [y, m, d] = date.split("-").map(Number);
  const startsAt = Date.UTC(y, m - 1, d, 17);
  const monday = new Date(startsAt).getUTCDay() === 1;
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 border-t border-gold/15 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void act("/api/admin/season", { action: "create", name, startsAt }, "Season planned.");
      }}
    >
      <label className="text-xs text-parchment/60">
        Name
        <input className={`${input} mt-0.5 block w-56`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="text-xs text-parchment/60">
        Monday (opens 17:00 UTC)
        <input type="date" className={`${input} mt-0.5 block`} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button className={btn} disabled={busy || name.trim().length < 3 || !monday}>
        Plan the season
      </button>
      {!monday && <span className="text-xs text-[#e7b4a8]">Pick a Monday.</span>}
    </form>
  );
}

function Events({ state, busy, act }: { state: AdminState; busy: boolean; act: Act }) {
  const [type, setType] = useState<EventType>("tithe");
  const soon = new Date(Date.now() + (EVENT_NOTICE_HOURS + 1) * 3_600_000);
  const [date, setDate] = useState(soon.toISOString().slice(0, 10));
  const [hour, setHour] = useState(soon.getUTCHours());
  const [zone, setZone] = useState<{ x: number; y: number } | null>(null);
  const size = type === "tithe" ? TITHE_SIZE : type === "plague" ? PLAGUE_SIZE : 0;
  const [yy, mm, dd] = date.split("-").map(Number);
  const startsAt = Date.UTC(yy, mm - 1, dd, hour);
  const tooSoon = startsAt < Date.now() + EVENT_NOTICE_HOURS * 3_600_000;
  const pick = (x: number, y: number) =>
    setZone({ x: Math.max(0, Math.min(GRID_W - size, x - Math.floor(size / 2))), y: Math.max(0, Math.min(GRID_H - size, y - Math.floor(size / 2))) });
  const now = Date.now();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div>
        <ZonePicker events={state.events} size={size} zone={size ? zone : null} onPick={pick} />
        <p className="mt-1 text-[11px] text-parchment/45">
          {size ? `Click the map to place the ${size}×${size} zone.` : "The Rush covers the whole map."} Dashed: events
          already planned.
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await act(
            "/api/admin/events",
            { action: "schedule", type, x: size ? (zone?.x ?? null) : null, y: size ? (zone?.y ?? null) : null, startsAt },
            `${EVENT_NAME[type]} announced for ${utc(startsAt)}.`,
          );
        }}
      >
        <div className="flex gap-1">
          {(["tithe", "plague", "rush"] as EventType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded px-2 py-1 text-xs ${type === t ? "bg-gold text-charcoal" : "border border-gold/30 text-parchment/75"}`}
            >
              {EVENT_NAME[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-parchment/55">
          {type === "tithe" && "3×3 zone worth ×3 points for 24 h. One per day."}
          {type === "plague" && "4×4 zone turned neutral; its soldiers go back to reserve. One per season."}
          {type === "rush" && "No wet ink for 1 hour. One per week."}
        </p>
        <div className="flex items-end gap-2">
          <label className="text-xs text-parchment/60">
            Day (UTC)
            <input type="date" className={`${input} mt-0.5 block`} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-xs text-parchment/60">
            Hour
            <select className={`${input} mt-0.5 block`} value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        {size > 0 && (
          <p className="font-mono text-xs text-parchment/70">
            Zone: {zone ? `x ${zone.x}–${zone.x + size - 1}, y ${zone.y}–${zone.y + size - 1}` : "none yet"}
          </p>
        )}
        {tooSoon && <p className="text-xs text-[#e7b4a8]">At least {EVENT_NOTICE_HOURS} h of notice.</p>}
        <button className={`${btn} w-full`} disabled={busy || tooSoon || (size > 0 && !zone)}>
          Announce {EVENT_NAME[type]}
        </button>
      </form>

      <div className="lg:col-span-2">
        {state.events.length === 0 ? (
          <p className="text-sm text-parchment/50">No event planned this season.</p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {state.events.map((e) => {
              const started = e.startsAt <= now;
              const over = e.type === "plague" ? e.appliedAt !== null : e.endsAt <= now;
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                  <span className="w-24 font-semibold text-parchment/90">{EVENT_NAME[e.type]}</span>
                  <span className="font-mono text-xs text-parchment/65">
                    {utc(e.startsAt)}
                    {e.type !== "plague" && ` → ${utc(e.endsAt)}`}
                  </span>
                  {e.zone && <span className="font-mono text-xs text-parchment/50">({e.zone.x},{e.zone.y}) {e.zone.w}×{e.zone.h}</span>}
                  <span className="text-xs text-parchment/45">Season {roman(e.seasonNumber)}</span>
                  <span className="ml-auto text-xs text-parchment/55">
                    {over ? (e.type === "plague" ? "struck" : "over") : started ? "under way" : "announced"}
                  </span>
                  {!started && (
                    <button className={ghost} disabled={busy} onClick={() => void act("/api/admin/events", { action: "cancel", eventId: e.id }, "Event called off.")}>
                      Call off
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ZonePicker({
  events,
  size,
  zone,
  onPick,
}: {
  events: AdminState["events"];
  size: number;
  zone: { x: number; y: number } | null;
  onPick: (x: number, y: number) => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm border border-gold/30 ${size ? "cursor-crosshair" : ""}`}
      style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
      onClick={(e) => {
        if (!size) return;
        const r = e.currentTarget.getBoundingClientRect();
        onPick(Math.floor(((e.clientX - r.left) / r.width) * GRID_W), Math.floor(((e.clientY - r.top) / r.height) * GRID_H));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/map/world-1600.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <svg viewBox={`0 0 ${GRID_W} ${GRID_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {events
          .filter((e) => e.zone && !(e.type === "plague" && e.appliedAt))
          .map((e) => (
            <rect
              key={e.id}
              x={e.zone!.x}
              y={e.zone!.y}
              width={e.zone!.w}
              height={e.zone!.h}
              fill="none"
              stroke={e.type === "tithe" ? "#E8C468" : "#b5543c"}
              strokeWidth={0.15}
              strokeDasharray="0.4 0.3"
            />
          ))}
        {zone && size > 0 && (
          <rect x={zone.x} y={zone.y} width={size} height={size} fill="rgba(232,196,104,0.35)" stroke="#E8C468" strokeWidth={0.2} />
        )}
      </svg>
    </div>
  );
}

function Excluded({ state, busy, act }: { state: AdminState; busy: boolean; act: Act }) {
  const [wallet, setWallet] = useState("");
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("/api/admin/excluded", { wallet: wallet.trim(), excluded: true }, "Wallet excluded; its soldiers left the map.")) setWallet("");
        }}
      >
        <input className={`${input} min-w-0 flex-1 font-mono`} placeholder="Wallet address" value={wallet} onChange={(e) => setWallet(e.target.value)} />
        <button className={btn} disabled={busy || wallet.trim().length < 32}>
          Exclude
        </button>
      </form>
      <p className="mt-1 text-[11px] text-parchment/45">Pool, bonding curve, dev wallet, known exchanges. Excluding removes its soldiers from the map at once.</p>
      {state.excluded.length === 0 ? (
        <p className="mt-3 text-sm text-parchment/50">No wallet excluded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5 text-sm">
          {state.excluded.map((p) => (
            <li key={p.wallet} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={p.wallet}>
                {p.wallet}
              </span>
              <button className={ghost} disabled={busy} onClick={() => void act("/api/admin/excluded", { wallet: p.wallet, excluded: false }, "Wallet readmitted.")}>
                Readmit
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
