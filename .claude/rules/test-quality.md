# Test quality

- **Never change business logic to make a test pass.** If the product is wrong, fix the product in its own repo through the normal workflow, or report it. If the test is wrong, fix the test.
- **Never pin a bug as correct behaviour.** For a known open bug, write the correct assertion in a separate `test.fail(...)` block with the issue URL in a code comment. The suite then reports when the bug gets fixed. Remove `test.fail` in the PR that fixes the bug.
- **Bugs live in issues and code comments only.** Never describe a bug in docs or in `.claude/` files.
- **Check that a test can fail.** Before you trust a new assertion, see it fail once: against code without the feature, or with a temporary, uncommitted break. Confirm the failure message names the cause, not a timeout somewhere else.
- **Flaky is a bug.** Find the race and wait on the right condition. Do not add retries, longer timeouts or sleeps to hide it. A new or changed spec passes 3 runs in a row (`--repeat-each 3`) before a PR.
- **Exact values.** Assert exact counts (`bombs` is `1`, not `>= 1`). A "greater than zero" check misses ghosting.
- **One flow per test.** A test name says what must be true.
