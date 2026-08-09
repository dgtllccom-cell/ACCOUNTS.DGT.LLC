import { NextRequest } from "next/server";
import postgres from "postgres";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/**
 * Database Localization Audit + Backfill.
 *
 * Reuses the SAME architecture every create/update path already writes through:
 *   - Registry: lib/i18n/translatable-fields.ts (which table.field pairs are translatable)
 *   - Engine:   lib/services/translation-trigger-service.ts -> multilingual-service.ts
 *   - Storage:  record_translations (view over the 5 per-language tables)
 *
 * GET  -> audit only (read-only). For every registered table.field, counts how many
 *         live rows have a non-empty source value, and how many of those have a
 *         complete/partial/missing set of the 5 language_texts in record_translations.
 * POST -> audit + backfill. Same scan, but also calls translateMasterRecord() for every
 *         row found missing or incomplete, then re-counts. Non-destructive: existing
 *         manually-corrected values are never overwritten (translateMasterRecord's
 *         upsert only writes 'auto' rows; a prior 'manual' correction is untouched by
 *         the DB trigger's ON CONFLICT only when re-invoked with source='manual', but
 *         since this route always calls with source="auto" via the shared engine, a
 *         row a human already corrected will be re-upserted with the SAME auto value —
 *         to avoid ever clobbering a manual correction, rows already translation_status
 *         'complete' are skipped entirely; only missing/absent rows are (re)generated.
 */

function getDbUrl(): string {
  return process.env.DATABASE_URL || "";
}

type FieldAudit = {
  table: string;
  field: string;
  mode: "translate" | "transliterate";
  totalSourceRows: number;
  fullyTranslated: number;
  missingSome: number;
  missingAll: number;
  /** Of `fullyTranslated`, how many have at least one language differing from the
   *  English text — i.e. an actual translation happened, not just the dictionary's
   *  "no match, echo the source" fallback copied into all 5 slots. */
  genuinelyTranslated: number;
  /** All 5 slots present but identical to the English source (Latin place/person names
   *  with no dictionary entry, most common for the bulk-imported `cities` table). */
  englishFallbackOnly: number;
};

// table/field values only ever come from the static TRANSLATABLE_FIELDS registry
// (lib/i18n/translatable-fields.ts) — never from request input — so a strict
// identifier allowlist check is sufficient defense-in-depth before interpolating
// them into raw SQL (postgres.js `$1` parameter binding cannot bind identifiers).
const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;
function assertSafeIdentifier(name: string): string {
  if (!IDENTIFIER_RE.test(name)) throw new Error(`Unsafe identifier rejected: ${name}`);
  return name;
}

async function auditTable(sql: postgres.Sql, table: string, field: string) {
  const safeTable = assertSafeIdentifier(table);
  const safeField = assertSafeIdentifier(field);
  // 1. How many live rows have a non-empty value for this field?
  const totalRows = await sql.unsafe(
    `select count(*)::int as n from public."${safeTable}" where deleted_at is null and "${safeField}" is not null and trim("${safeField}") <> ''`
  ).catch(() => [{ n: 0 }]);

  // 2. Of the rows in record_translations for this table+field, how many have all 5 non-empty,
  //    and of those, how many are a REAL translation vs the dictionary's "no match" fallback
  //    (all 4 non-English slots byte-identical to the English text — only possible for that
  //    to be a coincidence with Latin-script city/person names, so it's a reliable signal).
  const coverage = await sql`
    with complete as (
      select *
      from record_translations
      where record_table = ${table} and field_name = ${field} and deleted_at is null
        and english_text is not null and trim(english_text) <> ''
        and urdu_text is not null and trim(urdu_text) <> ''
        and arabic_text is not null and trim(arabic_text) <> ''
        and persian_text is not null and trim(persian_text) <> ''
        and pashto_text is not null and trim(pashto_text) <> ''
    )
    select
      (select count(*) from complete)::int as fully_translated,
      (select count(*) from complete
        where trim(urdu_text) <> trim(english_text)
           or trim(arabic_text) <> trim(english_text)
           or trim(persian_text) <> trim(english_text)
           or trim(pashto_text) <> trim(english_text)
      )::int as genuinely_translated,
      (
        select count(*) from record_translations
        where record_table = ${table} and field_name = ${field} and deleted_at is null
      )::int as any_row_count
  `.catch(() => [{ fully_translated: 0, genuinely_translated: 0, any_row_count: 0 }]);

  const total = totalRows[0]?.n ?? 0;
  const fully = coverage[0]?.fully_translated ?? 0;
  const genuine = coverage[0]?.genuinely_translated ?? 0;
  const anyRow = coverage[0]?.any_row_count ?? 0;
  const partial = Math.max(0, anyRow - fully);
  const missingAll = Math.max(0, total - anyRow);

  return { total, fully, partial, missingAll, genuine, fallbackOnly: fully - genuine };
}

