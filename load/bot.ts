import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { io, type Socket } from "socket.io-client";
import { type Cell, type Grid, spawnCell, TILE } from "./grid.ts";
import type { Recorder } from "./recorder.ts";
import { Walker } from "./walker.ts";

// Values from Bomberman-2.0/src/utils/constants.ts.
const PING = 100;
const INITIAL_SPEED = 150;
const INITIAL_BOMBS = 1;
const BOMBS_SPOIL = 2;
const PORTAL_DELAY_MS = 2000;
const ACK_TIMEOUT_MS = 5000;

type PlayerData = { id: string; spawnOnGrid: Cell };
export type GameData = {
  id: string;
  players: PlayerData[] | Record<string, PlayerData>;
};
type BlastedCell = Cell & {
  destroyed: boolean;
  spoil: { id: string } | null;
  portal: { id: string } | null;
};

type Listener = Parameters<Socket["on"]>[1];

const key = (c: Cell) => `${c.col},${c.row}`;
const players = (g: GameData) => Object.values(g.players);

export type BotOptions = {
  url: string;
  index: number;
  grid: Grid;
  recorder: Recorder;
  random?: () => number;
};

// One mocked player. Identity goes in the handshake `auth` with no `email`,
// so the server writes no User document.
export class Bot {
  readonly id = randomUUID();
  readonly name: string;
  private readonly socket: Socket;
  private readonly grid: Grid;
  private readonly recorder: Recorder;
  private readonly random: () => number;
  private launched: GameData | null = null;
  private closing = false;

  constructor(opts: BotOptions) {
    this.name = `Bot ${opts.index}`;
    this.grid = opts.grid;
    this.recorder = opts.recorder;
    this.random = opts.random ?? Math.random;
    this.socket = io(opts.url, {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
      auth: { socketId: this.id, name: this.name, picture: "" },
    });
    this.socket.on("disconnect", reason => {
      if (!this.closing) {
        console.warn(`${this.name}: unexpected disconnect (${reason})`);
        this.recorder.disconnect();
      }
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once("connect", () => resolve());
      this.socket.once("connect_error", reject);
      this.socket.connect();
    });
  }

