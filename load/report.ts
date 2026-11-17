import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serverShare } from "./stats.ts";
import type { StepMetrics, Verdict } from "./verdict.ts";

export type Row = { m: StepMetrics; v: Verdict };

const ms = (n: number) => (Number.isNaN(n) ? "-" : n.toFixed(0));

export const HEADER =
  "  N | echo p50/p95/p99 | srv share | bomb p95 | fuse p95 | lost % | disc | cpu max | mem MB | loop p95 | free MB | verdict";

export function formatRow(m: StepMetrics, v: Verdict): string {
  const s = m.server;
  return [
    String(m.players).padStart(3),
    `${ms(m.echo.p50)}/${ms(m.echo.p95)}/${ms(m.echo.p99)}`.padStart(16),
    ms(serverShare(m.echo.p95, m.baselineMs)).padStart(9),
    ms(m.bomb.p95).padStart(8),
    ms(m.fuse.p95).padStart(8),
    m.lostPct.toFixed(2).padStart(6),
    String(m.disconnects).padStart(4),
    (s ? s.cpuMax.toFixed(0) : "-").padStart(7),
    (s ? String(s.memMaxMb) : "-").padStart(6),
    (s ? s.loopP95Max.toFixed(1) : "-").padStart(8),
    (s ? String(s.memAvailableMinMb) : "-").padStart(7),
    ` ${v.toUpperCase()}${s?.restarted ? " (app restarted)" : ""}`,
  ].join(" |");
}

// The limit is the last step before the first worse verdict.
export function finalLine(rows: Row[]): string {
  const sorted = [...rows].sort((a, b) => a.m.players - b.m.players);
  const last = (ok: (v: Verdict) => boolean) => {
    let limit: number | null = null;
    for (const row of sorted) {
      if (!ok(row.v)) {
        break;
      }
      limit = row.m.players;
    }
    return limit;
  };
  const green = last(v => v === "green");
  const amber = last(v => v !== "red");
  const players = (n: number | null) => (n === null ? "none" : `${n} players`);
  return `Lag-free (green) up to ${players(green)}; amber up to ${amber ?? "none"}.`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function reportBaseName(now: Date, url: string, map: string): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${date}-${time}-${new URL(url).hostname}-${map}`;
}

export type ReportInput = {
  dir: string;
  now: Date;
  url: string;
  map: string;
  options: Record<string, unknown>;
  baselineMs: number;
  rows: Row[];
};

export function writeReport(input: ReportInput): { md: string; json: string } {
  mkdirSync(input.dir, { recursive: true });
  const base = join(input.dir, reportBaseName(input.now, input.url, input.map));
  const md = [
    `# Load test ${input.now.toISOString()}`,
    "",
    `- URL: ${input.url}`,
    `- Map: ${input.map}`,
    `- Network baseline: ${input.baselineMs.toFixed(1)} ms`,
    `- Options: \`${JSON.stringify(input.options)}\``,
    "",
    "```",
    HEADER,
    ...input.rows.map(r => formatRow(r.m, r.v)),
    "```",
    "",
    `**${finalLine(input.rows)}**`,
    "",
  ].join("\n");
  writeFileSync(`${base}.md`, md);
  writeFileSync(
    `${base}.json`,
    `${JSON.stringify({ ...input, dir: undefined, now: input.now.toISOString() }, null, 2)}\n`,
  );
  return { md: `${base}.md`, json: `${base}.json` };
}
