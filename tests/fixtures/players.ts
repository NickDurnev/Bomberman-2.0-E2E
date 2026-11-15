import { test as base, type Page } from "@playwright/test";

import { waitForHook } from "./hook";

export interface Players {
  p1: Page;
  p2: Page;
}

// Mocked players: the app reads the user from localStorage["google_user"],
// and the backend accepts that profile without a Google token.
// The two profiles must differ in email and name, or they collapse into one
// player.
export const profile = (n: 1 | 2) => ({
  email: `e2e-player${n}@example.com`,
  name: `E2E Player ${n}`,
  picture: "",
  locale: "en-US",
});

export const test = base.extend<{ players: Players }>({
  players: async ({ browser }, use) => {
    const open = async (n: 1 | 2) => {
      const context = await browser.newContext();
      // Hermetic runs: only the local stack is reachable (no Google scripts).
      await context.route(/^https?:\/\/(?!localhost[:/])/, route =>
        route.abort(),
      );
      await context.addInitScript(user => {
        localStorage.setItem("google_user", JSON.stringify(user));
      }, profile(n));
      const page = await context.newPage();
      await page.goto("/");
      await waitForHook(page);
      return page;
    };

    const p1 = await open(1);
    const p2 = await open(2);
    await use({ p1, p2 });
    await p1.context().close();
    await p2.context().close();
  },
});

export { expect } from "@playwright/test";