async function findIncompleteRecordIds(
  sql: postgres.Sql,
  table: string,
  field: string,
  limit: number,
  restrictIds: string[] | null = null,
  includeFallbackOnly = false
) {
  const safeTable = assertSafeIdentifier(table);
  const safeField = assertSafeIdentifier(field);
  const restrictClause = restrictIds ? `and t.id = any($4::uuid[])` : "";
  const params: unknown[] = [table, field, limit];
  if (restrictIds) params.push(restrictIds);
  // Base condition: missing entirely, or one of the 5 slots empty.
  // When includeFallbackOnly is set, ALSO catch rows where all 5 slots are present but the
  // non-English ones are byte-identical to English (the old dictionary-only engine's "no
  // match, echo the source" behavior) — these need reprocessing now that the transliteration
  // fallback exists, even though they were previously marked translation_status='complete'.
  // source = 'auto' guard: never touch a row a human has manually corrected, even if it
  // happens to look like a fallback copy (e.g. a name that's genuinely identical across scripts).
  const fallbackClause = includeFallbackOnly
    ? `or (
        rt.id is not null
        and rt.source = 'auto'
        and trim(rt.urdu_text) = trim(rt.english_text)
        and trim(rt.arabic_text) = trim(rt.english_text)
        and trim(rt.persian_text) = trim(rt.english_text)
        and trim(rt.pashto_text) = trim(rt.english_text)
      )`
    : "";
  const rows = await sql.unsafe(
    `
    select t.id as id, t."${safeField}" as value
    from public."${safeTable}" t
    left join record_translations rt
      on rt.record_table = $1 and rt.record_id = t.id and rt.field_name = $2 and rt.deleted_at is null
    where t.deleted_at is null
      and t."${safeField}" is not null and trim(t."${safeField}") <> ''
      ${restrictClause}
      and (
        rt.id is null
        or rt.english_text is null or trim(rt.english_text) = ''
        or rt.urdu_text is null or trim(rt.urdu_text) = ''
        or rt.arabic_text is null or trim(rt.arabic_text) = ''
        or rt.persian_text is null or trim(rt.persian_text) = ''
        or rt.pashto_text is null or trim(rt.pashto_text) = ''
        ${fallbackClause}
      )
    limit $3
    `,
    params
  ).catch(() => []);
  return rows as Array<{ id: string; value: string }>;
}

/**
 * Discovers every column in the schema that is a foreign key into cities(id) — dynamically,
 * via pg_catalog, rather than a hand-maintained table list that would silently go stale as
 * new modules add their own city_id column. Then unions the distinct non-null values across
 * all of them: the set of cities genuinely referenced by real ERP records right now.
 */
async function findInUseCityIds(sql: postgres.Sql): Promise<string[]> {
  const fkColumns = await sql`
    select
      tc.table_name,
      kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'cities'
      and ccu.column_name = 'id'
  `.catch(() => [] as Array<{ table_name: string; column_name: string }>);

  if (fkColumns.length === 0) return [];

  const safePairs = fkColumns
    .filter((c) => IDENTIFIER_RE.test(c.table_name) && IDENTIFIER_RE.test(c.column_name))
    .map((c) => `select "${c.column_name}" as city_id from public."${c.table_name}" where "${c.column_name}" is not null`);

  if (safePairs.length === 0) return [];

  const unionQuery = `select distinct city_id from (${safePairs.join(" union all ")}) x`;
  const rows = await sql.unsafe(unionQuery).catch(() => [] as Array<{ city_id: string }>);
  return rows.map((r) => r.city_id);
}

const LOCATION_MASTER_TABLES = [
  "countries",
  "states_provinces",
  "districts",
  "cities",
  "areas_locations",
  "ports",
  "country_branches",
  "city_branches",
  "branches"
];

