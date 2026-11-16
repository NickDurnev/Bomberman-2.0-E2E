# Playwright conventions

## Layout

- One spec file per flow in `tests/` (`match-flow.spec.ts`, `ghosting.spec.ts`).
- Shared steps live in `tests/fixtures/`. Scan it before you write a helper. Add a new step there when a second spec needs it.

## Players

- Use the `players` fixture from `tests/fixtures/players.ts`. Import `test` and `expect` from it, not from `@playwright/test`.
- Each player is its own browser context with `localStorage["google_user"]` set before the app loads. Profiles: `e2e-player1@example.com` / `E2E Player 1` and `e2e-player2@example.com` / `E2E Player 2`. Never use the same profile in two contexts: the players collapse into one.
- Contexts block every request that is not `localhost`. Do not add external URLs.

## Selectors

1. `getByRole` with the accessible name (`getByRole("button", { name: /^Start Game/ })`). Buttons with an emoji icon have the emoji name in their accessible name: anchor with `^`.
2. `getByPlaceholder` for inputs.
3. `data-testid` only when 1 and 2 cannot select the element. Add it in `Bomberman-2.0` in its own PR (see `cross-repo-fix-workflow.md`).

Never select by CSS class or by DOM position.

## The canvas

The game draws on a canvas. Read game state only through the hook wrappers in `tests/fixtures/hook.ts`: `hookState`, `hookScenes`, `hookListeners`, `waitForScene`, `waitForBombs`. Never read Phaser objects with your own `page.evaluate`.

## Keys

The game reads keys once per frame. Use `holdKey(page, key, ms)` from `tests/fixtures/keys.ts` (default hold 250 ms). `keyboard.press` is too short.

## Waits

- Wait on a condition: `expect.poll`, `toBeVisible`, `waitForURL`, the hook wrappers.
- Never use `page.waitForTimeout` to wait for the app. The only fixed waits are a key hold and a wait for a known app timer that the test is about (comment the timer).
- The restart flow stays in the page: no reload, one Phaser game per match. The hook wrappers return `null` while a page loads, so `expect.poll` keeps polling.

## Rooms and data

- Room names must be unique: `roomName(prefix)`.
- `stack-up.sh` drops the `bomberman-e2e` database at the start of a run. Do not assert on data from earlier tests.
- Tests run one at a time (`workers: 1`): one server and one database serve both players.

## Listener counts

`tests/fixtures/expected-listeners.ts` holds the exact count per event at each checkpoint (`lobby`, `pending`, `playing`, `restart-modal`). A frontend change that adds, removes or moves a `clientSocket.on` updates this table in the same change. Each entry names the file that registers it.
