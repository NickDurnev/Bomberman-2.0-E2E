# /e2e --add <description>

Write one new spec from a description.

## The description

It must say:

- the flow (which screens, which player does what);
- what must be true at the end (the assertions).

If it is too vague to write exact assertions, ask one question and stop. Do not write a placeholder spec.

## Steps

1. Read `.claude/rules/playwright-conventions.md` and `test-quality.md`.
2. Scan `tests/fixtures/` for steps that already do part of the flow. Reuse them.
3. Start the stack ([_shared.md](_shared.md) "Stack lifecycle") and drive the flow live to find the roles, names and hook values. Use the Playwright MCP browser, or a scratch Playwright script outside the repo that prints `page.locator("body").ariaSnapshot()` and `window.__e2e` values at each step.
4. Write the spec in `tests/<flow>.spec.ts` with the `players` fixture. Move a step to `tests/fixtures/` only if a second spec needs it.
5. If the flow mounts listeners at a new checkpoint, add the checkpoint to `tests/fixtures/expected-listeners.ts` with the file that registers each listener.
6. See the new assertion fail once (a temporary, uncommitted break, or code without the feature). Then run the spec with `--repeat-each 3`: all pass.
7. `npm run check` and `npm run typecheck` exit 0. Commit on a branch from `origin/main`: `test: <what the spec covers>`.
8. Report the spec, what it asserts, the red-then-green evidence, and anything you had to add to the fixtures.
