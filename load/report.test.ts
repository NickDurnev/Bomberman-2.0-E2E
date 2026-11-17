import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { finalLine, formatRow, reportBaseName, writeReport } from "./report.ts";
import type { Summary } from "./stats.ts";
import type { StepMetrics, Verdict } from "./verdict.ts";

const flat = (ms: number): Summary => ({
  count: 10,
  p50: ms,
  p95: ms,
  p99: ms,
  max: ms,
});

const metrics = (players: number): StepMetrics => ({
  players,
  echo: flat(40),
  bomb: flat(45),
  fuse: flat(3),
  baselineMs: 30,
  lostPct: 0,
  disconnects: 0,
  botCpuPct: 4,
});

const rows = (verdicts: Array<[number, Verdict]>) =>
  verdicts.map(([n, v]) => ({ m: metrics(n), v }));

test("finalLine names the last green and the last amber step", () => {
  assert.equal(
    finalLine(
      rows([
        [2, "green"],
        [4, "green"],
        [6, "green"],
        [8, "green"],
        [10, "amber"],
        [12, "red"],
      ]),
    ),
    "Lag-free (green) up to 8 players; amber up to 10.",
  );
});

test("finalLine with no green step says none", () => {
  assert.ok(
    finalLine(rows([[2, "amber"]])).startsWith("Lag-free (green) up to none"),
  );
});

test("finalLine with no amber step repeats the green limit", () => {
  assert.equal(
    finalLine(rows([[2, "green"]])),
    "Lag-free (green) up to 2 players; amber up to 2.",
  );
});

test("finalLine ignores green steps after the first non-green one", () => {
  assert.equal(
    finalLine(
      rows([
        [2, "green"],
        [4, "amber"],
        [6, "green"],
      ]),
    ),
    "Lag-free (green) up to 2 players; amber up to 6.",
  );
});

test("formatRow shows players, echo and the verdict", () => {
  const row = formatRow(metrics(6), "green");
  assert.match(row, /^\s*6\b/);
  assert.match(row, /GREEN/);
  assert.match(row, /40/);
});

test("report base name has date, host and map", () => {
  assert.equal(
    reportBaseName(
      new Date(2026, 10, 17, 9, 5),
      "https://bomberman.cinematik.click",
      "default_map",
    ),
    "20261117-0905-bomberman.cinematik.click-default_map",
  );
});

test("writeReport writes the md and json files", () => {
  const dir = mkdtempSync(join(tmpdir(), "load-report-"));
  const { md, json } = writeReport({
    dir,
    now: new Date(2026, 10, 17, 9, 5),
    url: "http://localhost:4000",
    map: "default_map",
    options: { steps: [2] },
    baselineMs: 1,
    rows: rows([[2, "green"]]),
  });
  assert.match(md, /20261117-0905-localhost-default_map\.md$/);
  assert.match(readFileSync(md, "utf8"), /Lag-free \(green\) up to 2 players/);
  assert.equal(JSON.parse(readFileSync(json, "utf8")).rows[0].v, "green");
});
