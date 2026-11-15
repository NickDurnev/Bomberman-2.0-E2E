---
name: e2e
description: Run, check, stop, fix, run in CI or extend the Bomberman E2E suite. Invoke with `/e2e <flag>`. Bare `/e2e` prints the menu.
---

# /e2e: Bomberman E2E workflow

One entry point for everything that runs, debugs or extends the E2E suite. Each flag has its own file in this directory. The files apply the rules in `.claude/rules/`; they do not repeat them.

## Menu

```
/e2e --start              # fresh stack + full run in the background + progress
/e2e --status             # snapshot of the current run
/e2e --stop               # stop the run and the stack
/e2e --fix                # run, triage each failure, fix, run again (max 3 iterations)
/e2e --start-ci           # run the E2E workflow on GitHub, watch it, triage a failure
/e2e --add <description>  # write one new spec from a description
/e2e                      # this menu
```

Use one flag per call. To chain, run them one after the other.

## Routing

| Flag | Follow |
| --- | --- |
| `--start` | [start.md](start.md) |
| `--status` | [status.md](status.md) |
| `--stop` | [stop.md](stop.md) |
| `--fix` | [fix.md](fix.md) |
| `--start-ci` | [start-ci.md](start-ci.md) |
| `--add` | [add.md](add.md) |
| (no flag) | Print the menu above, then stop. |
| (unknown flag) | Print the menu and one line `Unknown flag: <flag>`, then stop. |

The flag files use the building blocks in [_shared.md](_shared.md): stack lifecycle, background run, status snapshot, monitors, failure triage. Read it when a flag file refers to it.

## Assumptions

- The working directory is the `Bomberman-2.0-E2E` repo root, inside the workspace (the siblings `../Bomberman-2.0` and `../Bomberman-2.0-Backend` exist).
- `gh` is authenticated for `--start-ci`.
- The rules in `.claude/rules/` are authoritative.

## Out of scope

- Merging any PR. The maintainer merges.
- Changing product code without the normal workflow (see `cross-repo-fix-workflow.md`).
- Running against any database that is not local.
