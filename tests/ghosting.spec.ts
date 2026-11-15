import { expectListeners } from "./fixtures/expected-listeners";
import {
  hookListeners,
  hookState,
  waitForBombs,
  waitForScene,
} from "./fixtures/hook";
import { holdKey } from "./fixtures/keys";
import {
  endMatchBySelfKill,
  hostRoom,
  joinRoom,
  leaveRoom,
  restartMatch,
  roomName,
  startMatch,
  waitForRestartModal,
} from "./fixtures/lobby";
import { expect, test } from "./fixtures/players";

// Ghosting: socket listeners that stack up, so one server event runs its
// handler more than once. The client socket is a singleton for the page
// lifetime, so the leaks that matter happen inside one page: SPA navigation,
// React re-mounts and Phaser game destroy/create. A restart reloads the page.

test("listener counts stay fixed across in-page navigation and restart", async ({
  players,
}) => {
  const { p1, p2 } = players;

  await expectListeners(p1, "lobby");
  for (let cycle = 0; cycle < 3; cycle++) {
    await hostRoom(p1, roomName(`cycle${cycle}`));
    await expectListeners(p1, "pending");
    await leaveRoom(p1);
    await expectListeners(p1, "lobby");
  }

  const room = roomName("ghost");
  await hostRoom(p1, room);
  await joinRoom(p2, room);
  await expectListeners(p1, "pending");
  await expectListeners(p2, "pending");

  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
  await expectListeners(p1, "playing");
  await expectListeners(p2, "playing");

  // One server "show bomb" gives one bomb sprite on each client. Player 1
  // stays on it: the match ends and both pages reload into the modal.
  await holdKey(p1, "Space");
  await waitForBombs(p1, 1);
  await waitForBombs(p2, 1);
  await waitForBombs(p1, 0);
  await waitForBombs(p2, 0);
  await expect.poll(async () => (await hookState(p1))?.me?.alive).toBe(false);
  await waitForRestartModal(p1, p2);
  await expectListeners(p1, "restart-modal");
  await expectListeners(p2, "restart-modal");

  await restartMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
  await expectListeners(p1, "playing");
  await expectListeners(p2, "playing");
});

// https://github.com/NickDurnev/Bomberman-2.0/issues/28
// PlayerWinModal registers "end game" and "player win" in a 3 s timeout that
// its cleanup never clears. Leaving /game within 3 s of a load leaks both.
test.fail(
  "player win modal does not leak end game listeners",
  async ({ players }) => {
    const { p1, p2 } = players;
    const room = roomName("leak");
    await hostRoom(p1, room);
    await joinRoom(p2, room);
    await startMatch(p1);
    await waitForScene(p1, "Playing");
    await waitForScene(p2, "Playing");
    await endMatchBySelfKill(p1, p2);

    // The restart modal is up right after the reload: leave at once.
    await p1.getByRole("button", { name: /^Main Menu/ }).click();
    await p1.waitForURL(url => url.pathname === "/");
    // Let the modal's 3 s timeout fire.
    await p1.waitForTimeout(3_500);
    expect(await hookListeners(p1, ["end game", "player win"])).toEqual({
      "end game": 0,
      "player win": 0,
    });
  },
);
