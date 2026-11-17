import assert from "node:assert/strict";
import { test } from "node:test";
import { cellCenter, Grid, loadMap, TILE } from "./grid.ts";
import { nextCell, Walker } from "./walker.ts";

// Seeded random (mulberry32), so a path is the same on every run.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 5x3 map with a 3x1 corridor: (1,1) (2,1) (3,1).
const corridor = () =>
  Grid.fromTiled({
    layers: [
      {
        name: "Blocks",
        width: 5,
        height: 3,
        data: [1, 1, 1, 1, 1, 1, 6, 6, 6, 1, 1, 1, 1, 1, 1],
        properties: { wall: 1, box: 5, empty: 6, max_players: 2 },
      },
    ],
  });

test("walker returns null when no neighbour is walkable", () => {
  const grid = corridor();
  grid.addBomb({ col: 1, row: 1 });
  grid.addBomb({ col: 3, row: 1 });
  assert.equal(nextCell(grid, { col: 2, row: 1 }, null, seeded(1)), null);

  const walker = new Walker(grid, { col: 2, row: 1 }, 150, seeded(1));
  const first = walker.tick(100);
  const second = walker.tick(100);
  assert.equal(first.moved, false);
  assert.equal(second.moved, false);
  assert.deepEqual(
    { x: second.x, y: second.y },
    cellCenter({ col: 2, row: 1 }),
  );
});

test("nextCell avoids going back when another way exists", () => {
  const grid = loadMap("default_map");
  // (6,2) is a spawn; try many random draws: never back to `previous` if
  // another walkable neighbour exists.
  const from = { col: 6, row: 2 };
  const options = [
    { col: 7, row: 2 },
    { col: 5, row: 2 },
    { col: 6, row: 1 },
    { col: 6, row: 3 },
  ].filter(c => grid.isWalkable(c));
  if (options.length < 2) {
    return;
  }
  const previous = options[0];
  const random = seeded(7);
  for (let i = 0; i < 50; i++) {
    assert.notDeepEqual(nextCell(grid, from, previous, random), previous);
  }
});

test("nextCell goes back in a dead end", () => {
  const grid = corridor();
  assert.deepEqual(
    nextCell(grid, { col: 1, row: 1 }, { col: 2, row: 1 }, seeded(3)),
    { col: 2, row: 1 },
  );
});

test("one second at 150 px/s moves 150 px", () => {
  // A straight 1x12 corridor: no turn, so the distance is easy to read.
  const grid = Grid.fromTiled({
    layers: [
      {
        name: "Blocks",
        width: 14,
        height: 3,
        data: [
          ...Array(14).fill(1),
          1,
          ...Array(12).fill(6),
          1,
          ...Array(14).fill(1),
        ],
        properties: { wall: 1, box: 5, empty: 6, max_players: 2 },
      },
    ],
  });
  const walker = new Walker(grid, { col: 1, row: 1 }, 150, seeded(1));
  let pos = walker.tick(100);
  for (let i = 1; i < 10; i++) {
    pos = walker.tick(100);
  }
  assert.equal(pos.x - cellCenter({ col: 1, row: 1 }).x, 150);
});

test("the walker stays on walkable cells", () => {
  const grid = loadMap("default_map");
  for (const spawn of grid.spawns) {
    const walker = new Walker(grid, spawn, 150, seeded(spawn.col));
    for (let i = 0; i < 200; i++) {
      walker.tick(100);
      assert.ok(grid.isWalkable(walker.cell()), "stays on walkable cells");
    }
  }
});

test("the same seed gives the same path", () => {
  const grid = loadMap("default_map");
  const path = (seed: number) => {
    const walker = new Walker(grid, grid.spawns[3], 150, seeded(seed));
    return Array.from({ length: 30 }, () => walker.tick(100));
  };
  assert.deepEqual(path(9), path(9));
});

test("avoid turns the walker away from a cell", () => {
  const grid = corridor();
  const walker = new Walker(grid, { col: 2, row: 1 }, 150, () => 0);
  walker.avoid({ col: 1, row: 1 });
  walker.tick(100);
  assert.ok(walker.target().col === 3, "goes to the far side");
  assert.equal(TILE, 35);
});
