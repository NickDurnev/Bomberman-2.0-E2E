# Shared building blocks

Flag files refer to these blocks by name.

## Sandbox

Inside the Claude Code Bash sandbox, Chromium cannot reach local ports. Run every `playwright test` command (and `stack:up`, which serves the ports) with the sandbox disabled.

## Stack lifecycle

```bash
make -C .. db            # local MongoDB in Docker (idempotent)
npm run stack:down       # stop a stack from an earlier run, if any
npm run stack:up         # drops bomberman-e2e, builds both repos, starts :4000 and :3000
```

- `stack:up` exits non-zero when `:3000` or `:4000` is in use. Then `make dev` is probably running. Ask the user before you stop it.
- `stack:up` builds the checkouts as they are. To test a branch, check it out in `../Bomberman-2.0` or `../Bomberman-2.0-Backend` first, and restore the old state at the end.
- Logs: `.stack/backend.log`, `.stack/frontend.log`.

## Background run

```bash
npx playwright test --reporter=list 2>&1 | tee .stack/run.log
```

Run it with the Bash tool and `run_in_background: true`. Always overwrite `.stack/run.log`; only one run at a time. A live run: `pgrep -f "playwright test"`.

## Status snapshot

```bash
grep -E "^  (✓|✘)" .stack/run.log | tail -5
grep -E "[0-9]+ (passed|failed|flaky|skipped|did not run)" .stack/run.log | tail -5
```

`test.fail(...)` blocks (known bugs) print `✘` in the list and still count as passed. The final tally is the truth: the run is green when it has no `failed` line. A `failed` line names the unexpected failures.

## Monitor

Use the `Monitor` tool, not a sleep loop. One monitor for the run (it ends with the run):

```bash
tail -f .stack/run.log | grep -E --line-buffered "✘|[0-9]+ (passed|failed|flaky)|Error:"
```

The full suite takes about 1.5 minutes. Report the tally when the monitor shows the final line.

## Failure triage

For each unexpected failure:

1. Read the error in `.stack/run.log` and `test-results/<test-dir>/error-context.md` (page snapshot). Read the screenshot (`*.png`) if the error is about the UI.
2. A listener-count failure (`listener counts at "<checkpoint>"`) shows the event and the expected and received counts.
   - The count grew and nobody changed listeners on purpose: ghosting, product-side.
   - A frontend change added or moved a listener on purpose: update `tests/fixtures/expected-listeners.ts`, test-side.
3. A hook failure (`window.__e2e is missing`): the frontend was built without `VITE_E2E=true`, or the hook is gone. Check `.stack/frontend.log` and `Bomberman-2.0/src/utils/e2e.ts`.
4. Read `.stack/backend.log` for server errors at the same time.
5. Decide test-side or product-side with the table in `.claude/rules/cross-repo-fix-workflow.md`. Never change business logic to make a test pass.
