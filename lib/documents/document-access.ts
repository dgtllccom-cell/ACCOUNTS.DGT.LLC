/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ONE access rule for the Central i-Documents (office_documents): list, upload, edit, delete, preview/download, version history and audit.
 *
 * The routes read with row-level security OFF (direct Postgres), so these checks ARE the security boundary:
 *   - the action needs its documents:* permission (read / create / update / delete);
 *   - the row must lie inside the login's own country / main-branch / city-branch scope (the shared scope rule, sessionSqlScope). A login whose
 *     country list is EMPTY (a branch-only assignment) is scoped to its branch - it never falls through to "no filter" (the old routes tested
 *     `allowedCountries.length > 0` and skipped the check otherwise, so a branch user could list, download, edit and delete every document);
 *   - Business and Shipping Line documents stay apart (a Business login never opens a Shipping document and the other way round);
 *   - a login that only sees its own work (no admin scope) sees only the documents it uploaded (the upload is recorded in audit_logs).
 * A document outside the scope answers 404, never 403, so its existence is not confirmed.
 */

import { NextResponse } from "next/server";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { reportScopeLevel, sessionReportDomains } from "@/lib/reports/report-access";

export type DocumentAction = "read" | "create" | "update" | "delete";

const SHIPPING_DOCUMENT = /^(shipping|clearing|customs|truck|container|bl[_ -]|bills?[_ ]of[_ ]lading|delivery[_ ]order|manifest)/i;

/** A document belongs to the Shipping Line world when its module type or source module says so. */
export function isShippingDocument(d: { module_type?: string | null; source_module?: string | null }): boolean {
  return SHIPPING_DOCUMENT.test(String(d.module_type ?? "").trim()) || SHIPPING_DOCUMENT.test(String(d.source_module ?? "").trim());
}

export function mayDoDocumentAction(session: ErpSession, action: DocumentAction): boolean {
  return hasRolePermission(session, "documents", action);
}

/** The login's operational domains applied to one document. */
export function documentDomainAllowed(session: ErpSession, d: { module_type?: string | null; source_module?: string | null }): boolean {
  const dom = sessionReportDomains(session);
  return isShippingDocument(d) ? dom.shipping : dom.business;
}

/** JS twin of documentScopeSql for ONE already-loaded row (single-document routes). `uploadedByMe` is only needed for an own-work login. */
export function canAccessDocumentRow(
  session: ErpSession,
  row: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null; module_type?: string | null; source_module?: string | null },
  uploadedByMe = false
): boolean {
  if (session.isSuperAdmin) return true;
  if (!documentDomainAllowed(session, row)) return false;
  if (!recordInSessionScope(session, row)) return false;
  if (reportScopeLevel(session) === "own" && !uploadedByMe) return false;
  return true;
}

/** SQL condition for the documents LIST: scope + operational domain + (own-work logins) uploaded by me. `alias` is the office_documents alias. */
export function documentScopeSql(sql: any, session: ErpSession, alias = "d") {
  const scope = sessionSqlScope(session);
  const col = (c: string) => sql.unsafe(`${alias}.${c}`);
  const dom = sessionReportDomains(session);
  const shippingTest = sql`(coalesce(${col("module_type")},'') ~* ${SHIPPING_DOCUMENT.source} or coalesce(${col("source_module")},'') ~* ${SHIPPING_DOCUMENT.source})`;
  const domainCond = session.isSuperAdmin || (dom.business && dom.shipping) ? sql`true` : dom.shipping ? shippingTest : dom.business ? sql`not ${shippingTest}` : sql`false`;
  const own = !session.isSuperAdmin && reportScopeLevel(session) === "own"
    ? sql`exists (select 1 from public.audit_logs a where a.entity_table = 'office_documents' and a.entity_id::text = ${col("id")}::text and a.action = 'office_document.upload' and a.actor_id::text = ${session.userId})`
    : sql`true`;
  return sql`(${sqlScopeCondition(sql, scope, alias)} and ${domainCond} and ${own})`;
}

const deny = (status: number, message: string) => NextResponse.json({ error: message }, { status });

/**
 * Gate for one existing document: permission for `action`, then scope / domain / own-work. Returns the row, or a ready NextResponse to return
 * (403 for a missing permission, 404 for a document that does not exist or is outside the login's reach).
 */
export async function gateDocument(
  session: ErpSession,
  id: string,
  action: DocumentAction
): Promise<{ row: Record<string, any> } | { response: NextResponse }> {
  if (!mayDoDocumentAction(session, action)) return { response: deny(403, `Missing permission: documents:${action}`) };
  if (!/^[0-9a-fA-F-]{36}$/.test(String(id))) return { response: deny(404, "Document not found") };
  const row = await withLocalPg(async (sql) => {
    const r = (await sql`
      select d.id::text id, d.country_id::text country_id, d.country_branch_id::text country_branch_id, d.city_branch_id::text city_branch_id,
             d.module_type, d.source_module, d.deleted_at
      from public.office_documents d where d.id = ${id}::uuid limit 1`) as any[];
    if (!r[0]) return null;
    let uploadedByMe = false;
    if (!session.isSuperAdmin && reportScopeLevel(session) === "own") {
      const a = await sql`select 1 from public.audit_logs a where a.entity_table = 'office_documents' and a.entity_id::text = ${id} and a.action = 'office_document.upload' and a.actor_id::text = ${session.userId} limit 1`;
      uploadedByMe = a.length > 0;
    }
    return { ...r[0], uploadedByMe };
  });
  if (!row || row.deleted_at) return { response: deny(404, "Document not found") };
  if (!canAccessDocumentRow(session, row, Boolean(row.uploadedByMe))) return { response: deny(404, "Document not found") };
  return { row };
}

/** A new document may only be filed inside the uploader's own scope and domain (the country / branch ids arrive from the browser). */
export function canFileDocumentAt(
  session: ErpSession,
  target: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null; module_type?: string | null; source_module?: string | null }
): boolean {
  if (session.isSuperAdmin) return true;
  if (!documentDomainAllowed(session, target)) return false;
  // a scoped login must file at a place it holds: an unscoped (no country / branch) document is a global one - Super Admin only
  if (!target.country_id && !target.country_branch_id && !target.city_branch_id) return false;
  return recordInSessionScope(session, target);
}
