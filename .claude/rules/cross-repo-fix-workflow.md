# Cross-repo fix workflow

A failing E2E test has one of two causes. Decide which before you change anything.

| Cause | Signs | Fix |
| --- | --- | --- |
| Test-side | A selector or copy changed, a new modal covers a button, a wait is too early, the listener table is out of date after an intended change | Fix the spec or the fixture in this repo |
| Product-side | The game does something wrong on `dev`: a crash, a broken flow, a listener leak, a wrong count | Fix it in `Bomberman-2.0` or `Bomberman-2.0-Backend` |

## Product-side fix

1. Follow the workspace `development-workflow` rule in the child repo: branch from `origin/dev`, fix, run the checks, run `make ci` in the root, open a PR to `dev`.
2. Never merge. The maintainer merges.
3. Prove the fix with E2E before the PR: run `/e2e --start-ci` with `frontend_ref` (or `backend_ref`) set to your branch. Link the run in the PR.
4. If the E2E specs must change too, open a companion PR in this repo. It merges after the product PR.

## Hook change

A change to `window.__e2e` (`Bomberman-2.0/src/utils/e2e.ts`) or to `E2E_SOCKET_EVENTS`:

1. Frontend PR first. It also updates the workspace `docs/e2e-hook.md`.
2. Then the E2E PR: `tests/global.d.ts`, the fixtures, `expected-listeners.ts`. Run `E2E` with `frontend_ref` set to the frontend branch.
3. Merge order: frontend PR, then E2E PR, in the same window. `E2E` runs against `dev` by default.
