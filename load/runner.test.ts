import assert from "node:assert/strict";
import { test } from "node:test";
import type { Recorder } from "./recorder.ts";
import {
  PRODUCTION_URL,
  parseOptions,
  plannedSteps,
  runStep,
  type StepBot,
  validateSteps,
} from "./runner.ts";

// Fake bots that share one fake room.
const noop = () => undefined;
const fakeRoom = (playThrows: boolean) => {
  const calls: string[] = [];
  const members = new Set<string>();
  const updates: Array<(ids: string[]) => void> = [];
  let launch: () => void = noop;
  const launched = new Promise<void>(resolve => {
    launch = resolve;
  });
  const make = (index: number): StepBot => {
    const id = `bot-${index}`;
    return {
      id,
      connect: () => {
        calls.push(`${id} connect`);
        return Promise.resolve();
      },
      createGame: async () => "g1",
      onUpdateGame: cb => {
        updates.push(cb);
        return noop;
      },
      enter: gameId => {
        calls.push(`${id} enter ${gameId}`);
        members.add(id);
        for (const cb of updates) {
          cb([...members]);
        }
      },
      startTimer: () => calls.push(`${id} startTimer`),
      startGame: () => {
        calls.push(`${id} startGame`);
        launch();
      },
      waitLaunch: async () => {
        await launched;
        return { id: "g1", players: [] };
      },
      play: () =>
        playThrows
          ? Promise.reject(new Error("play failed"))
          : Promise.resolve(),
      waitEndGame: async () => ({ new_game_id: "g2" }),
      leavePending: () => calls.push(`${id} leavePending`),
      disconnect: () => calls.push(`${id} disconnect`),
    };
  };
  return { calls, make };
};

const deps = (make: (i: number) => StepBot) => ({
  makeBot: (i: number, _r: Recorder) => make(i),
  mapName: "default_map",
  roomName: "load-test",
  durationMs: 0,
  countdownMs: 0,
  joinTimeoutMs: 1000,
  withMe: false,
  baselineMs: 1,
  log: noop,
});

test("runStep calls teardown when play throws", async () => {
  const room = fakeRoom(true);
  await assert.rejects(runStep(3, deps(room.make)), /play failed/);
  for (const id of ["bot-1", "bot-2", "bot-3"]) {
    assert.ok(room.calls.includes(`${id} disconnect`), `${id} disconnected`);
  }
  assert.ok(room.calls.includes("bot-1 enter g2"));
  assert.ok(room.calls.includes("bot-1 leavePending"));
  // Bot 1 leaves last, after the others.
  assert.equal(room.calls.at(-1), "bot-1 disconnect");
});

test("runStep returns the step metrics", async () => {
  const room = fakeRoom(false);
  const m = await runStep(2, deps(room.make));
  assert.equal(m.players, 2);
  assert.equal(m.disconnects, 0);
  assert.equal(m.baselineMs, 1);
  assert.ok(
    room.calls.indexOf("bot-1 startTimer") <
      room.calls.indexOf("bot-1 startGame"),
  );
});

test("with-me skips N < 3", () => {
  assert.deepEqual(plannedSteps([2, 4], true), [4]);
  assert.deepEqual(plannedSteps([2, 4], false), [2, 4]);
});

test("validateSteps rejects a step above the map limit", () => {
  assert.throws(() => validateSteps([2, 16], 14), /16/);
  assert.throws(() => validateSteps([1], 14), /1/);
  assert.doesNotThrow(() => validateSteps([2, 14], 14));
});

test("parseOptions defaults", () => {
  const o = parseOptions([], {});
  assert.equal(o.url, PRODUCTION_URL);
  assert.equal(o.map, "default_map");
  assert.deepEqual(o.steps, [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(o.durationS, 60);
  assert.equal(o.pauseS, 5);
  assert.equal(o.withMe, false);
  assert.equal(o.ssh, undefined);
  assert.equal(o.thresholds.greenMs, 50);
  assert.equal(o.thresholds.amberMs, 100);
});

test("parseOptions reads flags and LOAD_SSH", () => {
  const o = parseOptions(
    ["--url", "http://localhost:4000", "--steps", "2,4", "--green-ms", "30"],
    { LOAD_SSH: "user@host" },
  );
  assert.equal(o.url, "http://localhost:4000");
  assert.deepEqual(o.steps, [2, 4]);
  assert.equal(o.thresholds.greenMs, 30);
  assert.equal(o.ssh, "user@host");
  assert.equal(parseOptions(["--ssh", "a@b"], { LOAD_SSH: "x@y" }).ssh, "a@b");
});

test("parseOptions rejects a bad step list", () => {
  assert.throws(() => parseOptions(["--steps", "2,x"], {}), /steps/);
});
