import { TOKENS_PER_SOLDIER, TOKEN_DECIMALS, VETERAN_MAX_DAYS } from "@config/game";

/** Rule 1 — one soldier per TOKENS_PER_SOLDIER whole tokens. `rawBalance` is in base units. */
export function soldiersFromBalance(rawBalance: bigint | string | number): number {
  const raw = BigInt(typeof rawBalance === "number" ? Math.floor(rawBalance) : rawBalance);
  const unit = BigInt(10) ** BigInt(TOKEN_DECIMALS) * BigInt(TOKENS_PER_SOLDIER);
  return Number(raw / unit);
}

/** Rule 2 — seniority keeps growing from the last balance change. */
export function currentAgeDays(ageDays: number, ageUpdatedAt: number, now = Date.now()) {
  return Math.max(0, ageDays + (now - ageUpdatedAt) / 86_400_000);
}

export const veteranMultiplier = (ageDays: number) => 1 + Math.min(ageDays, VETERAN_MAX_DAYS) / VETERAN_MAX_DAYS;

export const forceOf = (soldiers: number, ageDays: number) => Math.floor(soldiers * veteranMultiplier(ageDays));
