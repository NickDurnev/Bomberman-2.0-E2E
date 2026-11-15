# /e2e --stop

Stop the run and the stack.

1. `pkill -f "playwright test"` if a run is live.
2. `npm run stack:down`.
3. Leave MongoDB up (other work uses it). To stop it too: `make -C .. db-down`.
4. Report what was stopped.