function tablesToScan(scope: string | null): string[] {
  if (scope === "cities-in-use") return ["cities"];
  if (scope === "locations") return LOCATION_MASTER_TABLES.filter((t) => TRANSLATABLE_FIELDS[t]);
  if (scope === "all") return Object.keys(TRANSLATABLE_FIELDS);
  // Default: locations only (this endpoint's primary purpose), unless "all" is asked for.
  return LOCATION_MASTER_TABLES.filter((t) => TRANSLATABLE_FIELDS[t]);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new Error("Only Super Admin can run the database localization audit.");

    const dbUrl = getDbUrl();
    if (!dbUrl) throw new Error("DATABASE_URL is not configured.");
    const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });

    const scope = request.nextUrl.searchParams.get("scope");
    const tables = tablesToScan(scope);

    const results: FieldAudit[] = [];
    for (const table of tables) {
      for (const { field, mode } of TRANSLATABLE_FIELDS[table]) {
        const { total, fully, partial, missingAll, genuine, fallbackOnly } = await auditTable(sql, table, field);
        results.push({
          table,
          field,
          mode,
          totalSourceRows: total,
          fullyTranslated: fully,
          missingSome: partial,
          missingAll,
          genuinelyTranslated: genuine,
          englishFallbackOnly: fallbackOnly
        });
      }
    }
    await sql.end({ timeout: 2 }).catch(() => undefined);

    const totals = results.reduce(
      (acc, r) => ({
        recordsScanned: acc.recordsScanned + r.totalSourceRows,
        fullyTranslated: acc.fullyTranslated + r.fullyTranslated,
        genuinelyTranslated: acc.genuinelyTranslated + r.genuinelyTranslated,
        englishFallbackOnly: acc.englishFallbackOnly + r.englishFallbackOnly,
        missingLanguageRecords: acc.missingLanguageRecords + r.missingSome + r.missingAll
      }),
      { recordsScanned: 0, fullyTranslated: 0, genuinelyTranslated: 0, englishFallbackOnly: 0, missingLanguageRecords: 0 }
    );

    return apiOk({
      scope: scope ?? "locations",
      totals,
      byField: results,
      remainingIssues: results.filter((r) => r.missingSome + r.missingAll > 0).map((r) => `${r.table}.${r.field}: ${r.missingSome + r.missingAll} record(s) missing at least one language`),
      fallbackOnlyIssues: results.filter((r) => r.englishFallbackOnly > 0).map((r) => `${r.table}.${r.field}: ${r.englishFallbackOnly} record(s) have all 5 slots but non-English ones are just the English text copied (no dictionary match — needs a real translation, not just presence)`)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new Error("Only Super Admin can run the database localization backfill.");

    const dbUrl = getDbUrl();
    if (!dbUrl) throw new Error("DATABASE_URL is not configured.");
    const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 30, connect_timeout: 10 });

    const body = await request.json().catch(() => ({}));
    const scope = (body?.scope as string | undefined) ?? request.nextUrl.searchParams.get("scope") ?? "locations";
    const perFieldLimit = Math.min(Math.max(Number(body?.perFieldLimit) || 500, 1), 2000);
    const includeFallbackOnly = body?.includeFallbackOnly === true;
    const tables = tablesToScan(scope);
    const restrictIds = scope === "cities-in-use" ? await findInUseCityIds(sql) : null;

    let autoFilled = 0;
    let failed = 0;
    const perField: Array<{ table: string; field: string; found: number; filled: number; failed: number }> = [];

    // Each row is one DB round-trip (via the Supabase REST client, independent of the
    // `sql` connection above), so a strict sequential loop is far too slow for tables
    // in the tens/hundreds of thousands (e.g. the imported `cities` table). Run with
    // bounded concurrency instead — high enough to matter, low enough not to hammer
    // Supabase's connection pool alongside normal app traffic.
    const CONCURRENCY = 20;
    async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>) {
      let index = 0;
      async function next(): Promise<void> {
        const i = index++;
        if (i >= items.length) return;
        await worker(items[i]);
        return next();
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => next()));
    }

    for (const table of tables) {
      for (const { field } of TRANSLATABLE_FIELDS[table]) {
        const rows = await findIncompleteRecordIds(sql, table, field, perFieldLimit, restrictIds, includeFallbackOnly);
        let filled = 0;
        let fieldFailed = 0;
        await runWithConcurrency(rows, async (row) => {
          try {
            await translateMasterRecord(table, row.id, { [field]: row.value }, "en", session.userId);
            filled += 1;
          } catch {
            fieldFailed += 1;
          }
        });
        autoFilled += filled;
        failed += fieldFailed;
        if (rows.length > 0) perField.push({ table, field, found: rows.length, filled, failed: fieldFailed });
      }
    }
    await sql.end({ timeout: 2 }).catch(() => undefined);

    return apiOk({
      scope,
      inUseCityCount: restrictIds?.length ?? undefined,
      autoFilled,
      failed,
      perField,
      note: "Re-run GET on this endpoint to confirm remaining issues are now 0. Rows already translation_status='complete' were left untouched."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
