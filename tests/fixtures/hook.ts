import { expect, type Page } from "@playwright/test";

import type { E2EState } from "../global";

// Thin wrappers around the frontend test hook (window.__e2e).
// They return null while the hook is missing, for example during the reload
// after a match, so expect.poll can wait across navigations.

export async function waitForHook(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => typeof window.__e2e), {
      message: "window.__e2e is missing: build the frontend with VITE_E2E=true",
    })
    .toBe("object");
}

export function hookState(page: Page): Promise<E2EState | null> {
  return page.evaluate(() => window.__e2e?.state() ?? null);
}

export function hookScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__e2e?.scenes() ?? []);
}

export function hookListeners(
  page: Page,
  events?: string[],
): Promise<Record<string, number>> {
  return page.evaluate(
    names => window.__e2e?.listenerCounts(names) ?? {},
    events,
  );
}

export async function waitForScene(page: Page, key: string): Promise<void> {
  await expect.poll(() => hookScenes(page), { timeout: 30_000 }).toContain(key);
}

export async function waitForBombs(page: Page, count: number): Promise<void> {
  await expect
    .poll(async () => (await hookState(page))?.bombs, { timeout: 10_000 })
    .toBe(count);
}
