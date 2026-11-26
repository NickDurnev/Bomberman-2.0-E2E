import { hostRoom, leaveRoom, roomName } from "./fixtures/lobby";
import { expect, test } from "./fixtures/players";

// Menu.tsx shows the list of open rooms the server sends, as it is: every
// room the server lists, and none that left it.
test("the lobby lists every open room and drops a room that closes", async ({
  players,
  p3,
}) => {
  const { p1, p2 } = players;
  const first = roomName("first");
  const second = roomName("second");
  const room = (name: string) => p3.getByRole("button", { name, exact: true });

  await hostRoom(p1, first);
  await expect(room(first)).toBeVisible();

  await hostRoom(p2, second);
  await expect(room(second)).toBeVisible();
  await expect(room(first)).toBeVisible();

  // The host is the room's only player: leaving deletes the room.
  await leaveRoom(p2);
  await expect(room(second)).toHaveCount(0);
  await expect(room(first)).toBeVisible();
});
