export type Summary = {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

// Nearest-rank percentile. NaN for an empty list.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export function summarize(values: number[]): Summary {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: percentile(values, 100),
  };
}

// The part of the move echo time that the server adds on top of the network.
export function serverShare(echoP95: number, baselineMs: number): number {
  return Math.max(0, echoP95 - baselineMs);
}