  ack<T>(event: string, ...args: unknown[]): Promise<T> {
    return this.socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, ...args);
  }

  // Resolves with the first `event` payload, or rejects after `timeoutMs`.
  once<T>(event: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off(event, handler);
        reject(new Error(`${this.name}: no "${event}" in ${timeoutMs} ms`));
      }, timeoutMs);
      const handler = (data: T) => {
        clearTimeout(timer);
        resolve(data);
      };
      this.socket.once(event, handler);
    });
  }

  async createGame(gameName: string, mapName: string): Promise<string> {
    const { game_id } = await this.ack<{ game_id: string }>("create game", {
      mapName,
      isPortalsEnabled: true,
      isDelaySpoilEnabled: true,
      gameName,
    });
    return game_id;
  }

  enter(gameId: string): void {
    this.socket.emit("enter pending game", gameId);
  }

  // Calls `cb` with the player count on every `update game`. Returns `off`.
  onUpdateGame(cb: (playerIds: string[]) => void): () => void {
    const handler = (data: { current_game: GameData }) =>
      cb(players(data.current_game).map(p => p.id));
    this.socket.on("update game", handler);
    return () => this.socket.off("update game", handler);
  }

  startTimer(gameId: string): void {
    this.socket.emit("start timer", gameId);
  }

  startGame(gameId: string): void {
    this.socket.emit("start game", gameId);
  }

  async waitLaunch(timeoutMs = 15000): Promise<GameData> {
    this.launched = await this.once<GameData>("launch game", timeoutMs);
    return this.launched;
  }

  waitEndGame(timeoutMs = 10000): Promise<{ new_game_id: string }> {
    return this.once("end game", timeoutMs);
  }

  leavePending(): void {
    this.socket.emit("leave pending game");
  }

  disconnect(): void {
    this.closing = true;
    this.socket.disconnect();
  }

  // Plays like a real client for `durationMs`: walks, bombs, picks spoils.
  async play(
    gameId: string,
    durationMs: number,
    abort?: AbortSignal,
  ): Promise<void> {
    const me =
      this.launched && players(this.launched).find(p => p.id === this.id);
    if (!me) {
      throw new Error(`${this.name}: not in the launched game`);
    }
    const walker = new Walker(
      this.grid,
      spawnCell(me.spawnOnGrid),
      INITIAL_SPEED,
      this.random,
    );
    const bombs = new Map<string, { cell: Cell; owner: string }>();
    const spoils = new Map<string, string>();
    const portals = new Map<string, string>();
    const reported = new Set<string>();
    let maxBombs = INITIAL_BOMBS;
    let activeBombs = 0;
    let nextBombAt = performance.now() + 2000 + this.random() * 2000;
    let lastPortalAt = 0;

    const handlers: Array<[string, (...args: never[]) => void]> = [
      [
        "move player",
        (d: { player_id: string; x: number; y: number }) => {
          if (d.player_id === this.id) {
            this.recorder.echoMove(d.x, d.y, performance.now());
          }
        },
      ],
      [
        "show bomb",
        (d: {
          bomb_id: string;
          playerId: string;
          col: number;
          row: number;
          delay: number;
        }) => {
          const cell = { col: d.col, row: d.row };
          this.grid.addBomb(cell);
          bombs.set(d.bomb_id, { cell, owner: d.playerId });
          if (d.playerId === this.id) {
            this.recorder.shownBomb(
              cell,
              d.bomb_id,
              d.delay,
              performance.now(),
            );
          }
        },
      ],
      [
        "detonate bomb",
        (d: {
          bomb_id: string;
          playerId: string;
          blastedCells: BlastedCell[];
        }) => {
          const bomb = bombs.get(d.bomb_id);
          if (bomb) {
            this.grid.removeBomb(bomb.cell);
            bombs.delete(d.bomb_id);
          }
          if (d.playerId === this.id) {
            this.recorder.detonated(d.bomb_id, performance.now());
            activeBombs = Math.max(0, activeBombs - 1);
          }
          for (const c of d.blastedCells) {
            if (c.destroyed) {
              this.grid.clearBox(c);
            }
            if (c.spoil) {
              spoils.set(key(c), c.spoil.id);
            }
            if (c.portal) {
              portals.set(key(c), c.portal.id);
            }
            // A blast that reaches another bomb sets it off, as the client does.
            for (const [id, other] of bombs) {
              if (key(other.cell) === key(c) && !reported.has(id)) {
                reported.add(id);
                this.socket.emit("detonate bomb by blast", {
                  bomb_id: id,
                  gameId,
                  playerId: other.owner,
                });
              }
            }
          }
        },
      ],
      [
        "spoil was picked",
        (d: { player_id: string; spoil_id: string; spoil_type: number }) => {
          for (const [cell, id] of spoils) {
            if (id === d.spoil_id) {
              spoils.delete(cell);
            }
          }
          if (d.player_id === this.id && d.spoil_type === BOMBS_SPOIL) {
            maxBombs++;
          }
        },
      ],
      [
        "teleport player",
        (d: { player_id: string; x: number; y: number }) => {
          if (d.player_id === this.id) {
            walker.reset({
              col: Math.floor(d.x / TILE),
              row: Math.floor(d.y / TILE),
            });
          }
        },
      ],
    ];
    for (const [event, fn] of handlers) {
      this.socket.on(event, fn as Listener);
    }

    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const pos = walker.tick(now - last);
      last = now;
      if (pos.moved) {
        this.recorder.sentMove(pos.x, pos.y, now);
        this.socket.emit("update player position", {
          playerId: this.id,
          gameId,
          x: pos.x,
          y: pos.y,
        });
      }
      const cell = walker.cell();
      const spoilId = spoils.get(key(cell));
      if (spoilId) {
        spoils.delete(key(cell));
        this.socket.emit("pick up spoil", {
          spoil_id: spoilId,
          playerId: this.id,
          gameId,
        });
      }
      const portalId = portals.get(key(cell));
      if (portalId && now - lastPortalAt > PORTAL_DELAY_MS) {
        lastPortalAt = now;
        this.socket.emit("use portal", {
          portal_id: portalId,
          playerId: this.id,
          gameId,
        });
      }
      if (now >= nextBombAt) {
        nextBombAt = now + 2000 + this.random() * 2000;
        if (activeBombs < maxBombs && !this.grid.hasBomb(cell)) {
          activeBombs++;
          this.recorder.sentBomb(cell, now);
          this.socket.emit("create bomb", {
            playerId: this.id,
            gameId,
            ...cell,
          });
          walker.avoid(cell);
        }
      }
    };

    const interval = setInterval(tick, PING);
    try {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, durationMs);
        abort?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    } finally {
      clearInterval(interval);
      for (const [event, fn] of handlers) {
        this.socket.off(event, fn as Listener);
      }
    }
  }
}
