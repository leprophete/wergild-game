"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { cellLabel } from "@/lib/map/layout";
import { generateFakeWorld } from "@/lib/map/fakeState";
import { applyDeploy, applyWithdraw } from "@/lib/map/demoActions";
import { payloadToCells } from "@/lib/map/remote";
import { useLiveMap } from "@/lib/map/useLiveMap";
import { playerForce, type CellState, type FeedEntry, type GameEvent, type PlayerState } from "@/lib/map/state";
import { filterMatches, type MapFilter } from "@/lib/map/render";
import { supabaseConfigured } from "@/lib/supabase/client";
import MapCanvas from "./MapCanvas";
import { MiniBanners, TopBar } from "./TopBar";
import { CellPanel, ChooseBannerCard, HomelandCard, MyArmy, SpectatorCard } from "./SidePanel";
import { useSession } from "@/components/wallet/SessionProvider";
import { ActivityFeed } from "./ActivityFeed";
import { MapFilters } from "./MapFilters";
import { MapFrame, PanelCrown } from "@/components/Ornaments";

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
  const session = useSession();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const live = world?.mode === "live";
  const account = live && session.status === "signed-in" ? session.me : null;

  // Every live map update may concern me too (a sale trimmed by the webhook, an action from
  // another tab): re-read my army alongside. /api/me re-reads the chain at most once a minute.
  const { refresh: refreshMe, status: sessionStatus } = session;
  const mapVersion = live ? world?.cells : null;
  useEffect(() => {
    if (mapVersion && sessionStatus === "signed-in") void refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVersion]);

  // Live: my soldiers come from GET /api/me, laid over the public map.
  const cells = useMemo(() => {
    if (!world || !live || !account) return world?.cells ?? [];
    const mine = new Map(account.deployments.map((d) => [d.cell, d]));
    if (mine.size === 0) return world.cells;
    return world.cells.map((c) => {
      const d = mine.get(c.id);
      return d ? { ...c, mine: d.force, wetUntil: d.lockedUntil > Date.now() ? d.lockedUntil : null } : c;
    });
  }, [world, live, account]);

  const me: PlayerState | null = !world
    ? null
    : live
      ? account?.faction
        ? { wallet: account.wallet, faction: account.faction, soldiers: account.soldiers, ageDays: account.ageDays }
        : null
      : world.player;
  const deployed = useMemo(() => cells.reduce((s, c) => s + c.mine, 0), [cells]);
  const filterCount = useMemo(
    () => (filter === "all" ? 0 : filterMatches(cells, world?.events ?? [], filter, Date.now()).length),
    [cells, world?.events, filter],
  );
  const reserve = me ? playerForce(me) - deployed : 0;

  // Move: after choosing an amount, the next tap on the map picks the destination.
  const [moveFrom, setMoveFrom] = useState<{ cell: number; amount: number } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const moveRef = useRef(moveFrom);
  moveRef.current = moveFrom;

  const post = useCallback(
    async (path: string, body: object): Promise<string | null> => {
      try {
        const r = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return j.message ?? "The order was refused.";
        await session.refresh(); // my soldiers and reserve; the map itself updates through Realtime
        return null;
      } catch {
        return "The messenger was lost. Check your connection.";
      }
    },
    [session],
  );

  const select = useCallback(
    (id: number | null) => {
      const m = moveRef.current;
      if (m && id !== null && id !== m.cell) {
        setMoveError(null);
        void post("/api/move", { fromCellId: m.cell, toCellId: id, amount: m.amount }).then((err) => {
          if (err) setMoveError(err);
          else {
            setMoveFrom(null);
            setSelected(id);
          }
        });
        return;
      }
      setSelected(id);
      if (id !== null) setDrawerOpen(true);
    },
    [post],
  );

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

  // Live: the server decides (POST /api/deploy, /api/withdraw, /api/move). Demo: local simulation.
  const deploy = async (amount: number) => {
    if (selected === null || !me) return null;
    if (live) return post("/api/deploy", { cellId: selected, amount });
    const { cells, took } = applyDeploy(world.cells, selected, me.faction, amount, Date.now());
    setWorld({ ...world, cells });
    if (took) feedPush(`${FACTION_BY_ID[took].name} took ${cellLabel(selected)}`);
    return null;
  };
  const withdraw = async (amount: number) => {
    if (selected === null || !me) return null;
    if (live) return post("/api/withdraw", { cellId: selected, amount });
    const { cells, lostTo } = applyWithdraw(world.cells, selected, me.faction, amount);
    setWorld({ ...world, cells });
    if (lostTo !== undefined)
      feedPush(lostTo ? `${FACTION_BY_ID[lostTo].name} took ${cellLabel(selected)}` : `${cellLabel(selected)} fell silent`);
    return null;
  };

  const cellPanel =
    selected !== null ? (
      <CellPanel
        cells={cells}
        cellId={selected}
        player={me}
        reserve={reserve}
        events={world.events}
        onDeploy={deploy}
        onWithdraw={withdraw}
        onMove={live ? (amount) => (setMoveError(null), setMoveFrom({ cell: selected, amount }), setDrawerOpen(false)) : undefined}
        onClose={() => setSelected(null)}
      />
    ) : null;
  const footnote =
    world.mode === "demo"
      ? "Demo data · generated locally."
      : `Live · Season ${roman(world.season.number)} · updates in real time${status === "offline" ? " (reconnecting…)" : ""}.`;
  const panel = (
    <>
      <PanelCrown className="-mt-1 mb-4" />
      {me ? (
        <MyArmy player={me} deployed={deployed} />
      ) : account ? (
        <ChooseBannerCard soldiers={account.soldiers} />
      ) : (
        <SpectatorCard />
      )}
      {cellPanel ?? (me ? <HomelandCard factionId={me.faction} /> : null)}
      <p className="mt-6 text-[11px] text-parchment/35">{footnote}</p>
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-charcoal text-parchment">
      <TopBar seasonNumber={world.season.number} seasonName={world.season.name} endsAt={world.season.endsAt}>
        <MiniBanners scores={world.scores} myFaction={me?.faction ?? null} />
      </TopBar>
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <MapCanvas
            cells={cells}
            myFaction={me?.faction ?? null}
            selectedId={selected}
            filter={filter}
            events={world.events}
            seasonTitle={world.season.name}
            seasonSub={`Season ${roman(world.season.number)} of $WERGILD · the war of the five Banners`}
            onSelect={select}
          />
          <MapFrame />
          <MapFilters
            value={filter}
            onToggle={(f) => setFilter((cur) => (cur === f ? "all" : f))}
            matches={filterCount}
          />
          {moveFrom && (
            <div className="absolute inset-x-3 top-14 z-20 mx-auto flex max-w-md items-center gap-3 rounded-md border border-gold bg-charcoal/95 px-3 py-2 text-sm shadow-xl">
              <span className="flex-1 text-parchment/90">
                March <span className="font-mono text-gold">{moveFrom.amount.toLocaleString("en-US")}</span> from{" "}
                {cellLabel(moveFrom.cell)}: tap the destination.
                {moveError && <span className="mt-0.5 block text-xs text-[#e7b4a8]">{moveError}</span>}
              </span>
              <button onClick={() => setMoveFrom(null)} className="rounded border border-gold/40 px-2 py-1 text-xs text-parchment/80">
                Cancel
              </button>
            </div>
          )}
          {world.feed.length > 0 && (
            <div className="max-md:bottom-[76px] max-md:absolute max-md:inset-x-0">
              <ActivityFeed entries={world.feed} />
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
              <span className="font-display text-xs tracking-[0.18em] text-gold">{account ? "CHOOSE A BANNER" : "SPECTATOR"}</span>
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
