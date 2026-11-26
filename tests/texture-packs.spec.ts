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

type IconProbe = Window & { firstSpeedIcon?: string | null };

// Records the src of the HUD Speed icon (PlayerStats.tsx) when it first
// appears. Pending → game is a client-side navigation: the observer survives.
const recordFirstSpeedIcon = (page: Page) =>
  page.evaluate(() => {
    const probe = window as IconProbe;
    probe.firstSpeedIcon = null;
    new MutationObserver((_, observer) => {
      const icon = document.querySelector('img[alt="Speed"]');
      if (icon) {
        probe.firstSpeedIcon = icon.getAttribute("src");
        observer.disconnect();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

const firstSpeedIcon = (page: Page) =>
  page.evaluate(() => (window as IconProbe).firstSpeedIcon);

// The pending screen sets the HUD's pack: the HUD does not show the default
// pack until the get current game ack arrives.
test("the HUD draws the room's pack from its first frame", async ({
  players,
}) => {
  const { p1, p2 } = players;
  const room = roomName("hud");

  await hostRoom(p1, room, { texturePack: "Classic" });
  await joinRoom(p2, room);
  await recordFirstSpeedIcon(p1);
  await recordFirstSpeedIcon(p2);
  await startMatch(p1);
  await waitForScene(p1, "Playing");
  await waitForScene(p2, "Playing");

  for (const page of [p1, p2]) {
    expect(await firstSpeedIcon(page)).toBe(
      "/assets/packs/classic/speed_icon.png",
    );
  }
});
