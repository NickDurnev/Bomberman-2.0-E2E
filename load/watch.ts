import { existsSync } from "node:fs";
import {
  aggregate,
  DEFAULT_POLL_MS,
  DropletMonitor,
  formatPoll,
  type Poll,
} from "./droplet.ts";
import { parseOptions } from "./runner.ts";

// Prints the droplet metrics every 5 s until Ctrl+C, then the maximums.
// Use it while the `Load test` workflow runs on GitHub: the runner has no
// SSH access to the droplet.

const ENV_FILE = new URL("../.env", import.meta.url);
const APP = "app";

async function watch(argv: string[]): Promise<number> {
  const opts = parseOptions(argv, process.env);
  if (!opts.ssh) {
    console.error("Set LOAD_SSH (or --ssh <user>@<droplet-ip>).");
    return 1;
  }
  const monitor = new DropletMonitor({
    target: opts.ssh,
    pm2Path: opts.pm2Path,
    app: APP,
  });
  const polls: Poll[] = [];
  let stopped = false;
  process.on("SIGINT", () => {
    stopped = true;
  });

  console.log("Polling the droplet every 5 s. Ctrl+C stops.");
  while (!stopped) {
    try {
      const poll = await monitor.poll();
      polls.push(poll);
      console.log(formatPoll(APP, poll, new Date()));
    } catch (error) {
      console.warn(String(error instanceof Error ? error.message : error));
    }
    await new Promise(resolve => setTimeout(resolve, DEFAULT_POLL_MS));
  }
  await monitor.close();

  if (polls.length > 0) {
    const m = aggregate(APP, polls);
    console.log(
      `\nMax: cpu ${m.cpuMax} % | mem ${m.memMaxMb} MB | loop p95 ${m.loopP95Max} ms | ` +
        `min free ${m.memAvailableMinMb} MB | other loop p95 ${m.otherLoopP95Max} ms | ` +
        `restarted ${m.restarted ? "yes" : "no"}`,
    );
  }
  return 0;
}

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
watch(process.argv.slice(2))
  .then(code => process.exit(code))
  .catch(error => {
    console.error(String(error instanceof Error ? error.message : error));
    process.exit(1);
  });
