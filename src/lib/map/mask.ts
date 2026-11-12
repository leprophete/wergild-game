import type { FactionId } from "@/lib/factions";

/**
 * LAND / WATER MASK of public/map/world.png — one character per cell (48 × 30).
 *   .  land (playable)
 *   ~  sea or river (not playable)
 *   =  bridge (playable, crosses the river)
 *
 * Built from the image: the sea by colour analysis, the river, the island and the
 * four bridges cell by cell from full-resolution crops; land cut off from every
 * homeland (islets) is treated as sea. Without the bridges the land splits in three:
 * the west (Goblins, Changelings), the east (Unburied, Wretches) and Knave's Hollow.
 *
 * STATUS: PROPOSAL — review it at /dev/mask. The database is updated only once validated.
 */
export const WORLD_MASK: string[] = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 0
  "~~~...~~~~.......~~~~~~~~~~~~~...~~..~..~~~~~~~~", // 1
  "~~.....~..............~~~~~~~...............~~~~", // 2
  "~~~~~~.................~~~.~...............~~~~~", // 3
  "~~~~~...................~~....................~~", // 4
  "~~~......................~~...................~~", // 5
  "~........................~~...................~~", // 6
  "~~.......................~~...................~~", // 7
  "~~~.....................~~~...................~~", // 8
  "~~~.....................~~~...................~~", // 9
  "~~...................~~~~~~~~.................~~", // 10
  "~..................~~~~~~~~~~~................~~", // 11
  "~................===........====.............~~~", // 12
  "~~..............~~~~.........~~~.............~~~", // 13
  "~~..............~~~..........~~~..............~~", // 14
  "~~..............~~~..........~~~..............~~", // 15
  "~~~~.............~~~~.......~~~~..............~~", // 16
  "~~................~~~~.....~~~~...............~~", // 17
  "~...................==....===.................~~", // 18
  "~....................~~~~~~~...................~", // 19
  "~......................~~~~....................~", // 20
  "~~......................~~~....................~", // 21
  "~~.......................~~~..................~~", // 22
  "~~......................~~~~.................~~~", // 23
  "~~~~.~~................~~~~~.................~~~", // 24
  "~~~~~~~...............~~~~~................~~~~~", // 25
  "~~~~~~~~..............~~~~~.......~~~......~~~~~", // 26
  "~~~~~~~~~...~~~....~~~~~~~~.....~~~~~~~~~~~~~~~~", // 27
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 28
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", // 29
];

/** Proposed 2×2 base camps (top-left cell), on the landmarks the image draws. */
export const BASE_CAMPS: Record<FactionId, { x: number; y: number }> = {
  goblins: { x: 14, y: 6 }, // the mine entrances
  changelings: { x: 10, y: 17 }, // the stilt village in the fen
  knaves: { x: 24, y: 13 }, // the walled town on the island
  unburied: { x: 37, y: 4 }, // the ruined cathedral
  wretches: { x: 36, y: 19 }, // the burning windmill
};

/** Proposed watchtowers (bonus cells, 3 points an hour): two per side of the river, two on the island. */
export const WATCHTOWER_CELLS: [number, number][] = [
  [13, 8],
  [34, 8],
  [9, 15],
  [38, 15],
  [13, 21],
  [34, 21],
  [22, 13],
  [26, 17],
];
