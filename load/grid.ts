import { readFileSync } from "node:fs";

export const TILE = 35;

export type Cell = { col: number; row: number };

type TiledLayer = {
  name: string;
  width: number;
  height: number;
  data: number[];
  properties: {
    wall: number;
    box: number;
    max_players: number;
    spawns?: Cell[];
  };
};

const key = (c: Cell) => `${c.col},${c.row}`;

export function cellCenter(c: Cell): { x: number; y: number } {
  return { x: c.col * TILE + TILE / 2, y: c.row * TILE + TILE / 2 };
}

// The client draws a player half a tile up and left of the server's spawn
// pixel, so a `spawns` entry (col, row) is the cell (col - 1, row - 1).
// See docs/maps.md "Spawn offset".
export function spawnCell(raw: Cell): Cell {
  return { col: raw.col - 1, row: raw.row - 1 };
}

// The bots' view of the map: walls and boxes from the Tiled JSON, bombs and
// broken boxes from server events.
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly maxPlayers: number;
  readonly spawns: Cell[];
  private readonly tiles: number[];
  private readonly wall: number;
  private readonly box: number;
  private readonly bombs = new Set<string>();

  private constructor(layer: TiledLayer) {
    this.width = layer.width;
    this.height = layer.height;
    this.tiles = [...layer.data];
    this.wall = layer.properties.wall;
    this.box = layer.properties.box;
    this.maxPlayers = layer.properties.max_players;
    this.spawns = (layer.properties.spawns ?? []).map(spawnCell);
  }

  static fromTiled(json: unknown): Grid {
    const layers = (json as { layers?: TiledLayer[] }).layers ?? [];
    const layer = layers.find(l => l.name === "Blocks");
    if (!layer) {
      throw new Error("map has no Blocks layer");
    }
    return new Grid(layer);
  }

  private tile(c: Cell): number | undefined {
    if (c.col < 0 || c.row < 0 || c.col >= this.width || c.row >= this.height) {
      return undefined;
    }
    return this.tiles[c.row * this.width + c.col];
  }

  isWalkable(c: Cell): boolean {
    const tile = this.tile(c);
    return (
      tile !== undefined &&
      tile !== this.wall &&
      tile !== this.box &&
      !this.bombs.has(key(c))
    );
  }

  hasBomb(c: Cell): boolean {
    return this.bombs.has(key(c));
  }

  addBomb(c: Cell): void {
    this.bombs.add(key(c));
  }

  removeBomb(c: Cell): void {
    this.bombs.delete(key(c));
  }

  clearBox(c: Cell): void {
    if (this.tile(c) === this.box) {
      // Any value other than wall or box is walkable.
      this.tiles[c.row * this.width + c.col] = 0;
    }
  }
}

// Reads a map from the sibling backend checkout, the same layout that
// scripts/stack-up.sh expects.
export function loadMap(name: string): Grid {
  const url = new URL(
    `../../Bomberman-2.0-Backend/src/maps/${name}.json`,
    import.meta.url,
  );
  let text: string;
  try {
    text = readFileSync(url, "utf8");
  } catch {
    throw new Error(
      `map "${name}" not found at ${url.pathname}: check out Bomberman-2.0-Backend next to this repo`,
    );
  }
  return Grid.fromTiled(JSON.parse(text));
}
