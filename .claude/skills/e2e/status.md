# /e2e --status

Snapshot of the current run. Read only: no state change, no monitors.

1. Run the status snapshot from [_shared.md](_shared.md) "Status snapshot".
2. Check whether the run is live: `pgrep -f "playwright test"`.
3. Report:

   ```
   Run: live | finished | none
   Last results: <up to 5 lines ✓/✘ with test names>
   Tally: <final tally line, if finished>
   Unexpected failures: <test names, or none>
   ```

If `.stack/run.log` does not exist, say that no run has started.
