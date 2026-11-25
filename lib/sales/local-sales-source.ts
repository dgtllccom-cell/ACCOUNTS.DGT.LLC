import type { PendingQuery, Row, Sql } from "postgres";

/** saleMode defaults to local even for stock/bookings, so it is only decisive for managed lots. */
export function isLocalSalesFormData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const saved = data as Record<string, any>;
  const form = saved.form ?? {};
  const source = form.saleSource ?? saved.saleSource;
  const mode = form.saleMode ?? saved.saleMode;
  return source === "local" || (source === "lot" && mode !== "export" && form.isExportSale !== true && saved.isExportSale !== true);
}

// Fixed compiler-controlled column references only. All supplied values remain bound SQL parameters.
export function sqlLocalSalesSource(sql: Sql, data: PendingQuery<Row[]>) {
  const source = sql`coalesce(${data} #>> '{form,saleSource}', ${data}->>'saleSource', '')`;
  const mode = sql`coalesce(${data} #>> '{form,saleMode}', ${data}->>'saleMode', '')`;
  return sql`(${source} = 'local' or (${source} = 'lot' and ${mode} <> 'export'
    and (${data} #>> '{form,isExportSale}') is distinct from 'true'
    and (${data}->>'isExportSale') is distinct from 'true'))`;
}

const nestedSource = "form_data->form->>saleSource";
const legacySource = "form_data->>saleSource";
const nestedMode = "form_data->form->>saleMode";
const legacyMode = "form_data->>saleMode";
const nestedExport = "form_data->form->>isExportSale";
const legacyExport = "form_data->>isExportSale";

/** Equivalent PostgREST predicate for the existing journal fallback. */
export const localSalesSourcePostgrest = [
  `${nestedSource}.eq.local`,
  `and(${nestedSource}.is.null,${legacySource}.eq.local)`,
  `and(or(${nestedSource}.eq.lot,and(${nestedSource}.is.null,${legacySource}.eq.lot)),or(${nestedMode}.neq.export,and(${nestedMode}.is.null,or(${legacyMode}.neq.export,${legacyMode}.is.null))),or(${nestedExport}.neq.true,${nestedExport}.is.null),or(${legacyExport}.neq.true,${legacyExport}.is.null))`,
].join(",");
