"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { cellLabel } from "@/lib/map/layout";
import { generateFakeWorld } from "@/lib/map/fakeState";
import { applyDeploy, applyWithdraw } from "@/lib/map/demoActions";
import { payloadToCells } from "@/lib/map/remote";
import { useLiveMap } from "@/lib/map/useLiveMap";
import { playerForce, type CellState, type FeedEntry, type GameEvent, type PlayerState } from "@/lib/map/state";
import type { MapFilter } from "@/lib/map/render";
import { supabaseConfigured } from "@/lib/supabase/client";
import MapCanvas from "./MapCanvas";
import { MiniBanners, TopBar } from "./TopBar";
import { CellPanel, HomelandCard, MyArmy, SpectatorCard } from "./SidePanel";
import { ActivityFeed } from "./ActivityFeed";
import { MapFilters } from "./MapFilters";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const roman = (n: number) => (n === 0 ? "0" : (["", "I", "II", "III", "IV", "V"][n] ?? String(n)));

interface World {
  mode: "live" | "demo";
  cells: CellState[];
  events: GameEvent[];
  feed: FeedEntry[];
  season: { number: number; name: string; startsAt: number; endsAt: number };
  scores: Record<FactionId, number>;
  /** null = spectator (wallet connection arrives in step 3) */
  player: PlayerState | null;
}

/** Live data from Supabase; demo data when Supabase isn't configured or with ?demo in the URL. */
function useWorld() {
  const [demo] = useState(
    () => !supabaseConfigured || (typeof window !== "undefined" && new URLSearchParams(location.search).has("demo")),
  );
  const { payload, status } = useLiveMap(!demo);
  const [world, setWorld] = useState<World | null>(null);
  const prevOwners = useRef<(FactionId | null)[] | null>(null);

  useEffect(() => {
    if (demo) setWorld({ mode: "demo", ...generateFakeWorld(Date.now()) });
  }, [demo]);

  useEffect(() => {
    if (demo || !payload) return;
    const cells = payloadToCells(payload);
    // activity feed: what changed hands since the last snapshot
    const fresh: FeedEntry[] = [];
    const prev = prevOwners.current;
    if (prev) {
      for (const c of cells) {
        if (prev[c.id] === c.owner) continue;
        const at = Date.now();
        fresh.push({
          id: `${at}-${c.id}`,
          at,
          text: c.owner ? `${FACTION_BY_ID[c.owner].name} took ${cellLabel(c.id)}` : `${cellLabel(c.id)} fell silent`,
        });
      }
    }
    prevOwners.current = cells.map((c) => c.owner);
    setWorld((w) => ({
      mode: "live",
      cells,
      events: payload.events,
      feed: [...fresh.slice(0, 6), ...(w?.mode === "live" ? w.feed : [])].slice(0, 20),
      season: payload.season,
      scores: payload.scores,
      player: null,
    }));
  }, [demo, payload]);

  return { world, setWorld, status: demo ? ("demo" as const) : status };
}

