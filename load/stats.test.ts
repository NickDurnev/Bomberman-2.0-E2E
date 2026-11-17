import assert from "node:assert/strict";
import { test } from "node:test";
import { percentile, serverShare, summarize } from "./stats.ts";

const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

test("percentile uses nearest rank", () => {
  assert.equal(percentile(oneToHundred, 95), 95);
  assert.equal(percentile(oneToHundred, 50), 50);
  assert.equal(percentile(oneToHundred, 100), 100);
  assert.equal(percentile([7], 99), 7);
});

test("percentile of an empty list is NaN", () => {
  assert.ok(Number.isNaN(percentile([], 50)));
});

test("percentile does not depend on input order", () => {
  assert.equal(percentile([30, 10, 20], 50), 20);
});

test("summarize gives count and percentiles", () => {
  assert.deepEqual(summarize(oneToHundred), {
    count: 100,
    p50: 50,
    p95: 95,
    p99: 99,
    max: 100,
  });
});

test("serverShare clamps at 0", () => {
  assert.equal(serverShare(20, 35), 0);
  assert.equal(serverShare(80, 30), 50);
});
