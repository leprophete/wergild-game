import { COOLDOWN_MINUTES, MAX_FORCE_PER_CELL } from "@config/game";
import type { FactionId } from "@/lib/factions";
import { STATIC_CELLS, neighbors } from "./layout";
import { resolveOwner, type CellState } from "./state";

/**
 * Demo mode only (/map?demo): a local simulation to try the panel without a wallet.
 * The real game runs these rules in game_action() (Postgres, one transaction);
 * the browser never decides the outcome.
 */

export function deployBlocker(cells: CellState[], id: number, faction: FactionId): string | null {
  const sc = STATIC_CELLS[id];
  if (sc.kind === "blocked") return "The river cannot be held.";
  if (sc.baseOf && sc.baseOf !== faction) return "This base camp is impregnable.";
  const c = cells[id];
  if (c.owner === faction) return null;
  if (neighbors(id).some((n) => cells[n].owner === faction)) return null;
  return "Your Banner holds no adjacent cell.";
}

export function maxDeployable(c: CellState, reserve: number) {
  return Math.max(0, Math.min(reserve, MAX_FORCE_PER_CELL - c.mine));
}

export function applyDeploy(cells: CellState[], id: number, faction: FactionId, amount: number, now: number) {
  const c = cells[id];
  const forces = { ...c.forces, [faction]: (c.forces[faction] ?? 0) + amount };
  const next: CellState = {
    ...c,
    forces,
    mine: c.mine + amount,
    owner: STATIC_CELLS[id].baseOf ?? resolveOwner(c.owner, forces),
    wetUntil: now + COOLDOWN_MINUTES * 60_000,
  };
  const out = cells.slice();
  out[id] = next;
  return { cells: out, took: next.owner !== c.owner ? next.owner : null };
}

export function applyWithdraw(cells: CellState[], id: number, faction: FactionId, amount: number) {
  const c = cells[id];
  const forces = { ...c.forces, [faction]: Math.max(0, (c.forces[faction] ?? 0) - amount) };
  const next: CellState = {
    ...c,
    forces,
    mine: c.mine - amount,
    owner: STATIC_CELLS[id].baseOf ?? resolveOwner(c.owner, forces),
  };
  if (next.mine <= 0) next.wetUntil = null;
  const out = cells.slice();
  out[id] = next;
  return { cells: out, lostTo: next.owner !== c.owner ? next.owner : undefined };
}
