import assert from "node:assert/strict";
import { test } from "node:test";
import { Recorder } from "./recorder.ts";

test("echo latency is the echo time minus the send time", () => {
  const r = new Recorder();
  r.sentMove(10, 20, 1000);
  r.echoMove(10, 20, 1042);
  assert.deepEqual(r.result().echo, [42]);
});

test("recorder matches duplicate positions in send order", () => {
  const r = new Recorder();
  r.sentMove(5, 5, 0);
  r.sentMove(5, 5, 100);
  r.echoMove(5, 5, 30);
  r.echoMove(5, 5, 140);
  const result = r.result();
  assert.deepEqual(result.echo, [30, 40]);
  assert.equal(result.movesSent, 2);
  assert.equal(result.movesEchoed, 2);
});

test("an unmatched send counts as lost", () => {
  const r = new Recorder();
  r.sentMove(1, 1, 0);
  r.sentMove(2, 2, 100);
  r.echoMove(2, 2, 130);
  const result = r.result();
  assert.equal(result.movesSent - result.movesEchoed, 1);
  assert.deepEqual(result.echo, [30]);
});

test("an echo with no matching send is ignored", () => {
  const r = new Recorder();
  r.echoMove(9, 9, 10);
  assert.deepEqual(r.result().echo, []);
  assert.equal(r.result().movesEchoed, 0);
});

test("bomb time and fuse lateness", () => {
  const r = new Recorder();
  r.sentBomb({ col: 3, row: 4 }, 950);
  r.shownBomb({ col: 3, row: 4 }, "b1", 2000, 1000);
  r.detonated("b1", 3015);
  const result = r.result();
  assert.deepEqual(result.bomb, [50]);
  assert.deepEqual(result.fuse, [15]);
});

test("a bomb created but never shown counts in bombsSent only", () => {
  const r = new Recorder();
  r.sentBomb({ col: 1, row: 1 }, 0);
  const result = r.result();
  assert.equal(result.bombsSent, 1);
  assert.equal(result.bombsShown, 0);
  assert.deepEqual(result.bomb, []);
});

test("a detonation of an unknown bomb is ignored", () => {
  const r = new Recorder();
  r.detonated("nope", 10);
  assert.deepEqual(r.result().fuse, []);
});

test("disconnects are counted", () => {
  const r = new Recorder();
  r.disconnect();
  r.disconnect();
  assert.equal(r.result().disconnects, 2);
});
