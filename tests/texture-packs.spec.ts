import type { Page } from "@playwright/test";

import { hookTextures, waitForBombs, waitForScene } from "./fixtures/hook";
import { holdKey } from "./fixtures/keys";
import {
  type HostRoomOptions,
  hostRoom,
  joinRoom,
  roomName,
  startMatch,
} from "./fixtures/lobby";
import { expect, type Players, test } from "./fixtures/players";

// The texture-pack keys of Preload.ts (PACK_TEXTURES).
const PACK_KEYS = [
  "tiles",
  "explosion_center",
  "explosion_horizontal",
  "explosion_vertical",
  "explosion_up",
  "explosion_right",
  "explosion_down",
  "explosion_left",
  "spoil_tileset",
  "tombstone",
  "bomb_tileset",
  "portal_tileset",
];

const allFrom = (pack: string) =>
  Object.fromEntries(PACK_KEYS.map(key => [key, pack]));

// Player 1 hosts with the given room options, player 2 joins, both play.
async function playMatch(
  { p1, p2 }: Players,
  opts?: HostRoomOptions,
): Promise<void> {
  const room = roomName("packs");
  await hostRoom(p1, room, opts);
  await joinRoom(p2, room);
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");
}

// The HUD icons (PlayerStats.tsx) come from the room's pack too.
const expectSpeedIcon = (page: Page, pack: string) =>
  expect(page.getByRole("img", { name: "Speed" })).toHaveAttribute(
    "src",
    `/assets/packs/${pack}/speed_icon.png`,
  );

test("a room without a pack choice draws the default pack for every player", async ({
  players,
}) => {
  const { p1, p2 } = players;

  await playMatch(players);

  expect(await hookTextures(p1)).toEqual(allFrom("default"));
  expect(await hookTextures(p2)).toEqual(allFrom("default"));
  await expectSpeedIcon(p1, "default");
  await expectSpeedIcon(p2, "default");
});

test("the host's texture pack draws the match for every player", async ({
  players,
}) => {
  const { p1, p2 } = players;

  await playMatch(players, { texturePack: "Classic" });

  expect(await hookTextures(p1)).toEqual(allFrom("classic"));
  expect(await hookTextures(p2)).toEqual(allFrom("classic"));
  await expectSpeedIcon(p1, "classic");
  await expectSpeedIcon(p2, "classic");

  // The pack only changes the look: one bomb from player 1 shows on both.
  await holdKey(p1, "Space");
  await waitForBombs(p1, 1);
  await waitForBombs(p2, 1);
});

test("a file missing from a pack falls back to the default pack", async ({
  players,
}) => {
  const { p1, p2 } = players;

  // Only player 2 lacks the classic portal sheet.
  await p2
    .context()
    .route("**/assets/packs/classic/portal.png", route =>
      route.fulfill({ status: 404 }),
    );

  await playMatch(players, { texturePack: "Classic" });

  expect(await hookTextures(p1)).toEqual(allFrom("classic"));
  expect(await hookTextures(p2)).toEqual({
    ...allFrom("classic"),
    portal_tileset: "default",
  });
});
