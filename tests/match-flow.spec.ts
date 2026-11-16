import { hookState, waitForBombs, waitForScene } from "./fixtures/hook";
import { holdKey } from "./fixtures/keys";
import {
  endMatchBySelfKill,
  hostRoom,
  joinRoom,
  restartMatch,
  roomName,
  startMatch,
  waitForRestartModal,
} from "./fixtures/lobby";
import { expect, profile, test } from "./fixtures/players";

// A flag on window survives in-page navigation and is lost on a reload.
type MarkedWindow = Window & { __noReload?: boolean };

test("two players play a match and restart", async ({ players }) => {
  const { p1, p2 } = players;
  const room = roomName("match");

  await expect(p1.getByPlaceholder("Game Name")).toBeVisible();
  await expect(p2.getByPlaceholder("Game Name")).toBeVisible();

  await hostRoom(p1, room);
  await joinRoom(p2, room);
  await p1.evaluate(() => {
    (window as MarkedWindow).__noReload = true;
  });
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");

  const state1 = await hookState(p1);
  const state2 = await hookState(p2);
  expect(state1?.me?.name).toBe(profile(1).name);
  expect(state1?.enemies).toEqual([
    expect.objectContaining({ name: profile(2).name }),
  ]);
  expect(state2?.me?.name).toBe(profile(2).name);
  expect(state2?.enemies).toEqual([
    expect.objectContaining({ name: profile(1).name }),
  ]);

  // Player 1 places one bomb and stays on it. The bomb is one sprite on each
  // client and explodes on both; player 1 dies, player 2 wins, and both pages
  // show the results modal.
  await holdKey(p1, "Space");
  await waitForBombs(p1, 1);
  await waitForBombs(p2, 1);
  await waitForBombs(p1, 0);
  await waitForBombs(p2, 0);
  await expect.poll(async () => (await hookState(p1))?.me?.alive).toBe(false);
  await waitForRestartModal(p1, p2);
  await expect(p1.getByRole("heading", { name: /^Winner/ })).toBeVisible();

  await restartMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");

  // The restart stays in the page and runs one Phaser game.
  expect(await p1.evaluate(() => (window as MarkedWindow).__noReload)).toBe(
    true,
  );
  await expect(p1.locator("#game-container canvas")).toHaveCount(1);

  // The second match reacts to input: one bomb from player 2 shows on both.
  await holdKey(p2, "Space");
  await waitForBombs(p2, 1);
  await waitForBombs(p1, 1);
});

test("a match that ends at once still shows the results modal", async ({
  players,
}) => {
  const { p1, p2 } = players;
  const room = roomName("short");

  await hostRoom(p1, room);
  await joinRoom(p2, room);
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");

  // Player 1 bombs itself at once: the shortest match the game allows.
  await endMatchBySelfKill(p1, p2);
  await expect(p2.getByRole("heading", { name: /^Winner/ })).toBeVisible();
});
