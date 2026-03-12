type TimerResult<T> = {
  result: T;
  durationMs: number;
};

function nowMs(): number {
  return Number(process.hrtime.bigint() / BigInt(1_000_000));
}

export async function timeAsync<T>(
  task: () => Promise<T>
): Promise<TimerResult<T>> {
  const start = nowMs();
  const result = await task();
  return {
    result,
    durationMs: nowMs() - start,
  };
}

export function logServerPerf(scope: string, metrics: Record<string, number>): void {
  if (process.env.HS_PERF_LOG !== "1") {
    return;
  }

  const compact = Object.entries(metrics)
    .map(([key, value]) => `${key}=${value}ms`)
    .join(" ");

  // eslint-disable-next-line no-console
  console.info(`[perf:${scope}] ${compact}`);
}
