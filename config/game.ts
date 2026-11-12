/**
 * $WERGILD — every tunable game parameter lives here (see SPEC.md, "Fichier de config").
 * Values are starting points, to be tuned after Season 0.
 */

// Rule 1 — Soldiers
export const TOKENS_PER_SOLDIER = 1_000;

// Rule 2 — Seniority & veteran bonus (force = soldiers × (1 + min(days, MAX) / MAX))
export const VETERAN_MAX_DAYS = 30;

// Rule 3 — Factions
export const FACTION_COUNT = 5;
export const FACTION_SWITCHES_PER_SEASON = 1;
/** A Banner is closed to newcomers above this share of the total force of all registered players (reserve included). */
export const FACTION_CAP_PCT = 35;

// Rule 4 — Deployment
export const MAX_FORCE_PER_CELL = 20_000;
export const COOLDOWN_MINUTES = 60;
export const BASE_CAMP_SIZE = 2;

// Rule 5 — Control: a cell is "contested" when the top two Banners are within this gap.
export const CONTESTED_GAP_PCT = 10;

// Map — garrison strength drawn as quill pawns (total force on the cell):
// below MEDIUM = 1 pawn (weak), from MEDIUM = 2 pawns, from STRONG = 3 pawns.
export const GARRISON_MEDIUM = 400;
export const GARRISON_STRONG = 2000;

// Rule 7 — Score (hourly, on the full UTC hour)
export const CELL_POINTS = 1;
export const BONUS_CELL_POINTS = 3;

// Rule 8 — Seasons (all times stored and computed in UTC)
export const SEASON_DAYS = 14;
/** Seasons start on Monday 17:00 UTC (18:00 Paris in winter, 19:00 in summer). */
export const SEASON_START_WEEKDAY_UTC = 1;
export const SEASON_START_HOUR_UTC = 17;

// Rule 9 — Events
export const EVENT_NOTICE_HOURS = 6;
export const TITHE_SIZE = 3;
export const TITHE_MULTIPLIER = 3;
export const TITHE_HOURS = 24;
export const PLAGUE_SIZE = 4;
export const RUSH_HOURS = 1;

// Anti-cheat
export const ACTIONS_PER_MINUTE = 30;
export const RECONCILE_MINUTES = 10;
export const NONCE_TTL_MINUTES = 5;

// Map
export const GRID_W = 48;
export const GRID_H = 30;

// Chain
export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";
/** Rule 10 — the developer's wallet, published on /rules (set at launch). */
export const DEV_WALLET = process.env.NEXT_PUBLIC_DEV_WALLET ?? "";
/** Rule 10 — liquidity pool, pump.fun bonding curve, dev wallet, known exchanges. */
export const EXCLUDED_WALLETS: string[] = [];

// Token & chain
/** pump.fun tokens use 6 decimals. */
export const TOKEN_DECIMALS = 6;
export const SOLANA_CLUSTER: "devnet" | "mainnet-beta" = "devnet";
/** "Recruit" / "Buy $WERGILD" link — pump.fun or Jupiter once the token exists. */
export const BUY_URL = "https://pump.fun";

// Session (Sign-In With Solana)
export const SESSION_DAYS = 7;
