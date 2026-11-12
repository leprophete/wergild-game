/**
 * Banner page figures (/banner/[name]). Run: npx tsx tests/banner.test.ts
 */
import assert from "node:assert/strict";
import { countTowers, cumulative, summarize } from "../src/lib/game/bannerStats";
import { WATCHTOWER_CELLS } from "../src/lib/map/mask";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  " + name);
};

const H1 = "2026-11-12T14:00:00+00:00";
const H2 = "2026-11-12T15:00:00+00:00";
const H3 = "2026-11-12T16:00:00+00:00";
const ticks = [
  // given out of order, as a database may return them
  { faction_id: "goblins", points: 5, hour: H2 },
  { faction_id: "goblins", points: 3, hour: H1 },
  { faction_id: "wretches", points: 4, hour: H1 },
  { faction_id: "wretches", points: 4, hour: H2 },
  { faction_id: "goblins", points: 7, hour: H3 },
  { faction_id: "wretches", points: 1, hour: H3 },
  { faction_id: "knaves", points: 0, hour: H3 },
];

test("season total, last hour and rank of a Banner", () => {
  const s = summarize(ticks, "goblins");
  assert.equal(s.points, 15);
  assert.equal(s.lastHour, 7);
  assert.equal(s.rank, 1);
  const w = summarize(ticks, "wretches");
  assert.equal(w.points, 9);
  assert.equal(w.rank, 2);
});

test("the history is in hour order, one row per hour, zeros for silent Banners", () => {
  const { history } = summarize(ticks, "goblins");
  assert.deepEqual(
    history.map((h) => h.hour),
    [Date.parse(H1), Date.parse(H2), Date.parse(H3)],
  );
  assert.equal(history[0].points.unburied, 0);
  assert.equal(history[2].points.goblins, 7);
});

test("ties keep the SPEC order of the Banners", () => {
  const tie = [
    { faction_id: "wretches", points: 2, hour: H1 },
    { faction_id: "goblins", points: 2, hour: H1 },
  ];
  assert.equal(summarize(tie, "goblins").rank, 1);
  assert.equal(summarize(tie, "wretches").rank, 2);
  // nobody scored: everyone ranks in SPEC order, the last one fifth
  assert.equal(summarize([], "wretches").rank, 5);
  assert.equal(summarize([], "wretches").lastHour, 0);
});

test("unknown Banners in the data are ignored", () => {
  const s = summarize([...ticks, { faction_id: "pirates", points: 99, hour: H1 }], "goblins");
  assert.equal(s.points, 15);
  assert.equal(s.rank, 1);
});

test("the chart's running totals end on the season totals", () => {
  const { history } = summarize(ticks, "goblins");
  const c = cumulative(history);
  assert.deepEqual(c.goblins.map((p) => p[1]), [3, 8, 15]);
  assert.deepEqual(c.wretches.map((p) => p[1]), [4, 8, 9]);
  // each point sits at the END of its hour
  assert.equal(c.goblins[0][0], Date.parse(H1) + 3_600_000);
});

test("watchtowers held are counted from the map's towers", () => {
  const [tx, ty] = WATCHTOWER_CELLS[0];
  assert.equal(countTowers([[tx, ty], [0, 0]]), 1);
  assert.equal(countTowers([]), 0);
});

console.log(`\n${passed} banner tests passed`);
