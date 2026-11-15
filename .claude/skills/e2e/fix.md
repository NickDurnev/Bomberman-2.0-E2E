# /e2e --fix

Run the suite, triage each failure, fix, run again. At most 3 iterations.

## Each iteration

1. Run the suite as in [start.md](start.md) steps 1 to 3. Wait for the final tally.
2. No `failed` line: done. Report the iteration count and the expected failures. Stop.
3. For each unexpected failure, follow [_shared.md](_shared.md) "Failure triage" and decide test-side or product-side.
4. Test-side: fix the spec or fixture. Run that spec with `--repeat-each 3`. Commit on a branch from `origin/main` (one logical fix per commit).
5. Product-side: follow `.claude/rules/cross-repo-fix-workflow.md`. Do not wait for the product PR to merge. Report the PR and stop the loop for that failure.
6. Go to the next iteration.

## Stop rules

- The same test fails in 3 iterations: stop and report it with the error, your triage and what you tried.
- After iteration 3: stop and report.
- Never mark a failing assertion `test.fail` to get green. `test.fail` is only for a bug with an open issue (see `test-quality.md`).

## Report

Iterations run, tests fixed (with commits), product-side failures (with PRs or issues), what is still red.
