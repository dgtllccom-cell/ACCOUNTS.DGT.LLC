import { z } from "zod";

export type RegisterCursor = { at: string; id: string };
const atSchema = z.string().datetime({ offset: true });
const idSchema = z.string().uuid();

/** Only the opted-in register requests paged data. Existing list consumers keep their response contract. */
export function parseRegisterPage(params: URLSearchParams) {
  if (params.get("registerPage") !== "1") return { enabled: false, cursor: null };
  const at = params.get("cursorAt"), id = params.get("cursorId");
  return { enabled: true, cursor: at || id ? { at: atSchema.parse(at), id: idSchema.parse(id) } : null };
}

export function splitRegisterPage<T extends { id: string; created_at?: string; register_cursor_timestamp?: string }>(
  rows: T[], limit: number, enabled: boolean,
) {
  if (!enabled) return { rows, nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const at = last?.register_cursor_timestamp ?? last?.created_at;
  const nextCursor = rows.length > limit && last && at ? { at, id: last.id } : null;
  return { rows: page, nextCursor };
}

const REGISTER_ROW_LIMIT = 10_000;

/** Load bounded pages from the currently authorized scope; never silently claim completeness past the cap. */
export async function loadScopedRegister<T>(
  read: (cursor: RegisterCursor | null) => Promise<{ rows: T[]; nextCursor?: RegisterCursor | null }>,
  options: { maxRows?: number; current?: () => boolean } = {},
) {
  const maxRows = options.maxRows ?? REGISTER_ROW_LIMIT;
  let cursor: RegisterCursor | null = null;
  const combined: T[] = [];
  const seen = new Set<string>();
  do {
    if (options.current?.() === false) return { rows: combined, complete: false };
    const page = await read(cursor);
    const remaining = maxRows - combined.length;
    combined.push(...page.rows.slice(0, remaining));
    cursor = page.nextCursor ?? null;
    if (page.rows.length > remaining || (cursor && combined.length >= maxRows)) return { rows: combined, complete: false };
    if (cursor) {
      const key = cursor.at + "/" + cursor.id;
      if (!page.rows.length || seen.has(key)) throw new Error("The register returned a non-advancing page.");
      seen.add(key);
    }
  } while (cursor);
  return { rows: combined, complete: true };
}

export function registerPageParams(cursor: RegisterCursor | null) {
  const params = new URLSearchParams({ registerPage: "1" });
  if (cursor) { params.set("cursorAt", cursor.at); params.set("cursorId", cursor.id); }
  return params;
}
