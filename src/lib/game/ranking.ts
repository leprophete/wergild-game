import type { FactionId } from "@/lib/factions";

export interface RankingResponse {
  season: { number: number; name: string } | null;
  factions: { id: FactionId; points: number; lastHour: number }[];
  /** best Renown first */
  players: { rank: number; wallet: string; faction: FactionId | null; renown: number }[];
  /** the signed-in player's line, even outside the top list */
  me: { rank: number; wallet: string; faction: FactionId | null; renown: number } | null;
  lastTick: number | null;
}
