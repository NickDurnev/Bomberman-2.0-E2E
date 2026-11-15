import { type Page, expect } from "@playwright/test";

import { hookListeners } from "./hook";

// Events with a known listener leak in the frontend. The main ghosting test
// leaves them out; ghosting.spec.ts checks them in a test.fail() block.
// https://github.com/NickDurnev/Bomberman-2.0/issues/28
export const KNOWN_LEAK_EVENTS = ["end game", "player win"] as const;

type Checkpoint = "lobby" | "pending" | "playing" | "restart-modal";

// Socket listeners that are always mounted (src/components/Socket.tsx):
// connect (identity + status) and disconnect.
const app = { connect: 2, disconnect: 1 };

// Pending.tsx on /pending/:id, RestartGameModal.tsx on /game/:id.
const room = { "update game": 1, "start timer": 1, "launch game": 1 };

// Exact listener counts per event at each checkpoint, without
// KNOWN_LEAK_EVENTS. An event that is not listed must have 0 listeners.
// Update this table in the same change as any client clientSocket.on/off.
export const EXPECTED_LISTENERS: Record<Checkpoint, Record<string, number>> = {
  // Menu.tsx
  lobby: { ...app, "display pending games": 1 },
  // Pending.tsx
  pending: { ...app, ...room },
  // RestartGameModal.tsx, usePlayerInfo.ts and the Playing scene
  // (socketHandlers). usePlayerInfo and Playing both listen to
  // "spoil was picked" and "show tombstone".
  playing: {
    ...app,
    ...room,
    "move player": 1,
    "teleport player": 1,
    "show bomb": 1,
    "detonate bomb": 1,
    "spoil was picked": 2,
    "show tombstone": 2,
    "player disconnect": 1,
  },
  // RestartGameModal.tsx and usePlayerInfo.ts, no Phaser game.
  "restart-modal": {
    ...app,
    ...room,
    "spoil was picked": 1,
    "show tombstone": 1,
  },
};

export async function expectListeners(
  page: Page,
  checkpoint: Checkpoint,
): Promise<void> {
  const actual = async () => {
    const counts = await hookListeners(page);
    for (const event of KNOWN_LEAK_EVENTS) {
      delete counts[event];
    }
    return Object.fromEntries(
      Object.entries(counts).filter(([, count]) => count > 0),
    );
  };
  // Poll: React effects and Phaser create() register listeners shortly after
  // the URL or scene changes.
  await expect
    .poll(actual, { message: `listener counts at "${checkpoint}"` })
    .toEqual(EXPECTED_LISTENERS[checkpoint]);
}
