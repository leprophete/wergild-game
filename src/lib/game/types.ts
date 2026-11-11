import type { FactionId } from "@/lib/factions";

/** GET /api/me */
export interface MeResponse {
  wallet: string;
  faction: FactionId | null;
  excluded: boolean;
  /** raw token balance (base units), as a string to keep precision */
  balance: string;
  soldiers: number;
  ageDays: number;
  veteranMultiplier: number;
  force: number;
  reserve: number;
  deployed: number;
  switchesLeft: number;
  /** my deployments in the active season, by local cell id (y * 48 + x) */
  deployments: { cell: number; force: number; lockedUntil: number }[];
  cellsHeld: number;
  renown: number;
  badges: string[];
}

/** GET /api/factions */
export interface BannerStatus {
  faction: FactionId;
  members: number;
  force: number;
  sharePct: number;
  closed: boolean;
}
