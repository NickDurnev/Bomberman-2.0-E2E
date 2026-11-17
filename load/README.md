# Load test

Finds how many players one room holds before the game lags. Bots play real matches against a backend, one match per step (2, 4, … 14 players), and the tool gives each step a verdict: green, amber or red.

It runs by hand from your computer, so the network path is the one your players have. CI runs only the unit tests (`npm run load:test`), never the load test.

## Run

```bash
npm run load -- --url http://localhost:4000 --steps 2,4 --duration 20   # dry run on the local stack
npm run load                                                           # production, default steps
```

Against production the tool asks you to type `yes` (skip with `--yes`). Ctrl+C stops after the cleanup of the current step; press it again to quit at once.

| Option | Default | Meaning |
| --- | --- | --- |
| `--url` | `https://bomberman.cinematik.click` | Backend (socket.io) URL |
| `--map` | `default_map` | Map; read from `../Bomberman-2.0-Backend/src/maps/` |
| `--steps` | `2,4,6,8,10,12,14` | Players per step; each must be within 2 and the map's `max_players` |
| `--duration` | `60` | Seconds of play per step, at most 150 (the server ends a match at 180 s) |
| `--pause` | `5` | Seconds between steps |
| `--with-me` | off | Each step waits for you to join the room in a browser; the bots fill the rest. Steps below 3 players are skipped |
| `--ssh` | `$LOAD_SSH` | `<user>@<droplet-ip>`: read pm2 and machine metrics over SSH |
| `--pm2-path` | `$HOME/.nvm/versions/node/v22.14.0/bin` | Where `pm2` is on the droplet |
| `--green-ms`, `--amber-ms` | `50`, `100` | Limits for the server share of the move echo and for fuse lateness |

Set `LOAD_SSH` in your shell or in `.env` in this repo (gitignored). Never commit the droplet address.

## What it measures

| Column | Meaning |
| --- | --- |
| echo p50/p95/p99 | Time from a bot's `update player position` to its own `move player` echo (ms) |
| srv share | Echo p95 minus the network baseline: the p95 of 20 `check game name` ack round trips on the idle server, measured before each step |
| bomb p95 | `create bomb` → `show bomb` |
| fuse p95 | How late `detonate bomb` arrives after `show bomb` + the fuse delay, minus the 100 ms tick of the server's bomb queue; grows when the server event loop is busy |
| lost % | Moves without an echo |
| disc | Unexpected disconnects |
| cpu max, mem MB, loop p95 | pm2 metrics of the `app` process (with `--ssh`), polled every 5 s: each poll starts a pm2 CLI on the droplet |
| free MB | The droplet's `MemAvailable` (with `--ssh`) |

Verdict: **green** when the server share and fuse p95 are ≤ 50 ms, nothing is lost, no disconnects, app CPU ≤ 70 % and event-loop p95 ≤ 20 ms. **Amber** up to 100 ms, losses below 1 %, CPU ≤ 90 %, event loop ≤ 50 ms. Anything worse is **red**, and so is a pm2 restart of `app`, free memory below 50 MB, or another pm2 process with an event-loop p95 above 50 ms. The run stops after the first red step.

Reports go to `load/results/` (gitignored): a Markdown table and the raw JSON.

## Production safety

- Bots send no `email` in the handshake, so the server writes no `User` document.
- Bots never send `player died`, so a match never ends with a win, and the server writes no stats.
- After each match one bot enters the pending room that the match end creates and leaves it, so the server deletes it at once. With `--with-me`, you leave that room yourself.
- `pm2 jlist` prints the environment of each process. The tool keeps only the metric fields and never prints or saves the raw output.
- The droplet also runs other services. The verdict turns red when they slow down or memory runs low, and the run stops.
