import { expect, test } from "@playwright/test";

test("frontend serves the app with the test hook", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => typeof window.__e2e))
    .toBe("object");
  expect(await page.evaluate(() => window.__e2e?.scenes())).toEqual([]);
  expect(await page.evaluate(() => window.__e2e?.state())).toBeNull();
  const counts = await page.evaluate(() => window.__e2e?.listenerCounts());
  expect(Object.keys(counts ?? {})).toContain("show bomb");
});
