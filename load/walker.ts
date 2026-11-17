import { type Cell, cellCenter, type Grid, TILE } from "./grid.ts";

const NEIGHBOURS = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: -1 },
  { col: 0, row: 1 },
];

const same = (a: Cell | null, b: Cell | null) =>
  a !== null && b !== null && a.col === b.col && a.row === b.row;

// A random walkable 4-neighbour. Goes back to `previous` only in a dead end.
export function nextCell(
  grid: Grid,
  from: Cell,
  previous: Cell | null,
  random: () => number,
): Cell | null {
  const options = NEIGHBOURS.map(d => ({
    col: from.col + d.col,
    row: from.row + d.row,
  })).filter(c => grid.isWalkable(c));
  if (options.length === 0) {
    return null;
  }
  const forward = options.filter(c => !same(c, previous));
  const pool = forward.length > 0 ? forward : options;
  return pool[Math.floor(random() * pool.length)];
}

// Moves a bot from tile centre to tile centre, like a player who holds one
// arrow key at a time.
export class Walker {
  private x: number;
  private y: number;
  private current: Cell;
  private previous: Cell | null = null;
  private goal: Cell | null = null;
  private readonly grid: Grid;
  private readonly speedPxPerS: number;
  private readonly random: () => number;

  constructor(
    grid: Grid,
    start: Cell,
    speedPxPerS = 150,
    random: () => number = Math.random,
  ) {
    this.grid = grid;
    this.speedPxPerS = speedPxPerS;
    this.random = random;
    this.current = start;
    ({ x: this.x, y: this.y } = cellCenter(start));
  }

  tick(dtMs: number): { x: number; y: number; moved: boolean } {
    let budget = (this.speedPxPerS * dtMs) / 1000;
    let moved = false;
    while (budget > 1e-9) {
      if (!this.goal || !this.grid.isWalkable(this.goal)) {
        // A bomb can appear on the target: turn back to the current tile.
        this.goal = this.goal
          ? this.current
          : nextCell(this.grid, this.current, this.previous, this.random);
        if (!this.goal) {
          break;
        }
      }
      const target = cellCenter(this.goal);
      const dist = Math.abs(target.x - this.x) + Math.abs(target.y - this.y);
      const step = Math.min(budget, dist);
      if (step > 0) {
        this.x +=
          Math.sign(target.x - this.x) *
          Math.min(step, Math.abs(target.x - this.x));
        this.y +=
          Math.sign(target.y - this.y) *
          Math.min(step, Math.abs(target.y - this.y));
        moved = true;
      }
      budget -= step;
      if (step === dist) {
        if (!same(this.goal, this.current)) {
          this.previous = this.current;
        }
        this.current = this.goal;
        this.goal = nextCell(
          this.grid,
          this.current,
          this.previous,
          this.random,
        );
        if (!this.goal) {
          break;
        }
      }
    }
    return { x: this.x, y: this.y, moved };
  }

  // The tile under the bot's centre.
  cell(): Cell {
    return { col: Math.floor(this.x / TILE), row: Math.floor(this.y / TILE) };
  }

  target(): Cell {
    return this.goal ?? this.current;
  }

  // After a bomb: never step back onto `c` while another way exists.
  avoid(c: Cell): void {
    this.previous = c;
    if (same(this.goal, c) || !this.goal) {
      this.goal = nextCell(this.grid, this.current, c, this.random);
    }
  }

  // Teleport: start again from a new tile.
  reset(c: Cell): void {
    this.current = c;
    this.previous = null;
    this.goal = null;
    ({ x: this.x, y: this.y } = cellCenter(c));
  }
}
