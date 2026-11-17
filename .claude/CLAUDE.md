# Bomberman 2.0 E2E (Playwright)

End-to-end suite for Bomberman 2.0. Two browser contexts (two mocked players) play real matches against a local stack: MongoDB, the backend on `:4000` and the frontend production build on `:3000`. The frontend build sets `VITE_E2E=true`, so it exposes the read-only test hook `window.__e2e` (workspace `docs/e2e-hook.md`).

The suite catches client regressions that the backend tests cannot see: listener ghosting and a broken match flow.

## Skill

- [`/e2e`](skills/e2e/SKILL.md): run, check, stop, fix, run in CI, add a spec. One entry point with `--flag` subcommands. Bare `/e2e` prints the menu.

## Rules

Read before you add or change a spec:

- [playwright-conventions.md](rules/playwright-conventions.md): layout, fixtures, selectors, the hook, keys, waits.
- [test-quality.md](rules/test-quality.md): never change business logic to pass a test; never pin a bug as correct.
- [cross-repo-fix-workflow.md](rules/cross-repo-fix-workflow.md): what to do when a failure is in `Bomberman-2.0` or `Bomberman-2.0-Backend`.

## Quick reference

| Task | Command |
| --- | --- |
| Local MongoDB | `make db` in the workspace root |
| Start the stack | `npm run stack:up` (fails if `:3000` or `:4000` is in use: stop `make dev`) |
| Stop the stack | `npm run stack:down` |
| Full suite | `npx playwright test` |
| One spec | `npx playwright test tests/<name>.spec.ts` |
| One spec, 3 runs | `npx playwright test tests/<name>.spec.ts --repeat-each 3` |
| HTML report | `npm run report` |
| Lint, format, types | `npm run check`, `npm run typecheck` |
| Whole run from the root | `make e2e` |
| Load test (by hand, production by default) | `npm run load` (see `load/README.md`); unit tests `npm run load:test`; droplet metrics `npm run load:watch` |

A local run outside Claude Code needs nothing special. Inside the Claude Code Bash sandbox, Chromium cannot reach local ports: run Playwright with the sandbox disabled.

## Where things are

- `playwright.config.ts`: Chromium only (`channel: "chromium"`), `workers: 1`, 120 s per test, `retries: 1` in CI.
- `tests/fixtures/`: `players.ts` (the `players` fixture), `hook.ts`, `keys.ts`, `lobby.ts` (UI flow steps), `expected-listeners.ts` (exact listener counts per checkpoint).
- `tests/global.d.ts`: the `window.__e2e` type. Keep it equal to `Bomberman-2.0/src/utils/e2e.ts`.
- `scripts/`: `stack-up.sh`, `stack-down.sh`, `wait-for-stack.sh`. Logs and PIDs in `.stack/` (gitignored).
- `.github/workflows/ci.yml`: `checks` (Biome, `tsc`, `npm run load:test`) on PRs to `main`.
- `load/`: the load test tool (`load/README.md`). Never run it against production without the maintainer.
- `.github/workflows/e2e.yml`: `E2E`, `workflow_dispatch` only, inputs `frontend_ref` and `backend_ref` (default `dev`).
- `.github/workflows/load.yml`: `Load test`, `workflow_dispatch` only, against production. Droplet metrics: `npm run load:watch` on the maintainer's computer.

## Workflow

- Branch from `origin/main`. PRs target `main`. The agent never merges.
- Conventional Commits. No AI attribution in commits or PRs.
- Before a PR: `npm run check`, `npm run typecheck`, and the changed specs pass 3 runs in a row.
- Workspace rules apply: `../.claude/rules/development-workflow.md` (see "Keep E2E in sync after behaviour changes").
