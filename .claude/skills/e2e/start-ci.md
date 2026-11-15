# /e2e --start-ci

Run the `E2E` workflow on GitHub, watch it, and triage a failure.

## Inputs

- `frontend_ref`, `backend_ref`: branch, tag or SHA of `NickDurnev/Bomberman-2.0` and `NickDurnev/Bomberman-2.0-Backend`. Default `dev`. Ask the user only if the context does not say which refs to test (for example a product PR branch).
- The E2E ref: `main`, or the E2E branch under test.

## Steps

1. Start the run:

   ```bash
   gh workflow run E2E --repo NickDurnev/Bomberman-2.0-E2E --ref <e2e-ref> \
     -f frontend_ref=<ref> -f backend_ref=<ref>
   ```

2. Get the run id (the dispatch needs a few seconds to show up):

   ```bash
   gh run list --repo NickDurnev/Bomberman-2.0-E2E --workflow E2E --limit 1 \
     --json databaseId,url --jq '.[0]'
   ```

3. Watch it with the `Monitor` tool. A run takes about 5 minutes; poll every 60 s:

   ```bash
   prev=""; while true; do
     cur=$(gh run view <id> --repo NickDurnev/Bomberman-2.0-E2E --json status,conclusion --jq '.status + ":" + (.conclusion // "")')
     [ "$cur" != "$prev" ] && echo "ci $(date +%H:%M): $cur" && prev="$cur"
     case "$cur" in completed:*) break;; esac
     sleep 60
   done
   ```

4. Success: report the run URL and the refs from the job summary.
5. Failure:
   - `gh run view <id> --repo NickDurnev/Bomberman-2.0-E2E --log-failed | tail -80`
   - `gh run download <id> --repo NickDurnev/Bomberman-2.0-E2E --dir .stack/ci-<id>` (the HTML report, `test-results/` and the stack logs).
   - Triage with [_shared.md](_shared.md) "Failure triage", using the downloaded files.
   - If the run fails before the tests (install, build, stack start), report the failing step and its log.
6. Report: run URL, conclusion, refs, unexpected failures with your triage.
