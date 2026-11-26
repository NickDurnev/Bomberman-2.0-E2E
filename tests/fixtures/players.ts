import { type Browser, test as base, type Page } from "@playwright/test";

import { waitForHook } from "./hook";

export interface Players {
  p1: Page;
  p2: Page;
}

// Mocked players: the app reads the user from localStorage["google_user"],
// and the backend accepts that profile without a Google token.
// The profiles must differ in email and name, or they collapse into one
// player.
type PlayerNumber = 1 | 2 | 3;

export const profile = (n: PlayerNumber) => ({
  email: `e2e-player${n}@example.com`,
  name: `E2E Player ${n}`,
  picture: "",
  locale: "en-US",
});

// One player in its own browser context, on the lobby.
async function openPlayer(browser: Browser, n: PlayerNumber): Promise<Page> {
  const context = await browser.newContext();
  // Hermetic runs: only the local stack is reachable (no Google scripts).
  await context.route(/^https?:\/\/(?!localhost[:/])/, route => route.abort());
  await context.addInitScript(user => {
    localStorage.setItem("google_user", JSON.stringify(user));
  }, profile(n));
  const page = await context.newPage();
  await page.goto("/");
  await waitForHook(page);
  return page;
}

export const test = base.extend<{ players: Players; p3: Page }>({
  players: async ({ browser }, use) => {
    const p1 = await openPlayer(browser, 1);
    const p2 = await openPlayer(browser, 2);
    await use({ p1, p2 });
    await p1.context().close();
    await p2.context().close();
  },
  // A third player, opened only by the tests that ask for it.
  p3: async ({ browser }, use) => {
    const p3 = await openPlayer(browser, 3);
    await use(p3);
    await p3.context().close();
  },
});

export { expect } from "@playwright/test";
