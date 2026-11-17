import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  aggregate,
  DEFAULT_POLL_MS,
  parseLoadAvg,
  parseMemAvailableMb,
  parsePm2,
} from "./droplet.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("parsePm2 ignores leading text", () => {
  const samples = parsePm2(fixture("pm2-jlist.txt"));
  assert.deepEqual(
    samples.map(s => s.name),
    ["cinematik-api", "alert-bot", "app", "old-worker"],
  );
});

test("parsePm2 reads the app metrics", () => {
  const app = parsePm2(fixture("pm2-jlist.txt")).find(s => s.name === "app");
  assert.deepEqual(app, {
    name: "app",
    cpu: 12,
    memMb: 62,
    loopP95Ms: 1.16,
    restarts: 3,
  });
});

test("parsePm2 output contains no env keys", () => {
  const text = JSON.stringify(parsePm2(fixture("pm2-jlist.txt")));
  assert.ok(!text.includes("FAKE"));
  assert.ok(!text.includes("DB_HOST"));
  assert.ok(!text.includes("JWT_SECRET"));
});

test("parsePm2 gives null event-loop latency without axm_monitor", () => {
  const old = parsePm2(fixture("pm2-jlist.txt")).find(
    s => s.name === "old-worker",
  );
  assert.equal(old?.loopP95Ms, null);
});

test("parsePm2 rejects output with no JSON", () => {
  assert.throws(() => parsePm2("command not found: pm2"), /pm2 jlist/);
});

test("parsePm2 error does not echo the raw output", () => {
  try {
    parsePm2('[{"broken": "FAKE-SECRET"');
    assert.fail("no error");
  } catch (error) {
    assert.ok(!String(error).includes("FAKE"));
  }
});

test("parseMemAvailableMb reads MemAvailable", () => {
  assert.equal(parseMemAvailableMb(fixture("meminfo.txt")), 139);
});

test("parseLoadAvg reads the 1-minute value", () => {
  assert.equal(parseLoadAvg("0.05 0.03 0.01 1/199 1498099"), 0.05);
});

test("aggregate builds the step server metrics", () => {
  const poll = (cpu: number, loop: number, restarts: number, mem: number) => ({
    procs: [
      { name: "app", cpu, memMb: 60 + cpu, loopP95Ms: loop, restarts },
      { name: "alert-bot", cpu: 1, memMb: 38, loopP95Ms: 2, restarts: 8 },
      { name: "old-worker", cpu: 0, memMb: 1, loopP95Ms: null, restarts: 0 },
    ],
    memAvailableMb: mem,
    loadAvg: cpu / 100,
  });
  const metrics = aggregate("app", [
    poll(10, 2, 3, 140),
    poll(30, 8, 3, 120),
    poll(20, 4, 3, 130),
  ]);
  assert.deepEqual(metrics, {
    cpuMean: 20,
    cpuMax: 30,
    memMaxMb: 90,
    loopP95Max: 8,
    memAvailableMinMb: 120,
    otherLoopP95Max: 2,
    loadAvgMax: 0.3,
    restarted: false,
  });
});

test("aggregate marks a restart when the count grows", () => {
  const poll = (restarts: number) => ({
    procs: [{ name: "app", cpu: 1, memMb: 60, loopP95Ms: 1, restarts }],
    memAvailableMb: 140,
    loadAvg: 0.1,
  });
  assert.equal(aggregate("app", [poll(3), poll(4)]).restarted, true);
});

test("aggregate marks a restart when the app is missing", () => {
  const ok = {
    procs: [{ name: "app", cpu: 1, memMb: 60, loopP95Ms: 1, restarts: 3 }],
    memAvailableMb: 140,
    loadAvg: 0.1,
  };
  const gone = { procs: [], memAvailableMb: 140, loadAvg: 0.1 };
  assert.equal(aggregate("app", [ok, gone]).restarted, true);
});

test("the droplet is polled every 5 s, not more often", () => {
  assert.equal(DEFAULT_POLL_MS, 5000);
});
