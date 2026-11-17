import type { Cell } from "./grid.ts";

export type RecorderResult = {
  echo: number[];
  bomb: number[];
  fuse: number[];
  movesSent: number;
  movesEchoed: number;
  bombsSent: number;
  bombsShown: number;
  disconnects: number;
};

// The backend checks its bomb queue every 100 ms (Bomberman-2.0-Backend
// src/play.ts), so a detonation up to 100 ms after the fuse is normal.
export const BOMB_QUEUE_TICK_MS = 100;

const cellKey = (c: Cell) => `${c.col},${c.row}`;

// Collects one bot's timings. Times are Date.now()-style milliseconds.
export class Recorder {
  // Send times per "x,y", oldest first: an echo matches the oldest send.
  private readonly moves = new Map<string, number[]>();
  private readonly bombsByCell = new Map<string, number[]>();
  private readonly shown = new Map<string, number>();
  private readonly echo: number[] = [];
  private readonly bomb: number[] = [];
  private readonly fuse: number[] = [];
  private movesSent = 0;
  private movesEchoed = 0;
  private bombsSent = 0;
  private bombsShown = 0;
  private disconnects = 0;

  sentMove(x: number, y: number, at: number): void {
    const key = `${x},${y}`;
    const queue = this.moves.get(key) ?? [];
    queue.push(at);
    this.moves.set(key, queue);
    this.movesSent++;
  }

  echoMove(x: number, y: number, at: number): void {
    const sentAt = this.moves.get(`${x},${y}`)?.shift();
    if (sentAt === undefined) {
      return;
    }
    this.echo.push(at - sentAt);
    this.movesEchoed++;
  }

  sentBomb(c: Cell, at: number): void {
    const queue = this.bombsByCell.get(cellKey(c)) ?? [];
    queue.push(at);
    this.bombsByCell.set(cellKey(c), queue);
    this.bombsSent++;
  }

  shownBomb(c: Cell, bombId: string, delayMs: number, at: number): void {
    const sentAt = this.bombsByCell.get(cellKey(c))?.shift();
    if (sentAt !== undefined) {
      this.bomb.push(at - sentAt);
      this.bombsShown++;
    }
    this.shown.set(bombId, at + delayMs);
  }

  detonated(bombId: string, at: number): void {
    const due = this.shown.get(bombId);
    if (due === undefined) {
      return;
    }
    this.shown.delete(bombId);
    this.fuse.push(Math.max(0, at - due - BOMB_QUEUE_TICK_MS));
  }

  disconnect(): void {
    this.disconnects++;
  }

  result(): RecorderResult {
    return {
      echo: [...this.echo],
      bomb: [...this.bomb],
      fuse: [...this.fuse],
      movesSent: this.movesSent,
      movesEchoed: this.movesEchoed,
      bombsSent: this.bombsSent,
      bombsShown: this.bombsShown,
      disconnects: this.disconnects,
    };
  }
}
