# Bomberman 2.0 E2E

End-to-end tests for [Bomberman 2.0](https://github.com/NickDurnev/Bomberman-2.0) and its [backend](https://github.com/NickDurnev/Bomberman-2.0-Backend). Two Playwright browser contexts play real matches against a local stack: MongoDB, the backend on `:4000` and the frontend production build on `:3000`.

The frontend build used here sets `VITE_E2E=true`. It exposes a read-only test hook, `window.__e2e` (socket listener counts, active scenes, a snapshot of the match). See [docs/e2e-hook.md](https://github.com/NickDurnev/Bomberman-2.0-Workspace/blob/main/docs/e2e-hook.md) in the workspace repo.

## Run locally

This repo is a submodule of [Bomberman-2.0-Workspace](https://github.com/NickDurnev/Bomberman-2.0-Workspace). The scripts use the sibling checkouts `../Bomberman-2.0` and `../Bomberman-2.0-Backend` (override with `FRONTEND_DIR` and `BACKEND_DIR`).

```bash
make db                         # in the workspace root: local MongoDB
npm ci && npx playwright install chromium
npm run stack:up                # fails if :3000 or :4000 is in use (stop make dev)
npx playwright test
npm run stack:down
```

`stack-up.sh` drops the `bomberman-e2e` database at the start of each run. It refuses any MongoDB URL that is not local.

## Load test

`load/` holds a separate tool: bots play one room against a backend (production by default) and report how many players the room holds before the game lags. Run it by hand with `npm run load`; see [load/README.md](load/README.md).

## Agents

`.claude/` holds the agent rules and the `/e2e` skill (run, status, stop, fix, CI run, add a spec). From the workspace root, `/e2e` routes to it.

## CI

- `checks` (Biome, `tsc`, the load tool's unit tests) runs on every PR to `main`.
- `E2E` runs only by hand: **Actions → E2E → Run workflow**, with the frontend and backend refs (default `dev`).
