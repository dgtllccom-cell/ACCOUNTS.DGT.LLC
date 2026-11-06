/**
 * Map items with at most `limit` promises in flight, preserving input order.
 *
 * Used where a list fans out one request per row: an unbounded fan-out exhausts the
 * database connection pool (the server then answers 500s and the caller never finishes).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(Math.trunc(limit) || 1, items.length));
  const workers = Array.from({ length: items.length ? workerCount : 0 }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return out;
}
