import assert from "node:assert/strict";
import { test } from "node:test";
import { cellCenter, Grid, loadMap, spawnCell } from "./grid.ts";

// 4x3 map: walls round a 2x1 corridor. 1 = wall, 5 = box, 6 = empty.
const tiny = (data: number[]) => ({
  layers: [
    {
      name: "Blocks",
      width: 4,
      height: 3,
      data,
      properties: { wall: 1, box: 5, empty: 6, max_players: 2 },
    },
  ],
});

test("default_map has its size, limit and spawns", () => {
  const grid = loadMap("default_map");
  assert.equal(grid.width, 32);
  assert.equal(grid.height, 21);
  assert.equal(grid.maxPlayers, 14);
  assert.equal(grid.spawns.length, 14);
});

test("every default_map spawn is walkable", () => {
  const grid = loadMap("default_map");
  for (const spawn of grid.spawns) {
    assert.ok(grid.isWalkable(spawn), `spawn ${spawn.col},${spawn.row}`);
  }
});

test("walls, boxes and cells outside the map are not walkable", () => {
  const grid = Grid.fromTiled(tiny([1, 1, 1, 1, 1, 6, 5, 1, 1, 1, 1, 1]));
  assert.equal(grid.isWalkable({ col: 0, row: 0 }), false);
  assert.equal(grid.isWalkable({ col: 1, row: 1 }), true);
  assert.equal(grid.isWalkable({ col: 2, row: 1 }), false);
  assert.equal(grid.isWalkable({ col: -1, row: 1 }), false);
  assert.equal(grid.isWalkable({ col: 4, row: 1 }), false);
});

test("clearBox makes a box walkable", () => {
  const grid = Grid.fromTiled(tiny([1, 1, 1, 1, 1, 6, 5, 1, 1, 1, 1, 1]));
  grid.clearBox({ col: 2, row: 1 });
  assert.equal(grid.isWalkable({ col: 2, row: 1 }), true);
});

test("clearBox does not remove a wall", () => {
  const grid = Grid.fromTiled(tiny([1, 1, 1, 1, 1, 6, 5, 1, 1, 1, 1, 1]));
  grid.clearBox({ col: 0, row: 0 });
  assert.equal(grid.isWalkable({ col: 0, row: 0 }), false);
});

test("a bomb blocks a cell until it is removed", () => {
  const grid = Grid.fromTiled(tiny([1, 1, 1, 1, 1, 6, 6, 1, 1, 1, 1, 1]));
  grid.addBomb({ col: 2, row: 1 });
  assert.equal(grid.isWalkable({ col: 2, row: 1 }), false);
  assert.equal(grid.hasBomb({ col: 2, row: 1 }), true);
  grid.removeBomb({ col: 2, row: 1 });
  assert.equal(grid.isWalkable({ col: 2, row: 1 }), true);
});

test("a map without a Blocks layer is rejected", () => {
  assert.throws(() => Grid.fromTiled({ layers: [] }), /Blocks/);
});

test("spawnCell applies the one-tile spawn offset", () => {
  assert.deepEqual(spawnCell({ col: 6, row: 2 }), { col: 5, row: 1 });
});

test("cellCenter is the middle of a 35 px tile", () => {
  assert.deepEqual(cellCenter({ col: 2, row: 1 }), { x: 87.5, y: 52.5 });
});
