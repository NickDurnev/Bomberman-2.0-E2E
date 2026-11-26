import { hookState, waitForScene } from "./fixtures/hook";
import { holdKey } from "./fixtures/keys";
import {
  hostRoom,
  joinRoom,
  roomName,
  startMatch,
  waitForRestartModal,
} from "./fixtures/lobby";
import { expect, test } from "./fixtures/players";

// Playing.ts / spectator.ts: after the local death the camera follows a
// living player. Player 2 kills itself; player 1 wins at once, and the server
// ends the match ("end game") 5 s later. Playing, and so `spectating`, stays
// readable until then.
test("a dead player's camera follows a living player", async ({ players }) => {
  const { p1, p2 } = players;
  const room = roomName("spectate");

  await hostRoom(p1, room);
  await joinRoom(p2, room);
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
  expect((await hookState(p2))?.spectating).toBeNull();

  await holdKey(p2, "Space");
  await expect
    .poll(async () => (await hookState(p2))?.spectating)
    .toBe("E2E Player 1");
  expect((await hookState(p1))?.spectating).toBeNull();

  await waitForRestartModal(p1, p2);
});
