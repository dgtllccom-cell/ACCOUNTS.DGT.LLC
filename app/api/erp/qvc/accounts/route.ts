import { NextRequest } from "next/server";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { invalidateSystemDictionaryCache } from "@/lib/i18n/localize-records";

// QVC Review Queue — database-driven. Lists imported/pending accounts with their
// per-account 5-language translation status, for one-by-one manual review & approval.
// GET  /api/erp/qvc/accounts?status=qvc_pending|needs_review|qvc_approved|error&q=...
// PATCH /api/erp/qvc/accounts  { id, qvc_status, qvc_notes }  -> approve / flag
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiError("FORBIDDEN", "Only Super Admin can access the QVC queue", 403);
    }
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status")?.trim() || "";
    const q = sp.get("q")?.trim() || "";
    const db = createSupabaseAdminClient() as any;

    let qb = db
      .from("enterprise_accounts")
      .select("id, manual_reference_number, name, code, kind, currency, country_id, city_branch_id, qvc_status, qvc_notes, source_category, import_batch, contacts, created_at, countries:country_id(name), city_branches:city_branch_id(name, city_name)")
      .is("deleted_at", null)
      .not("qvc_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (status) qb = qb.eq("qvc_status", status);
    if (q) qb = qb.or(`manual_reference_number.ilike.%${q}%,name.ilike.%${q}%,code.ilike.%${q}%`);

    const { data: accounts, error } = await qb;
    if (error) throw error;

    const ids = (accounts ?? []).map((a: any) => a.id);
    let transByAcct: Record<string, any[]> = {};
    if (ids.length) {
      const { data: trans } = await db
        .from("record_translations")
        .select("record_id, field_name, english_text, urdu_text, pashto_text, persian_text, arabic_text, translation_status")
        .eq("record_table", "enterprise_accounts")
        .in("record_id", ids)
        .is("deleted_at", null);
      for (const t of trans ?? []) (transByAcct[t.record_id] ??= []).push(t);
    }

    const rows = (accounts ?? []).map((a: any) => {
      const tr = transByAcct[a.id] ?? [];
      const byField = (f: string) => tr.find((t) => t.field_name === f) || {};
      const contacts = Array.isArray(a.contacts) ? a.contacts : [];
      const c = (t: string) => contacts.find((x: any) => x.type === t)?.value || "";
      // A field is "translated" for a lang when that lang column is non-empty and differs from English.
      const langStatus = (lang: "urdu_text" | "pashto_text" | "persian_text" | "arabic_text") =>
        ["name", "company_name", "business_name", "city", "address"].every((f) => {
          const row = byField(f);
          return !row.english_text || (row[lang] && row[lang] !== row.english_text);
        }) ? "translated" : "needs_review";
      return {
        id: a.id,
        manualNumber: a.manual_reference_number,
        accountCode: a.code,
        accountName: byField("name").english_text || a.name,
        companyName: byField("company_name").english_text || "",
        businessName: byField("business_name").english_text || "",
        country: a.countries?.name || "",
        branch: a.city_branches?.city_name || a.city_branches?.name || "",
        category: "Expenses",
        subcategory: "Company Expenses",
        city: byField("city").english_text || "",
        address: byField("address").english_text || "",
        mobile: c("mobile"), whatsapp: c("whatsapp"), phone: c("phone"), email: c("email"),
        qvcStatus: a.qvc_status,
        qvcNotes: a.qvc_notes || "",
        translations: {
          en: "present",
          ur: langStatus("urdu_text"), ps: langStatus("pashto_text"),
          fa: langStatus("persian_text"), ar: langStatus("arabic_text")
        }
      };
    });

    const counts = { qvc_pending: 0, needs_review: 0, qvc_approved: 0, error: 0 } as Record<string, number>;
    for (const r of rows) counts[r.qvcStatus] = (counts[r.qvcStatus] || 0) + 1;
    return apiOk({ accounts: rows, counts, total: rows.length });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiError("FORBIDDEN", "Only Super Admin can update QVC status", 403);
    }
    const body = await request.json();
    if (!body.id || !body.qvc_status) return apiError("VALIDATION", "id and qvc_status required", 400);
    const allowed = ["qvc_pending", "needs_review", "qvc_approved", "error"];
    if (!allowed.includes(body.qvc_status)) return apiError("VALIDATION", "invalid qvc_status", 400);
    const db = createSupabaseAdminClient() as any;
    const { error } = await db.from("enterprise_accounts")
      .update({ qvc_status: body.qvc_status, qvc_notes: body.qvc_notes ?? undefined, qvc_reviewed_by: session.userId, qvc_reviewed_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) throw error;
    // Approved translations must be usable ERP-wide immediately — drop the dictionary cache.
    invalidateSystemDictionaryCache();
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
