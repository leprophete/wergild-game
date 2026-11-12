/**
 * Geometry checks for the zone frontiers. Run: npx tsx tests/zones.test.ts
 */
import assert from "node:assert/strict";
import { GRID_H, GRID_W } from "../config/game";
import { computeZones } from "../src/lib/map/zones";
import type { FactionId } from "../src/lib/factions";

const empty = () => new Array<FactionId | null>(GRID_W * GRID_H).fill(null);
const set = (o: (FactionId | null)[], x: number, y: number, f: FactionId) => (o[y * GRID_W + x] = f);
const allLand = () => true;
let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  " + name);
};

test("two separate blocks of one Banner are two zones, each with one closed ring", () => {
  const o = empty();
  for (let y = 5; y < 8; y++) for (let x = 5; x < 9; x++) set(o, x, y, "goblins");
  for (let y = 5; y < 7; y++) for (let x = 20; x < 22; x++) set(o, x, y, "goblins");
  const z = computeZones(o, allLand);
  assert.equal(z.length, 2);
  for (const zone of z) assert.equal(zone.rings.length, 1);
});

test("adjacent cells merge: an L shape is one zone, one ring", () => {
  const o = empty();
  for (let x = 10; x < 15; x++) set(o, x, 10, "knaves");
  for (let y = 10; y < 15; y++) set(o, 10, y, "knaves");
  const z = computeZones(o, allLand);
  assert.equal(z.length, 1);
  assert.equal(z[0].cells.length, 9);
  assert.equal(z[0].rings.length, 1);
});

test("an enclave makes a hole: outer ring + inner ring", () => {
  const o = empty();
  for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) set(o, x, y, "wretches");
  set(o, 12, 12, "goblins");
  const z = computeZones(o, allLand).filter((zz) => zz.owner === "wretches");
  assert.equal(z.length, 1);
  assert.equal(z[0].rings.length, 2);
});

test("cells touching only by a corner are separate zones", () => {
  const o = empty();
  set(o, 3, 3, "unburied");
  set(o, 4, 4, "unburied");
  assert.equal(computeZones(o, allLand).length, 2);
});

test("edges facing the water are never frontiers; frontiers stay on land", () => {
  const o = empty();
  for (let y = 10; y < 13; y++) for (let x = 10; x < 13; x++) set(o, x, y, "changelings");
  // water column right of the block
  const playable = (x: number) => x !== 13;
  const [zone] = computeZones(o, (x) => playable(x));
  const ring = zone.rings[0];
  for (let i = 0; i < ring.points.length; i++) {
    const a = ring.points[i];
    const b = ring.points[(i + 1) % ring.points.length];
    // a frontier segment fully on the water side (x > 13) would be a bug
    if (ring.frontier[i]) assert.ok(Math.min(a[0], b[0]) <= 13, `frontier over water at ${a} → ${b}`);
  }
  assert.ok(ring.frontier.some((f) => !f), "the side along the water has no frontier");
  assert.ok(ring.frontier.some((f) => f), "the land sides keep their frontier");
});

test("smoothing stays inside the cell-edge outline (Chaikin only cuts corners)", () => {
  const o = empty();
  for (let y = 5; y < 10; y++) for (let x = 5; x < 10; x++) set(o, x, y, "goblins");
  const [zone] = computeZones(o, allLand);
  for (const [x, y] of zone.rings[0].points) {
    assert.ok(x >= 5 - 1e-9 && x <= 10 + 1e-9 && y >= 5 - 1e-9 && y <= 10 + 1e-9);
  }
});

test("water cells are never part of a zone even if the data says they are owned", () => {
  const o = empty();
  set(o, 0, 0, "goblins");
  assert.equal(computeZones(o, (x, y) => !(x === 0 && y === 0)).length, 0);
});

test("crest sits inside its zone and grows with it", () => {
  const o = empty();
  set(o, 30, 20, "knaves");
  for (let y = 2; y < 8; y++) for (let x = 2; x < 10; x++) set(o, x, y, "goblins");
  const zs = computeZones(o, allLand);
  const small = zs.find((z) => z.owner === "knaves")!;
  const big = zs.find((z) => z.owner === "goblins")!;
  assert.deepEqual([small.crest.x, small.crest.y], [30.5, 20.5]);
  assert.ok(big.crest.size > small.crest.size);
  assert.ok(big.crest.x > 2 && big.crest.x < 10 && big.crest.y > 2 && big.crest.y < 8);
});

console.log(`\n${passed} zone tests passed`);
