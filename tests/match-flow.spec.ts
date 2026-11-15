import { hookState, waitForBombs, waitForScene } from "./fixtures/hook";
import { holdKey } from "./fixtures/keys";
import {
  hostRoom,
  joinRoom,
  restartMatch,
  roomName,
  startMatch,
  waitForRestartModal,
} from "./fixtures/lobby";
import { expect, profile, test } from "./fixtures/players";

test("two players play a match and restart", async ({ players }) => {
  const { p1, p2 } = players;
  const room = roomName("match");

  await expect(p1.getByPlaceholder("Game Name")).toBeVisible();
  await expect(p2.getByPlaceholder("Game Name")).toBeVisible();

  await hostRoom(p1, room);
  await joinRoom(p2, room);
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
  // reload into the restart modal.
  await holdKey(p1, "Space");
  await waitForBombs(p1, 1);
  await waitForBombs(p2, 1);
  await waitForBombs(p1, 0);
  await waitForBombs(p2, 0);
  await expect.poll(async () => (await hookState(p1))?.me?.alive).toBe(false);
  await waitForRestartModal(p1, p2);

  await restartMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
});
