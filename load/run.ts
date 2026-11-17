import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Bot } from "./bot.ts";
import { DropletMonitor } from "./droplet.ts";
import { type Grid, loadMap } from "./grid.ts";
import { Recorder } from "./recorder.ts";
import {
  finalLine,
  formatRow,
  HEADER,
  type Row,
  writeReport,
} from "./report.ts";
import {
  type Options,
  PRODUCTION_URL,
  parseOptions,
  plannedSteps,
  runStep,
  validateSteps,
} from "./runner.ts";
import { classify } from "./verdict.ts";

const ENV_FILE = new URL("../.env", import.meta.url);
const RESULTS_DIR = new URL("./results/", import.meta.url).pathname;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const pad = (n: number) => String(n).padStart(2, "0");

async function confirmProduction(opts: Options): Promise<boolean> {
  if (opts.url !== PRODUCTION_URL || opts.yes) {
    return true;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Run ${opts.steps.length} matches against PRODUCTION (${opts.url})? Type "yes": `,
  );
  rl.close();
  return answer.trim() === "yes";
}

// Median ack round trip of "check game name": the network part of the lag.
async function measureBaseline(url: string, grid: Grid): Promise<number> {
  const bot = new Bot({ url, index: 0, grid, recorder: new Recorder() });
  await bot.connect();
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    await bot.ack("check game name", `load-baseline-${Math.random()}`);
    samples.push(performance.now() - start);
  }
  bot.disconnect();
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

async function run(opts: Options): Promise<number> {
  const grid = loadMap(opts.map);
  validateSteps(opts.steps, grid.maxPlayers);
  const steps = plannedSteps(opts.steps, opts.withMe);
  if (!(await confirmProduction(opts))) {
    console.log("Cancelled.");
    return 1;
  }

  const abort = new AbortController();
  process.on("SIGINT", () => {
    if (abort.signal.aborted) {
      process.exit(130);
    }
    console.log(
      "\nStopping after this step's cleanup (Ctrl+C again to quit now).",
    );
    abort.abort();
  });

  const monitor = opts.ssh
    ? new DropletMonitor({
        target: opts.ssh,
        pm2Path: opts.pm2Path,
        app: "app",
      })
    : undefined;
  if (!monitor) {
    console.log("No --ssh / LOAD_SSH: droplet metrics are skipped.");
  }

  const baselineMs = await measureBaseline(opts.url, grid);
  console.log(`Network baseline: ${baselineMs.toFixed(1)} ms`);
  console.log(HEADER);

  const rows: Row[] = [];
  const now = new Date();
  try {
    for (const n of steps) {
      if (abort.signal.aborted) {
        break;
      }
      const stamp = `${pad(now.getHours())}${pad(now.getMinutes())}`;
      const m = await runStep(n, {
        // Each step gets a fresh map state: boxes come back in a new match.
        makeBot: (index, recorder) =>
          new Bot({ url: opts.url, index, grid: loadMap(opts.map), recorder }),
        mapName: opts.map,
        roomName: `load-test-${stamp}-${n}-${Math.random().toString(36).slice(2, 5)}`,
        durationMs: opts.durationS * 1000,
        countdownMs: 3000,
        joinTimeoutMs: opts.withMe ? 5 * 60_000 : 30_000,
        withMe: opts.withMe,
        baselineMs,
        monitor,
        abort: abort.signal,
        log: line => console.log(line),
      });
      const v = classify(m, opts.thresholds);
      rows.push({ m, v });
      console.log(formatRow(m, v));
      if (m.botCpuPct > 50) {
        console.log(
          `  warning: bot process CPU ${m.botCpuPct.toFixed(0)} %, the laptop can distort the numbers`,
        );
      }
      if (v === "red") {
        console.log("Red step: stopping.");
        break;
      }
      await sleep(opts.pauseS * 1000);
    }
  } finally {
    await monitor?.close();
    if (rows.length > 0) {
      const { md } = writeReport({
        dir: RESULTS_DIR,
        now,
        url: opts.url,
        map: opts.map,
        options: { ...opts, ssh: opts.ssh ? "set" : "unset" },
        baselineMs,
        rows,
      });
      console.log(finalLine(rows));
      console.log(`Report: ${md}`);
    }
  }
  return 0;
}

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
run(parseOptions(process.argv.slice(2), process.env))
  .then(code => process.exit(code))
  .catch(error => {
    console.error(String(error instanceof Error ? error.message : error));
    process.exit(1);
  });
