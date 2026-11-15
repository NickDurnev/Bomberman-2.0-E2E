# /e2e --start

Fresh stack, full run in the background, report the tally.

1. If `pgrep -f "playwright test"` finds a run, tell the user and stop. Offer `/e2e --stop`.
2. Run the stack lifecycle from [_shared.md](_shared.md) "Stack lifecycle". If `stack:up` fails, report its message and the end of `.stack/*.log`, then stop.
3. Start the background run ([_shared.md](_shared.md) "Background run") and the monitor ([_shared.md](_shared.md) "Monitor").
4. Tell the user: the run started, `/e2e --status` gives a snapshot, `/e2e --stop` stops it.
5. When the run ends, report the tally in one line, the unexpected failures by test name, and the expected failures (`test.fail`) by test name. Leave the stack up for `--fix`; say so.
