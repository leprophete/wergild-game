import { CONTESTED_GAP_PCT, VETERAN_MAX_DAYS } from "@config/game";
import { FACTION_IDS, type FactionId } from "@/lib/factions";

/** Dynamic, per-season state of a cell (what the server will send in step 2). */
export interface CellState {
  id: number;
  owner: FactionId | null;
  /** Total force per Banner present on the cell. */
  forces: Partial<Record<FactionId, number>>;
  /** Force deployed by the current player on this cell. */
  mine: number;
  /** "Wet ink": epoch ms until which my soldiers are locked here. */
  wetUntil: number | null;
  /** Server-computed flag (live data). When absent, it is derived from the forces. */
  contested?: boolean;
}

export interface PlayerState {
  wallet: string;
  faction: FactionId;
  soldiers: number;
  ageDays: number;
}

export type EventType = "tithe" | "plague" | "rush";
export interface GameEvent {
  id: string;
  type: EventType;
  zone: { x: number; y: number; w: number; h: number } | null;
  announcedAt: number;
  startsAt: number;
  endsAt: number;
}

export interface FeedEntry {
  id: string;
  at: number;
  text: string;
}

export const playerForce = (p: Pick<PlayerState, "soldiers" | "ageDays">) =>
  Math.floor(p.soldiers * (1 + Math.min(p.ageDays, VETERAN_MAX_DAYS) / VETERAN_MAX_DAYS));

export const veteranMultiplier = (ageDays: number) => 1 + Math.min(ageDays, VETERAN_MAX_DAYS) / VETERAN_MAX_DAYS;

export const totalForce = (c: CellState) => FACTION_IDS.reduce((s, f) => s + (c.forces[f] ?? 0), 0);

/** Banners present on a cell, strongest first. */
export function rankedForces(c: CellState): { faction: FactionId; force: number }[] {
  return FACTION_IDS.map((f) => ({ faction: f, force: c.forces[f] ?? 0 }))
    .filter((e) => e.force > 0)
    .sort((a, b) => b.force - a.force);
}

/** Rule 5: strongest Banner owns the cell; on a tie, the previous owner keeps it. */
export function resolveOwner(prev: FactionId | null, forces: Partial<Record<FactionId, number>>): FactionId | null {
  let best = 0;
  let leaders: FactionId[] = [];
  for (const f of FACTION_IDS) {
    const v = forces[f] ?? 0;
    if (v <= 0) continue;
    if (v > best) {
      best = v;
      leaders = [f];
    } else if (v === best) leaders.push(f);
  }
  if (leaders.length === 0) return null;
  if (leaders.length === 1) return leaders[0];
  // a tie among challengers that excludes the holder leaves the cell without a lord
  return prev && leaders.includes(prev) ? prev : null;
}

/** Contested: the top two Banners are within CONTESTED_GAP_PCT of each other. */
export function isContested(c: CellState): boolean {
  if (c.contested !== undefined) return c.contested;
  const r = rankedForces(c);
  if (r.length < 2) return false;
  return (r[0].force - r[1].force) / r[0].force < CONTESTED_GAP_PCT / 100;
}

export const inZone = (x: number, y: number, z: GameEvent["zone"]) =>
  !!z && x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
