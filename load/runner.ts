import { parseArgs } from "node:util";
import type { GameData } from "./bot.ts";
import { Recorder, type RecorderResult } from "./recorder.ts";
import { percentile, summarize } from "./stats.ts";
import {
  DEFAULT_THRESHOLDS,
  type ServerMetrics,
  type StepMetrics,
  type Thresholds,
} from "./verdict.ts";

export const PRODUCTION_URL = "https://bomberman.cinematik.click";
// The server ends a match after GAME_DURATION = 180 s. A step must end first,
// so its own teardown (not the timeout) closes the match.
export const MAX_DURATION_S = 150;

export function isProduction(url: string): boolean {
  try {
    return new URL(url).host === new URL(PRODUCTION_URL).host;
  } catch {
    return false;
  }
}

// The network part of the echo time: p95 of idle ack round trips, so normal
// network jitter is not counted as server lag.
export function baselineFrom(samples: number[]): number {
  return percentile(samples, 95);
}

export const DEFAULT_PM2_PATH = "$HOME/.nvm/versions/node/v22.14.0/bin";

export type Options = {
  url: string;
  map: string;
  steps: number[];
  durationS: number;
  pauseS: number;
  withMe: boolean;
  ssh: string | undefined;
  pm2Path: string;
  yes: boolean;
  thresholds: Thresholds;
};

