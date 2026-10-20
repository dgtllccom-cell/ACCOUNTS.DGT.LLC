import { ApiClientError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Serialises work per business key across ALL server processes with a transaction-scoped Postgres advisory lock
 * (pg_try_advisory_xact_lock). Used for money-moving requests (payments, receipts) so that two simultaneous requests for the SAME
 * order are executed one after the other: the second one reads the balance the first one produced, so together they can never
 * exceed the payable / receivable.
 *
 * Transaction-level locks are safe behind Supabase's transaction pooler (port 6543); session-level locks are not.
 * The lock-holding transaction writes nothing; `fn` does its own work on its own connections. If DATABASE_URL is not set the
 * function simply runs (local/dev without a database cannot race).
 */
export async function withKeyedLock<T>(key: string, fn: () => Promise<T>, opts: { waitMs?: number; pollMs?: number } = {}): Promise<T> {
  const waitMs = opts.waitMs ?? 45_000;
  const pollMs = opts.pollMs ?? 150;
  const holder = await withLocalPg(async (pg) =>
    pg.begin(async (tx: any) => {
      const deadline = Date.now() + waitMs;
      for (;;) {
        const rows = await tx`select pg_try_advisory_xact_lock(hashtext(${key})) as got`;
        if (rows[0]?.got) break;
        if (Date.now() >= deadline) {
          throw new ApiClientError("Another payment for this order is still being processed. Please wait a moment and check the order before trying again.", { status: 409, code: "ORDER_BUSY" });
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      return { value: await fn() };
    })
  );
  if (holder === null) return fn();
  return (holder as { value: T }).value;
}
