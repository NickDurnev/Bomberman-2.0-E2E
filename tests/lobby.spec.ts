import { hostRoom, joinRoom, roomName } from "./fixtures/lobby";
import { expect, test } from "./fixtures/players";

// GameSlots.tsx: the room button keeps the room name as its name (joinRoom
// finds it by name) and is described by the room's map and texture pack.
test("the lobby describes a room by its map and texture pack", async ({
  players,
}) => {
  const { p1, p2 } = players;
  const room = roomName("lobby");

  await hostRoom(p1, room, { texturePack: "Classic" });

  const card = p2.getByRole("button", { name: room, exact: true });
  await expect(card).toHaveAccessibleDescription("Small map · Classic pack");

  await joinRoom(p2, room);
});

// Pending.tsx: every player of the room sees its map drawn in its pack.
test("the pending room shows its map in the room's texture pack", async ({
  players,
}) => {
  const { p1, p2 } = players;
  const room = roomName("pending");

  await hostRoom(p1, room, { texturePack: "Classic" });
  await joinRoom(p2, room);

  for (const page of [p1, p2]) {
    await expect(
      page.getByRole("img", { name: "Small map preview, Classic pack" }),
    ).toBeVisible();
    await expect(page.getByText("Small map · Classic pack")).toBeVisible();
  }
});