const number = (name: string, value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${name} must be a positive number, got "${value}"`);
  }
  return n;
};

// "user@host" or an ~/.ssh/config alias. Anything else would reach the
// ssh command line.
const SSH_TARGET = /^([\w.-]+@)?[\w.-]+$/;

function sshTarget(value: string | undefined): string | undefined {
  const target = value?.trim();
  if (!target) {
    return undefined;
  }
  if (!SSH_TARGET.test(target)) {
    throw new Error("--ssh / LOAD_SSH must look like user@host");
  }
  return target;
}

function duration(seconds: number): number {
  if (seconds > MAX_DURATION_S) {
    throw new Error(
      `--duration must be at most ${MAX_DURATION_S} s (the match ends at 180 s)`,
    );
  }
  return seconds;
}

// Rejects as soon as `signal` aborts, so a wait does not outlive Ctrl+C.
function untilAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(new Error("aborted"));
  }
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), {
      once: true,
    });
    promise.then(resolve, reject);
  });
}

export function parseOptions(
  argv: string[],
  env: Record<string, string | undefined>,
): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      map: { type: "string" },
      steps: { type: "string" },
      duration: { type: "string" },
      pause: { type: "string" },
      "with-me": { type: "boolean" },
      "green-ms": { type: "string" },
      "amber-ms": { type: "string" },
      ssh: { type: "string" },
      "pm2-path": { type: "string" },
      yes: { type: "boolean" },
    },
  });
  const steps = (values.steps ?? "2,4,6,8,10,12,14")
    .split(",")
    .map(s => Number(s.trim()));
  if (steps.some(n => !Number.isInteger(n))) {
    throw new Error(
      `--steps must be a list of whole numbers, got "${values.steps}"`,
    );
  }
  const url = values.url ?? PRODUCTION_URL;
  return {
    url,
    map: values.map ?? "default_map",
    steps,
    durationS: duration(number("duration", values.duration, 60)),
    pauseS: number("pause", values.pause, 5),
    withMe: values["with-me"] ?? false,
    // LOAD_SSH points at the production droplet: ignore it for other URLs.
    ssh: sshTarget(
      values.ssh ?? (isProduction(url) ? env.LOAD_SSH : undefined),
    ),
    pm2Path: values["pm2-path"] ?? DEFAULT_PM2_PATH,
    yes: values.yes ?? false,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      greenMs: number(
        "green-ms",
        values["green-ms"],
        DEFAULT_THRESHOLDS.greenMs,
      ),
      amberMs: number(
        "amber-ms",
        values["amber-ms"],
        DEFAULT_THRESHOLDS.amberMs,
      ),
    },
  };
}

export function validateSteps(steps: number[], maxPlayers: number): void {
  for (const n of steps) {
    if (n < 2 || n > maxPlayers) {
      throw new Error(`step ${n} is outside 2..${maxPlayers} (the map limit)`);
    }
  }
}

// With a human in the room, a step needs at least 2 bots: bots never die, so
// the human's death never leaves exactly one living player (a win with stats).
export function plannedSteps(steps: number[], withMe: boolean): number[] {
  return withMe ? steps.filter(n => n >= 3) : steps;
}

// The part of Bot that a step uses. Tests pass fakes.
export type StepBot = {
  id: string;
  connect(): Promise<void>;
  createGame(name: string, mapName: string): Promise<string>;
  onUpdateGame(cb: (playerIds: string[]) => void): () => void;
  enter(gameId: string): void;
  startTimer(gameId: string): void;
  startGame(gameId: string): void;
  waitLaunch(timeoutMs?: number): Promise<GameData>;
  play(gameId: string, durationMs: number, abort?: AbortSignal): Promise<void>;
  waitEndGame(timeoutMs?: number): Promise<{ new_game_id: string }>;
  leavePending(): void;
  disconnect(): void;
};

export type Monitor = {
  start(): Promise<void>;
  stop(): Promise<ServerMetrics>;
};

export type StepDeps = {
  makeBot(index: number, recorder: Recorder): StepBot;
  mapName: string;
  roomName: string;
  durationMs: number;
  countdownMs: number;
  joinTimeoutMs: number;
  withMe: boolean;
  baselineMs: number;
  monitor?: Monitor;
  abort?: AbortSignal;
  log(line: string): void;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function metricsFrom(
  players: number,
  results: RecorderResult[],
  baselineMs: number,
  botCpuPct: number,
  server?: ServerMetrics,
): StepMetrics {
  const all = <K extends "echo" | "bomb" | "fuse">(k: K) =>
    results.flatMap(r => r[k]);
  const sum = (k: "movesSent" | "movesEchoed" | "disconnects") =>
    results.reduce((a, r) => a + r[k], 0);
  const sent = sum("movesSent");
  return {
    players,
    echo: summarize(all("echo")),
    bomb: summarize(all("bomb")),
    fuse: summarize(all("fuse")),
    baselineMs,
    lostPct: sent === 0 ? 0 : ((sent - sum("movesEchoed")) / sent) * 100,
    disconnects: sum("disconnects"),
    botCpuPct,
    server,
  };
}

// One match with `n` players. The teardown always runs: no bot stays in the
// room, and the pending room that the match end creates is deleted at once.
export async function runStep(n: number, deps: StepDeps): Promise<StepMetrics> {
  const botCount = deps.withMe ? n - 1 : n;
  const recorders = Array.from({ length: botCount }, () => new Recorder());
  const bots = recorders.map((r, i) => deps.makeBot(i + 1, r));
  const [host, ...others] = bots;
  let launched = false;
  let server: ServerMetrics | undefined;
  let botCpuPct = 0;

  try {
    await untilAbort(Promise.all(bots.map(b => b.connect())), deps.abort);
    const gameId = await untilAbort(
      host.createGame(deps.roomName, deps.mapName),
      deps.abort,
    );

    const full = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`room did not reach ${n} players in time`));
      }, deps.joinTimeoutMs);
      const off = host.onUpdateGame(ids => {
        if (ids.length >= n) {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });
    for (const bot of bots) {
      bot.enter(gameId);
    }
    if (deps.withMe) {
      deps.log(`  Join the room "${deps.roomName}" in your browser.`);
    }
    await untilAbort(full, deps.abort);

    const launches = Promise.all(bots.map(b => b.waitLaunch()));
    // Handled below; this keeps an early rejection (abort in the countdown)
    // from becoming an unhandled rejection.
    launches.catch(() => undefined);
    host.startTimer(gameId);
    await untilAbort(sleep(deps.countdownMs), deps.abort);
    // Every client counts down and sends "start game" (Pending.tsx). The
    // server keeps the game id on each player's Play only then, and needs it
    // to remove the player on disconnect.
    for (const bot of bots) {
      bot.startGame(gameId);
    }
    // The server runs the match from here on, even if a launch event is lost.
    launched = true;
    await launches;

    await deps.monitor?.start();
    const cpuStart = process.cpuUsage();
    const wallStart = performance.now();
    try {
      await Promise.all(
        bots.map(b => b.play(gameId, deps.durationMs, deps.abort)),
      );
    } finally {
      const cpu = process.cpuUsage(cpuStart);
      const wallMs = performance.now() - wallStart;
      botCpuPct =
        wallMs > 0 ? ((cpu.user + cpu.system) / 1000 / wallMs) * 100 : 0;
      if (deps.monitor) {
        try {
          server = await deps.monitor.stop();
        } catch (error) {
          deps.log(`  droplet metrics lost: ${String(error)}`);
        }
      }
    }
  } finally {
    await teardown(host, others, launched, deps);
  }

  return metricsFrom(
    n,
    recorders.map(r => r.result()),
    deps.baselineMs,
    botCpuPct,
    server,
  );
}

async function teardown(
  host: StepBot,
  others: StepBot[],
  launched: boolean,
  deps: StepDeps,
): Promise<void> {
  if (!launched) {
    for (const bot of [host, ...others]) {
      bot.leavePending();
      bot.disconnect();
    }
    return;
  }
  // The others leave; with one living player left the server ends the match
  // (reason "disconnect", no stats) and creates a new pending room.
  const ended = host.waitEndGame().catch(() => null);
  for (const bot of others) {
    bot.disconnect();
  }
  const end = deps.withMe ? null : await ended;
  if (end) {
    host.enter(end.new_game_id);
    await sleep(200);
    host.leavePending();
    await sleep(200);
  }
  host.disconnect();
}
