/** One Idempotency-Key per user ACTION (button click): a double click / retry replays the first result instead of posting a second time. */
export function newIdempotencyKey(scope: string, id: string): string {
  const rand = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}-${id}-${rand}`;
}
