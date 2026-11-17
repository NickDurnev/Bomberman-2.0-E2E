import assert from "node:assert/strict";
import { test } from "node:test";
import type { Summary } from "./stats.ts";
import {
  classify,
  DEFAULT_THRESHOLDS,
  type ServerMetrics,
  type StepMetrics,
} from "./verdict.ts";

const flat = (ms: number): Summary => ({
  count: 100,
  p50: ms,
  p95: ms,
  p99: ms,
  max: ms,
});

const goodServer: ServerMetrics = {
  cpuMean: 20,
  cpuMax: 40,
  memMaxMb: 80,
  loopP95Max: 5,
  memAvailableMinMb: 120,
  otherLoopP95Max: 3,
  loadAvgMax: 0.4,
  restarted: false,
};

// Echo p95 is 30 ms baseline + the given server share.
const step = (over: Partial<StepMetrics> = {}, share = 10): StepMetrics => ({
  players: 4,
  echo: flat(30 + share),
  bomb: flat(40),
  fuse: flat(5),
  baselineMs: 30,
  lostPct: 0,
  disconnects: 0,
  botCpuPct: 5,
  server: goodServer,
  ...over,
});

const t = DEFAULT_THRESHOLDS;

test("echo share at the green limit is green", () => {
  assert.equal(classify(step({}, 50), t), "green");
});

test("echo share above green is amber", () => {
  assert.equal(classify(step({}, 51), t), "amber");
});

test("echo share above amber is red", () => {
  assert.equal(classify(step({}, 101), t), "red");
});

test("fuse lateness follows the same limits", () => {
  assert.equal(classify(step({ fuse: flat(51) }), t), "amber");
  assert.equal(classify(step({ fuse: flat(101) }), t), "red");
});

test("small losses are amber, larger losses are red", () => {
  assert.equal(classify(step({ lostPct: 0.5 }), t), "amber");
  assert.equal(classify(step({ lostPct: 1 }), t), "red");
});

test("one disconnect is red", () => {
  assert.equal(classify(step({ disconnects: 1 }), t), "red");
});

test("without server metrics the client metrics decide", () => {
  assert.equal(classify(step({ server: undefined }), t), "green");
  assert.equal(classify(step({ server: undefined }, 60), t), "amber");
});

test("server cpu and event loop limits", () => {
  assert.equal(
    classify(step({ server: { ...goodServer, cpuMax: 75 } }), t),
    "amber",
  );
  assert.equal(
    classify(step({ server: { ...goodServer, cpuMax: 91 } }), t),
    "red",
  );
  assert.equal(
    classify(step({ server: { ...goodServer, loopP95Max: 21 } }), t),
    "amber",
  );
  assert.equal(
    classify(step({ server: { ...goodServer, loopP95Max: 51 } }), t),
    "red",
  );
});

test("a restart is red", () => {
  assert.equal(
    classify(step({ server: { ...goodServer, restarted: true } }), t),
    "red",
  );
});

test("low machine memory is red", () => {
  assert.equal(
    classify(step({ server: { ...goodServer, memAvailableMinMb: 49 } }), t),
    "red",
  );
});

test("a slow other service is red", () => {
  assert.equal(
    classify(step({ server: { ...goodServer, otherLoopP95Max: 51 } }), t),
    "red",
  );
});

test("a step with no echoes is red", () => {
  assert.equal(
    classify(step({ echo: { ...flat(Number.NaN), count: 0 } }), t),
    "red",
  );
});
