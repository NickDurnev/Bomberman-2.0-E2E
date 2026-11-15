import type { Page } from "@playwright/test";

export type GameKey =
  | "Space"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

// The game reads keys once per frame (isDown), so a press must last several
// frames. keyboard.press is too short; hold the key instead.
export async function holdKey(
  page: Page,
  key: GameKey,
  ms = 250,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