export default function MapClient() {
  const { world, setWorld, status } = useWorld();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const now = useNow();

  const deployed = useMemo(() => (world ? world.cells.reduce((s, c) => s + c.mine, 0) : 0), [world]);
  const me = world?.player ?? null;
  const reserve = me ? playerForce(me) - deployed : 0;

  const select = useCallback((id: number | null) => {
    setSelected(id);
    if (id !== null) setDrawerOpen(true);
  }, []);

  if (!world) {
    const msg =
      status === "offline"
        ? "The map could not be reached. Retrying…"
        : status === "no-season"
          ? "No season is running. The Banners rest."
          : "Unrolling the map…";
    return <div className="grid h-dvh place-items-center bg-charcoal font-fell text-lg italic text-parchment/70">{msg}</div>;
  }

  const feedPush = (text: string) =>
    setWorld((w) => w && { ...w, feed: [{ id: `l${Date.now()}`, at: Date.now(), text }, ...w.feed].slice(0, 20) });

  // Demo only: local simulation. Live actions arrive in step 5 (server-side Postgres function).
  const deploy = (amount: number) => {
    if (selected === null || !me) return;
    const { cells, took } = applyDeploy(world.cells, selected, me.faction, amount, Date.now());
    setWorld({ ...world, cells });
    if (took) feedPush(`${FACTION_BY_ID[took].name} took ${cellLabel(selected)}`);
  };
  const withdraw = (amount: number) => {
    if (selected === null || !me) return;
    const { cells, lostTo } = applyWithdraw(world.cells, selected, me.faction, amount);
    setWorld({ ...world, cells });
    if (lostTo !== undefined)
      feedPush(lostTo ? `${FACTION_BY_ID[lostTo].name} took ${cellLabel(selected)}` : `${cellLabel(selected)} fell silent`);
  };

  const cellPanel =
    selected !== null ? (
      <CellPanel
        cells={world.cells}
        cellId={selected}
        player={me}
        reserve={reserve}
        events={world.events}
        onDeploy={deploy}
        onWithdraw={withdraw}
        onClose={() => setSelected(null)}
      />
    ) : null;
  const footnote =
    world.mode === "demo"
      ? "Demo data · generated locally."
      : `Live · Season ${roman(world.season.number)} · updates in real time${status === "offline" ? " (reconnecting…)" : ""}.`;
  const panel = (
    <>
      {me ? <MyArmy player={me} deployed={deployed} /> : <SpectatorCard />}
      {cellPanel ?? (me ? <HomelandCard factionId={me.faction} /> : null)}
      <p className="mt-6 text-[11px] text-parchment/35">{footnote}</p>
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-charcoal text-parchment">
      <TopBar seasonNumber={world.season.number} seasonName={world.season.name} endsAt={world.season.endsAt} now={now}>
        <MiniBanners scores={world.scores} myFaction={me?.faction ?? null} />
      </TopBar>
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <MapCanvas
            cells={world.cells}
            myFaction={me?.faction ?? null}
            selectedId={selected}
            filter={filter}
            events={world.events}
            seasonTitle={world.season.name}
            seasonSub={`Season ${roman(world.season.number)} of $WERGILD · the war of the five Banners`}
            onSelect={select}
          />
          <MapFilters value={filter} onChange={setFilter} />
          {world.feed.length > 0 && (
            <div className="max-md:bottom-[76px] max-md:absolute max-md:inset-x-0">
              <ActivityFeed entries={world.feed} now={now} />
            </div>
          )}
        </main>

        {/* desktop: right panel */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-gold/30 bg-[#191613] p-5 md:block">{panel}</aside>

        {/* mobile: bottom drawer */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 rounded-t-xl border-t border-gold/40 bg-[#191613] shadow-[0_-8px_24px_rgba(0,0,0,0.6)] transition-transform duration-300 md:hidden ${
            drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-64px)]"
          }`}
        >
          <button className="flex h-16 w-full items-center justify-between px-4" onClick={() => setDrawerOpen((o) => !o)}>
            {me ? (
              <>
                <span className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={FACTION_BY_ID[me.faction].crest} alt="" className="h-8 w-auto" />
                  <span className="font-display text-xs tracking-[0.18em] text-gold">MY ARMY</span>
                </span>
                <span className="font-mono text-sm">
                  {playerForce(me).toLocaleString("en-US")}{" "}
                  <span className="text-parchment/50">· reserve {reserve.toLocaleString("en-US")}</span>
                </span>
              </>
            ) : (
              <span className="font-display text-xs tracking-[0.18em] text-gold">SPECTATOR</span>
            )}
            <span className={`text-parchment/60 transition ${drawerOpen ? "rotate-180" : ""}`}>⌃</span>
          </button>
          <div className="max-h-[62dvh] overflow-y-auto px-4 pb-6 [&>section:first-child]:mt-0 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
            {cellPanel ?? panel}
          </div>
        </div>
      </div>
    </div>
  );
}
