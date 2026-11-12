import { BASE_CAMPS } from "@/lib/map/mask";

export type FactionId = "goblins" | "changelings" | "knaves" | "unburied" | "wretches";

export interface Faction {
  id: FactionId;
  name: string;
  motto: string;
  homeland: string;
  /** Map wash colour (SPEC palette). */
  color: string;
  /** Top-left cell of the 2×2 base camp. */
  base: { x: number; y: number };
  banner: string;
  crest: string;
  homelandImg: string;
}

const img = (kind: string, id: FactionId) => `/factions/${kind}/${id}.png`;

export const FACTIONS: Faction[] = [
  {
    id: "goblins",
    name: "The Goblins",
    motto: "All that glitters is ours",
    homeland: "The Gnawing Pits",
    color: "#5C8A3A",
    base: BASE_CAMPS.goblins,
    banner: img("banners", "goblins"),
    crest: img("crests", "goblins"),
    homelandImg: img("homelands", "goblins"),
  },
  {
    id: "changelings",
    name: "The Changelings",
    motto: "We were never yours",
    homeland: "The Cradle Fen",
    color: "#8DB3C7",
    base: BASE_CAMPS.changelings,
    banner: img("banners", "changelings"),
    crest: img("crests", "changelings"),
    homelandImg: img("homelands", "changelings"),
  },
  {
    id: "knaves",
    name: "The Knaves",
    motto: "Nothing belongs to anyone",
    homeland: "Knave's Hollow",
    color: "#7A2E5C",
    base: BASE_CAMPS.knaves,
    banner: img("banners", "knaves"),
    crest: img("crests", "knaves"),
    homelandImg: img("homelands", "knaves"),
  },
  {
    id: "unburied",
    name: "The Unburied",
    motto: "No grave can hold us",
    homeland: "The Weeping Barrows",
    color: "#3B3B3B",
    base: BASE_CAMPS.unburied,
    banner: img("banners", "unburied"),
    crest: img("crests", "unburied"),
    homelandImg: img("homelands", "unburied"),
  },
  {
    id: "wretches",
    name: "The Wretches",
    motto: "We are the many",
    homeland: "The Burnt Fields",
    color: "#B5552B",
    base: BASE_CAMPS.wretches,
    banner: img("banners", "wretches"),
    crest: img("crests", "wretches"),
    homelandImg: img("homelands", "wretches"),
  },
];

export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map((f) => [f.id, f])) as Record<FactionId, Faction>;
export const FACTION_IDS = FACTIONS.map((f) => f.id);
