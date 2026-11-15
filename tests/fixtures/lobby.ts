import { expect, type Page } from "@playwright/test";

import { hookState } from "./hook";
import { holdKey } from "./keys";

// Room names must be unique on the server.
export const roomName = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

// Menu → New Game → Small map → Play. Returns the game id from the URL.
export async function hostRoom(page: Page, name: string): Promise<string> {
  await page.getByPlaceholder("Game Name").fill(name);
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /^Small map/ }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForURL(/\/pending\/[^/]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

// Joins a room from the lobby by its name.
export async function joinRoom(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForURL(/\/pending\/[^/]+$/);
}

// Pending screen → Leave Game → lobby.
export async function leaveRoom(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Leave Game/ }).click();
  await page.waitForURL(url => url.pathname === "/");
}

// Starts the 3 s countdown. Both players then go to /game/:id.
export async function startMatch(host: Page): Promise<void> {
  const start = host.getByRole("button", { name: /^Start Game/ });
  await expect(start).toBeEnabled();
  await start.click();
}

// The victim places a bomb and stays on it. The other player wins, and after
// the server delay both pages reload into the restart modal.
export async function endMatchBySelfKill(
  victim: Page,
  ...others: Page[]
): Promise<void> {
  await holdKey(victim, "Space");
  await expect
    .poll(async () => (await hookState(victim))?.me?.alive)
    .toBe(false);
  await waitForRestartModal(victim, ...others);
}

// After a match ends, each page reloads and shows the restart modal.
export async function waitForRestartModal(...pages: Page[]): Promise<void> {
  for (const page of pages) {
    await expect(restartButton(page)).toBeVisible({ timeout: 30_000 });
  }
}

export const restartButton = (page: Page) =>
  page.getByRole("button", { name: /^Restart Game/ });

// Restart modal → Restart Game, once every player is in the new game.
export async function restartMatch(host: Page): Promise<void> {
  await expect(restartButton(host)).toBeEnabled({ timeout: 15_000 });
  await restartButton(host).click();
}
