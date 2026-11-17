import { type Summary, serverShare } from "./stats.ts";

export type Verdict = "green" | "amber" | "red";

export type Thresholds = {
  greenMs: number;
  amberMs: number;
  greenCpu: number;
  amberCpu: number;
  greenLoopMs: number;
  amberLoopMs: number;
  minMemMb: number;
  otherLoopMs: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  greenMs: 50,
  amberMs: 100,
  greenCpu: 70,
  amberCpu: 90,
  greenLoopMs: 20,
  amberLoopMs: 50,
  minMemMb: 50,
  otherLoopMs: 50,
};

// Droplet metrics for one step, from pm2 over SSH.
export type ServerMetrics = {
  cpuMean: number;
  cpuMax: number;
  memMaxMb: number;
  loopP95Max: number;
  memAvailableMinMb: number;
  otherLoopP95Max: number;
  loadAvgMax: number;
  restarted: boolean;
};

export type StepMetrics = {
  players: number;
  echo: Summary;
  bomb: Summary;
  fuse: Summary;
  baselineMs: number;
  lostPct: number;
  disconnects: number;
  // CPU of the bot process. Not part of the verdict; the runner warns above 50 %.
  botCpuPct: number;
  server?: ServerMetrics;
};

const RANK: Record<Verdict, number> = { green: 0, amber: 1, red: 2 };

const level = (value: number, green: number, amber: number): Verdict => {
  if (value <= green) {
    return "green";
  }
  return value <= amber ? "amber" : "red";
};

const worst = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "green");

export function classify(m: StepMetrics, t: Thresholds): Verdict {
  if (m.echo.count === 0 || m.disconnects > 0) {
    return "red";
  }
  const verdicts: Verdict[] = [
    level(serverShare(m.echo.p95, m.baselineMs), t.greenMs, t.amberMs),
    m.fuse.count === 0 ? "green" : level(m.fuse.p95, t.greenMs, t.amberMs),
    m.lostPct === 0 ? "green" : m.lostPct < 1 ? "amber" : "red",
  ];
  const s = m.server;
  if (s) {
    if (
      s.restarted ||
      s.memAvailableMinMb < t.minMemMb ||
      s.otherLoopP95Max > t.otherLoopMs
    ) {
      return "red";
    }
    verdicts.push(level(s.cpuMax, t.greenCpu, t.amberCpu));
    verdicts.push(level(s.loopP95Max, t.greenLoopMs, t.amberLoopMs));
  }
  return worst(verdicts);
}
