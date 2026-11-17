import { execFile } from "node:child_process";
import type { ServerMetrics } from "./verdict.ts";

// `pm2 jlist` prints every process's environment, which holds secrets. Raw
// output stays inside this module: only the parsed metric fields leave it,
// and no error message quotes it.

export type ProcSample = {
  name: string;
  cpu: number;
  memMb: number;
  loopP95Ms: number | null;
  restarts: number;
};

export type Poll = {
  procs: ProcSample[];
  memAvailableMb: number;
  loadAvg: number;
};

type Pm2Proc = {
  name?: string;
  monit?: { cpu?: number; memory?: number };
  pm2_env?: {
    restart_time?: number;
    axm_monitor?: Record<string, { value?: string | number }>;
  };
};

const MB = 1024 * 1024;

export function parsePm2(raw: string): ProcSample[] {
  const start = raw.indexOf("[{");
  const end = raw.lastIndexOf("}]");
  let procs: Pm2Proc[];
  try {
    if (start < 0 || end < start) {
      throw new Error();
    }
    procs = JSON.parse(raw.slice(start, end + 2));
  } catch {
    throw new Error("pm2 jlist: no process list in the output");
  }
  return procs.map(p => {
    const loop = p.pm2_env?.axm_monitor?.["Event Loop Latency p95"]?.value;
    return {
      name: p.name ?? "?",
      cpu: p.monit?.cpu ?? 0,
      memMb: Math.round((p.monit?.memory ?? 0) / MB),
      loopP95Ms: loop === undefined ? null : Number(loop),
      restarts: p.pm2_env?.restart_time ?? 0,
    };
  });
}

export function parseMemAvailableMb(meminfo: string): number {
  const match = /^MemAvailable:\s+(\d+) kB/m.exec(meminfo);
  if (!match) {
    throw new Error("meminfo: no MemAvailable line");
  }
  return Math.floor(Number(match[1]) / 1024);
}

export function parseLoadAvg(text: string): number {
  return Number(text.trim().split(/\s+/)[0]);
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

// Server metrics of one step from its polls. `app` is the backend's pm2 name.
export function aggregate(app: string, polls: Poll[]): ServerMetrics {
  const apps = polls.map(p => p.procs.find(s => s.name === app));
  const seen = apps.filter((s): s is ProcSample => s !== undefined);
  const others = polls.flatMap(p => p.procs.filter(s => s.name !== app));
  const restarts = seen.map(s => s.restarts);
  return {
    cpuMean: seen.length ? mean(seen.map(s => s.cpu)) : 0,
    cpuMax: Math.max(0, ...seen.map(s => s.cpu)),
    memMaxMb: Math.max(0, ...seen.map(s => s.memMb)),
    loopP95Max: Math.max(0, ...seen.map(s => s.loopP95Ms ?? 0)),
    memAvailableMinMb: Math.min(...polls.map(p => p.memAvailableMb)),
    otherLoopP95Max: Math.max(0, ...others.map(s => s.loopP95Ms ?? 0)),
    loadAvgMax: Math.max(0, ...polls.map(p => p.loadAvg)),
    restarted:
      seen.length < apps.length ||
      Math.max(...restarts) > Math.min(...restarts),
  };
}

const SPLIT = "__SPLIT__";

// Each poll starts a pm2 CLI (a Node process) on the 1 vCPU droplet: poll
// rarely, so the monitor does not cause the load it measures.
export const DEFAULT_POLL_MS = 5000;

export type DropletOptions = {
  target: string;
  pm2Path: string;
  app: string;
  intervalMs?: number;
};

// Polls the droplet over one shared SSH connection (ControlMaster).
export class DropletMonitor {
  private readonly opts: Required<DropletOptions>;
  private readonly sshArgs: string[];
  private polls: Poll[] = [];
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(opts: DropletOptions) {
    this.opts = { intervalMs: DEFAULT_POLL_MS, ...opts };
    this.sshArgs = [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      "-o",
      "ControlMaster=auto",
      "-o",
      "ControlPath=/tmp/bm-load-%C",
      "-o",
      "ControlPersist=60",
    ];
  }

  private ssh(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "ssh",
        [...this.sshArgs, this.opts.target, command],
        { maxBuffer: 16 * MB, timeout: 15000 },
        (error, stdout, stderr) => {
          if (error) {
            const first = String(stderr).split("\n")[0];
            reject(new Error(`ssh ${this.opts.target} failed: ${first}`));
            return;
          }
          resolve(String(stdout));
        },
      );
    });
  }

  async poll(): Promise<Poll> {
    const out = await this.ssh(
      `PATH=${this.opts.pm2Path}:$PATH pm2 jlist; echo ${SPLIT}; cat /proc/meminfo; echo ${SPLIT}; cat /proc/loadavg`,
    );
    const [pm2, meminfo, loadavg] = out.split(SPLIT);
    return {
      procs: parsePm2(pm2),
      memAvailableMb: parseMemAvailableMb(meminfo ?? ""),
      loadAvg: parseLoadAvg(loadavg ?? ""),
    };
  }

  // The first poll must work, so a wrong target fails before the step.
  async start(): Promise<void> {
    this.polls = [await this.poll()];
    this.timer = setInterval(() => {
      if (this.inFlight) {
        return;
      }
      this.inFlight = this.poll()
        .then(p => {
          this.polls.push(p);
        })
        .catch(error => console.warn(String(error)))
        .finally(() => {
          this.inFlight = undefined;
        });
    }, this.opts.intervalMs);
  }

  async stop(): Promise<ServerMetrics> {
    clearInterval(this.timer);
    await this.inFlight;
    this.polls.push(await this.poll());
    return aggregate(this.opts.app, this.polls);
  }

  close(): Promise<void> {
    return new Promise(resolve => {
      execFile("ssh", [...this.sshArgs, "-O", "exit", this.opts.target], () =>
        resolve(),
      );
    });
  }
}
