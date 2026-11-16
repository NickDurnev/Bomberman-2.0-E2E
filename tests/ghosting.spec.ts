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
// React re-mounts and Phaser game destroy/create. A restart stays in the page.

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
  // stays on it: the match ends and both pages show the results modal.
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
// Leaving the results modal for the menu removes its "end game" and
// "player win" listeners with the Game route.
test("leaving the results modal leaks no end-of-match listeners", async ({
  players,
}) => {
  const { p1, p2 } = players;
  const room = roomName("leak");
  await hostRoom(p1, room);
  await joinRoom(p2, room);
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
  await endMatchBySelfKill(p1, p2);

  // Leave as soon as the results modal is up.
  await p1.getByRole("button", { name: /^Main Menu/ }).click();
  await p1.waitForURL(url => url.pathname === "/");
  // Poll: the URL changes before React unmounts the Game route.
  await expect
    .poll(() => hookListeners(p1, ["end game", "player win"]))
    .toEqual({ "end game": 0, "player win": 0 });
  await expectListeners(p1, "lobby");
});
