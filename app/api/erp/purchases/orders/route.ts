export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { purchaseOrderCreateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { safeInsertPurchaseOrderItems, safeInsertPurchaseOrderExpenses } from "@/lib/services/purchase-table-manager";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { ensurePurchaseSchemaAndEnums } from "@/lib/services/purchase-table-manager";
import { createPurchaseOrderViaLocalPg } from "@/lib/services/purchase-order-local-pg";
import { revalidatePath } from "next/cache";
import { purchaseOrderTranslationFields } from "@/lib/i18n/purchase-order-translations";
import { buildVerifiedTranslationSet } from "@/lib/i18n/verified-record-translations";
import { getDbUrl, withLocalPg } from "@/lib/db/local-postgres";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { validateAccountCountryScope, validateLedgerCountryScope } from "@/lib/api/country-scope-validator";

const listQuerySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  q: z.string().optional()
});

function cleanSerialPrefix(val: string | null | undefined, fallback: string) {
  if (!val) return fallback;
  const clean = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean || fallback;
}

async function nextTransactionSerial(admin: any, scopeType: string, scopeKey: string, prefix: string) {
  const { data, error } = await admin.rpc("next_transaction_serial", {
    p_scope_type: scopeType,
    p_scope_key: scopeKey,
    p_prefix: prefix
  });
  if (error) throw new Error(error.message);
  return data;
}

async function resolveCountryCurrency(admin: any, countryId: string | null | undefined, fallback = "USD") {
  if (!countryId) return fallback;
  const { data } = await admin
    .from("countries")
    .select("currency_code")
    .eq("id", countryId)
    .maybeSingle();
  return data?.currency_code || fallback;
}

async function resolveEffectiveScope(req: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  if (getDbUrl()) {
    const viaPg = await withLocalPg(async (sql) => {
      if (req.cityBranchId) {
        const rows: any[] = await sql`
          select id, country_id, country_branch_id
          from city_branches
          where id = ${req.cityBranchId}::uuid
          limit 1
        `;
        if (rows[0]) return { countryId: rows[0].country_id, countryBranchId: rows[0].country_branch_id, cityBranchId: req.cityBranchId };
      }
      if (req.countryBranchId) {
        const rows: any[] = await sql`
          select id, country_id
          from country_branches
          where id = ${req.countryBranchId}::uuid
          limit 1
        `;
        if (rows[0]) return { countryId: rows[0].country_id, countryBranchId: req.countryBranchId, cityBranchId: null };
      }
      return { countryId: req.countryId ?? null, countryBranchId: null, cityBranchId: null };
    });
    if (viaPg) return viaPg;
  }

  const supabase = (await createApiSupabaseClient()) as any;
  
  if (req.cityBranchId) {
    const { data: row } = await supabase
      .from("city_branches")
      .select("id, country_id, country_branch_id")
      .eq("id", req.cityBranchId)
      .maybeSingle();
    if (row) return { countryId: (row as any).country_id, countryBranchId: (row as any).country_branch_id, cityBranchId: req.cityBranchId };
  }

  if (req.countryBranchId) {
    const { data: row } = await supabase
      .from("country_branches")
      .select("id, country_id")
      .eq("id", req.countryBranchId)
      .maybeSingle();
    if (row) return { countryId: (row as any).country_id, countryBranchId: req.countryBranchId, cityBranchId: null };
  }

  return { countryId: req.countryId ?? null, countryBranchId: null, cityBranchId: null };
}

async function saveVerifiedPurchaseTranslationsViaPg(
  tx: any,
  input: {
    recordId: string;
    originalLanguage: any;
    fields: Array<{ fieldName: string; value: string | null | undefined; mode?: "translate" | "transliterate"; translations?: Record<string, string> }>;
    actorId?: string | null;
    source?: "auto" | "manual" | "imported";
  }
) {
  for (const field of input.fields.filter((item) => typeof item.value === "string" && String(item.value).trim())) {
    const originalText = String(field.value).trim();
    const verified = await buildVerifiedTranslationSet({
      value: originalText,
      originalLanguage: input.originalLanguage,
      mode: field.mode,
      supplied: field.translations as any
    });
    await tx`
      select upsert_record_translation(
        ${"purchase_orders"},
        ${input.recordId}::uuid,
        ${field.fieldName},
        ${originalText},
        ${input.originalLanguage},
        ${verified.translations.en ?? null},
        ${verified.translations.ur ?? null},
        ${verified.translations.ar ?? null},
        ${verified.translations.fa ?? null},
        ${verified.translations.ps ?? null},
        ${JSON.stringify(verified.translations)}::jsonb,
        ${input.source ?? "auto"},
        ${verified.status},
        ${verified.engine},
        ${input.source === "manual" ? input.actorId ?? null : null}
      )
    `;
  }
}

async function lookupEnterpriseAccountCountryScopeViaPg(
  tx: any,
  term: string,
  targetCountryId: string | null | undefined
) {
  const clean = String(term || "").trim();
  if (!clean) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);
  const rows = isUuid
    ? await tx`
        select id, code, name, country_id
        from enterprise_accounts
        where id = ${clean}::uuid
          and deleted_at is null
        limit 1
      `
    : [];
  const byId = rows?.[0] ?? null;
  if (byId) return byId;
  const byCode = await tx`
    select id, code, name, country_id
    from enterprise_accounts
    where code = ${clean}
      and deleted_at is null
    limit 1
  `;
  const row = byCode?.[0] ?? null;
  if (!row) return null;
  if (targetCountryId && row.country_id && row.country_id !== targetCountryId) {
    throw new Error(`Cross-country violation: Account '${row.name}' (${row.code}) belongs to a different country than the transaction target country.`);
  }
  return row;
}

async function lookupLedgerCountryScopeViaPg(
  tx: any,
  term: string,
  targetCountryId: string | null | undefined
) {
  const clean = String(term || "").trim();
  if (!clean) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);
  const rows = isUuid
    ? await tx`
        select id, code, name, country_id
        from ledgers
        where id = ${clean}::uuid
          and deleted_at is null
        limit 1
      `
    : [];
  const byId = rows?.[0] ?? null;
  if (byId) return byId;
  const byCode = await tx`
    select id, code, name, country_id
    from ledgers
    where code = ${clean}
      and deleted_at is null
    limit 1
  `;
  const row = byCode?.[0] ?? null;
  if (!row) return null;
  if (targetCountryId && row.country_id && row.country_id !== targetCountryId) {
    throw new Error(`Cross-country violation: Ledger '${row.name}' (${row.code}) belongs to a different country than the transaction target country.`);
  }
  return row;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await requireErpSession();

    const query = listQuerySchema.parse({
      countryId: searchParams.get("countryId") || undefined,
      countryBranchId: searchParams.get("countryBranchId") || undefined,
      cityBranchId: searchParams.get("cityBranchId") || undefined,
      limit: searchParams.get("limit") || undefined,
      q: searchParams.get("q") || searchParams.get("search") || searchParams.get("purchaseOrderNo") || undefined
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const term = query.q ? query.q.trim().replace(/[%_]/g, "") : null;
    const like = term ? `%${term}%` : null;
    const viaPgRows = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT po.*, to_jsonb(c.*) as countries, to_jsonb(cb.*) as country_branches
        FROM public.purchase_orders po
        LEFT JOIN public.countries c ON c.id = po.country_id
        LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
        WHERE po.deleted_at IS NULL
          AND (${query.cityBranchId ? sql`po.city_branch_id = ${query.cityBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && query.countryBranchId ? sql`po.country_branch_id = ${query.countryBranchId}::uuid` : sql`true`})
          AND (${!query.cityBranchId && !query.countryBranchId && query.countryId ? sql`po.country_id = ${query.countryId}::uuid` : sql`true`})
          AND (${like ? sql`(
            po.purchase_order_no ILIKE ${like} OR po.purchase_contract_no ILIKE ${like} OR
            po.form_data->'form'->>'manualBillNo' ILIKE ${like} OR po.form_data->'form'->>'manual_bill_no' ILIKE ${like} OR
            po.form_data->'form'->>'billNo' ILIKE ${like} OR po.form_data->'form'->>'invoiceNo' ILIKE ${like} OR
            po.form_data->'form'->>'purchaseContractNo' ILIKE ${like} OR po.form_data->'form'->>'supplierName' ILIKE ${like} OR
            po.form_data->'form'->>'customerName' ILIKE ${like} OR po.form_data->'form'->>'goodsName' ILIKE ${like} OR
            po.form_data->'form'->>'productName' ILIKE ${like} OR po.form_data->'form'->>'purchaseAccountName' ILIKE ${like} OR
            po.form_data->'form'->>'salesAccountName' ILIKE ${like}
          )` : sql`true`})
        ORDER BY po.created_at DESC
        LIMIT ${query.limit}
      `;
      return rows;
    });

    let rawRows: any;
    if (viaPgRows) {
      rawRows = viaPgRows;
    } else {
      const supabase = (await createApiSupabaseClient()) as any;
      let q = supabase
        .from("purchase_orders")
        .select(`
          *,
          countries(name, currency_code),
          country_branches(name, code)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Apply strict DB-level scoping based on user session BEFORE limit
      if (!session.isSuperAdmin) {
        if (session.cityBranchIds.length > 0) {
          q = q.or(`city_branch_id.in.(${session.cityBranchIds.join(",")}),city_branch_id.is.null`);
          if (session.countryIds.length > 0) {
            q = q.in("country_id", session.countryIds);
          }
        } else if (session.countryBranchIds.length > 0) {
          q = q.in("country_branch_id", session.countryBranchIds);
        } else if (session.countryIds.length > 0) {
          q = q.in("country_id", session.countryIds);
        } else {
          q = q.eq("id", "00000000-0000-0000-0000-000000000000"); // Fail-safe empty state
        }
      }

      if (query.cityBranchId) q = q.eq("city_branch_id", query.cityBranchId);
      else if (query.countryBranchId) q = q.eq("country_branch_id", query.countryBranchId);
      else if (query.countryId) q = q.eq("country_id", query.countryId);

      if (query.q) {
        const qterm = query.q.trim().replace(/[%_]/g, "");
        q = q.or(
          `purchase_order_no.ilike.%${qterm}%,` +
          `purchase_contract_no.ilike.%${qterm}%,` +
          `form_data->form->>manualBillNo.ilike.%${qterm}%,` +
          `form_data->form->>manual_bill_no.ilike.%${qterm}%,` +
          `form_data->form->>billNo.ilike.%${qterm}%,` +
          `form_data->form->>invoiceNo.ilike.%${qterm}%,` +
          `form_data->form->>purchaseContractNo.ilike.%${qterm}%,` +
          `form_data->form->>supplierName.ilike.%${qterm}%,` +
          `form_data->form->>customerName.ilike.%${qterm}%,` +
          `form_data->form->>goodsName.ilike.%${qterm}%,` +
          `form_data->form->>productName.ilike.%${qterm}%,` +
          `form_data->form->>purchaseAccountName.ilike.%${qterm}%,` +
          `form_data->form->>salesAccountName.ilike.%${qterm}%`
        );
      }

      try {
        rawRows = await requireSupabaseData(q.limit(query.limit));
      } catch (e: any) {
        const errMsg = String(e.message || e);
        if (errMsg.includes("column") || errMsg.includes("does not exist") || errMsg.includes("schema cache") || errMsg.includes("relation")) {
          await ensurePurchaseSchemaAndEnums();
          rawRows = await requireSupabaseData(q.limit(query.limit));
        } else {
          throw e;
        }
      }
    }
    const seenPo = new Set<string>();
    const mappedRows = (rawRows ?? []).map((row: any) => {
      const formData = typeof row.form_data === "string"
        ? (() => { try { return JSON.parse(row.form_data); } catch { return row.form_data; } })()
        : row.form_data;
      return {
        ...row,
        form_data: formData,
        countryName: row.countries?.name || null,
        branchName: row.country_branches?.name || null
      };
    });
    const rows = mappedRows.filter((row: any) => {
      const poNo = String(row.purchase_order_no || "").trim().toUpperCase();
      if (!poNo) return true;
      if (seenPo.has(poNo)) return false;
      seenPo.add(poNo);
      return true;
    });

    const filteredRows = rows.filter((row: any) => {
      if (session.isSuperAdmin) return true;
      const matchCity = !session.cityBranchIds.length || 
        (row.city_branch_id && session.cityBranchIds.includes(row.city_branch_id)) ||
        (!row.city_branch_id && row.country_branch_id && session.countryBranchIds.includes(row.country_branch_id));
      const matchBranch = !session.countryBranchIds.length || (row.country_branch_id && session.countryBranchIds.includes(row.country_branch_id));
      const matchCountry = !session.countryIds.length || (row.country_id && session.countryIds.includes(row.country_id));
      return matchCity && matchBranch && matchCountry;
    });

    return apiOk(filteredRows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const rawBody = await request.json();

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "PURCHASE_ORDER",
      userId: session.userId,
      countryId: session.countryIds[0] ?? null,
      cityBranchId: session.cityBranchIds[0] ?? null,
      businessReference: rawBody?.purchaseOrderNo || rawBody?.purchaseContractNo,
      payload: rawBody
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 201, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return handleApiError(new Error("A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const body = purchaseOrderCreateSchema.parse(rawBody);

    const effective = await resolveEffectiveScope({
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "create",
      countryId: effective.countryId,
      countryBranchId: effective.countryBranchId,
      cityBranchId: effective.cityBranchId
    });

    const hasLocalPg = Boolean(getDbUrl());
    const supabase = hasLocalPg ? null : await createApiSupabaseClient();
    const adminSupabase = hasLocalPg ? null : (createSupabaseAdminClient() as any);
    if (hasLocalPg) {
      const responsePayload = await createPurchaseOrderViaLocalPg({ session, body, effective });
      if (responsePayload?.purchaseOrderId) {
        await writeAuditLog({
          action: "create_purchase_order",
          entityTable: "purchase_orders",
          entityId: responsePayload.purchaseOrderId,
          before: null,
          after: responsePayload,
          ipAddress: request.headers.get("x-forwarded-for") ?? null
        });
      }
      revalidatePath("/dashboard/purchase/purchase-order");
      if (idempotencyKey && tenantHash) {
        await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, responsePayload);
      }
      return apiCreated(responsePayload);
    }

    // Rule 1: Country Scope Validation for Purchase Accounts
    const form = (body.formData as any)?.form || {};
    const purchaseAccountId = form.purchaseAccountId || form.purchaseAccountNo;
    const salesAccountId = form.salesAccountId || form.salesAccountNo;

    if (purchaseAccountId) {
      await validateAccountCountryScope(session, purchaseAccountId, effective.countryId, adminSupabase);
    }
    if (salesAccountId) {
      await validateAccountCountryScope(session, salesAccountId, effective.countryId, adminSupabase);
    }

    let countryPrefix = "PK";
    if (effective.countryId) {
      const { data: countryRow } = await adminSupabase
        .from("countries")
        .select("iso2")
        .eq("id", effective.countryId)
        .maybeSingle();
      if (countryRow?.iso2) countryPrefix = countryRow.iso2.toUpperCase();
    }

    let branchPrefix = "QTA";
    let branchTransactionSerialNumber = null;
    let countryTransactionSerialNumber = null;
    let superAdminSerialNumber = null;

    if (effective.cityBranchId) {
      const { data: cityRow } = await adminSupabase
        .from("city_branches")
        .select("code")
        .eq("id", effective.cityBranchId)
        .maybeSingle();
      if (cityRow?.code) {
        const parts = cityRow.code.split("-");
        branchPrefix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : cityRow.code.toUpperCase();
      }

      const { count: branchCount } = await adminSupabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("city_branch_id", effective.cityBranchId);
      const bSeq = (branchCount || 0) + 1;
      branchTransactionSerialNumber = `${countryPrefix}-${branchPrefix}-${String(bSeq).padStart(4, "0")}`;
    }

    if (effective.countryId) {
      const { count: countryCount } = await adminSupabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("country_id", effective.countryId);
      const cSeq = (countryCount || 0) + 1;
      countryTransactionSerialNumber = `${countryPrefix}-${String(cSeq).padStart(6, "0")}`;
    }

    const { count: totalCount } = await adminSupabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true });
    const sSeq = (totalCount || 0) + 1;
    superAdminSerialNumber = String(sSeq).padStart(8, "0");

    const purchaseOrderNo =
      !body.purchaseOrderNo || body.purchaseOrderNo === "AUTO"
        ? branchTransactionSerialNumber || `PO-${Date.now()}`
        : body.purchaseOrderNo.trim();

    const orderTotal = body.orderTotal ?? 0;
    const advanceAmount = body.advanceAmount ?? 0;
    const remainingDue = Math.max(0, orderTotal - advanceAmount);
    
    let paymentStatus = body.paymentStatus || "unpaid";
    if (advanceAmount > 0 && advanceAmount < orderTotal) paymentStatus = "partially_paid";
    else if (advanceAmount >= orderTotal && orderTotal > 0) paymentStatus = "paid";

    const ledgerPostingStatus = body.ledgerPostingStatus || "unposted";

    const purchaseCurrency = body.purchaseCurrency || "USD";
    const paymentCurrency = body.paymentCurrency || purchaseCurrency;

    const payload = {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      purchase_order_no: purchaseOrderNo,
      purchase_contract_no: body.purchaseContractNo?.trim() || null,
      supplier_company_id: body.supplierCompanyId ?? null,
      
      purchase_currency: purchaseCurrency,
      payment_currency: paymentCurrency,
      currency_code: purchaseCurrency,
      exchange_rate: body.exchangeRate,
      order_total: body.orderTotal,
      
      total_goods_original: body.totalGoodsOriginal ?? 0,
      total_goods_local: body.totalGoodsLocal ?? 0,
      total_goods_usd: body.totalGoodsUsd ?? 0,
      total_expenses_original: body.totalExpensesOriginal ?? 0,
      total_expenses_local: body.totalExpensesLocal ?? 0,
      total_expenses_usd: body.totalExpensesUsd ?? 0,
      landed_cost_original: body.landedCostOriginal ?? 0,
      landed_cost_local: body.landedCostLocal ?? 0,
      landed_cost_usd: body.landedCostUsd ?? 0,

      form_data: {
        ...((body.formData as any) || {}),
        form: {
          ...((body.formData as any)?.form || {}),
          billNo: branchTransactionSerialNumber || (body.formData as any)?.form?.billNo || null
        }
      },
      payment_status: paymentStatus,
      ledger_posting_status: ledgerPostingStatus,
      advance_paid: advanceAmount,
      remaining_due: remainingDue,
      super_admin_serial_number: superAdminSerialNumber,
      country_transaction_serial_number: countryTransactionSerialNumber,
      branch_transaction_serial_number: branchTransactionSerialNumber
    };

    let inserted: any;
    const viaPgInsert = await withLocalPg(async (sql) => {
      const rows = await sql`INSERT INTO public.purchase_orders ${sql(payload as any)} RETURNING id, purchase_order_no`;
      return rows[0];
    });

    if (viaPgInsert) {
      inserted = viaPgInsert;
    } else {
      try {
        inserted = await requireSupabaseData(
          (supabase as any).from("purchase_orders").insert(payload).select("id, purchase_order_no").single()
        );
      } catch (e: any) {
        const errMsg = String(e.message || e);
        if (errMsg.includes("schema cache") || errMsg.includes("column") || errMsg.includes("relation") || errMsg.includes("landed_cost") || errMsg.includes("currency")) {
          await ensurePurchaseSchemaAndEnums();
          try {
            inserted = await requireSupabaseData(
              (supabase as any).from("purchase_orders").insert(payload).select("id, purchase_order_no").single()
            );
          } catch (retryErr: any) {
            return apiError("INSERT_FAILED", retryErr.message || String(retryErr), 400);
          }
        } else {
          return apiError("INSERT_FAILED", errMsg, 400);
        }
      }
    }

    const orderId = (inserted as any).id;
    // AFTER the order row is created. Does NOT touch posting/ledger logic.
    try {
      const s = await allocateFormSerials("purchase", { countryId: effective.countryId, branchKey: effective.countryBranchId ?? effective.cityBranchId ?? null });
      const serialPatch = { super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial };
      const viaPgSerial = await withLocalPg(async (sql) => {
        await sql`UPDATE public.purchase_orders SET ${sql(serialPatch)} WHERE id = ${orderId}::uuid`;
        return true;
      });
      if (!viaPgSerial) {
        await adminSupabase.from("purchase_orders").update(serialPatch).eq("id", orderId);
      }
    } catch { /* non-fatal — never blocks the order/posting */ }

    let insertedItems: Array<{ id: string; goods_name?: string; brand?: string; unit_name?: string }> = [];
    if (body.items && body.items.length > 0) {
      const itemsPayload = body.items.map((it: any) => ({
        purchase_order_id: orderId,
        product_id: it.productId || null,
        goods_name: it.goodsName || "Unknown",
        hs_code: it.hsCode || null,
        size: it.size || null,
        brand: it.brand || null,
        origin: it.origin || null,
        quantity: it.quantity || 0,
        unit_name: it.unitName || "pcs",
        unit_weight: it.unitWeight || 0,
        gross_weight: it.grossWeight || 0,
        net_weight: it.netWeight || 0,
        rate_original: it.rateOriginal || 0,
        rate_local: it.rateLocal || 0,
        rate_usd: it.rateUsd || 0,
        total_original: it.totalOriginal || 0,
        total_local: it.totalLocal || 0,
        total_usd: it.totalUsd || 0
      }));
      try {
        insertedItems = await safeInsertPurchaseOrderItems(supabase, itemsPayload);
      } catch (e: any) {
        return apiError("ITEMS_INSERT_FAILED", e.message || String(e), 400);
      }
    }

    if (body.expenses && body.expenses.length > 0) {
      const expPayload = body.expenses.map((ex: any) => ({
        purchase_order_id: orderId,
        expense_type: ex.expenseType,
        ledger_id: ex.ledgerId || null,
        description: ex.description || null,
        exchange_rate: ex.exchangeRate || 1
      }));
      try {
        await safeInsertPurchaseOrderExpenses(supabase, expPayload);
      } catch (e: any) {
        return apiError("EXPENSES_INSERT_FAILED", e.message || String(e), 400);
      }
    }

    let translationSummary: { status: "complete" | "pending"; fields: Record<string, unknown> } = { status: "pending", fields: {} };
    try {
      const currentFormData: any = payload.form_data || {};
      const supplied = body.translations || {};
      const fields = purchaseOrderTranslationFields(body.formData, body.items).map((field) => ({
        ...field,
        translations: supplied[field.fieldName]
      }));
      const translationResults = await saveVerifiedEnterpriseRecordTranslations({
        recordTable: "purchase_orders",
        recordId: orderId,
        originalLanguage: body.originalLanguage,
        fields,
        actorId: session.userId,
        source: "auto"
      });
      translationSummary = {
        status: translationResults.every((result) => result.status === "complete") ? "complete" : "pending",
        fields: Object.fromEntries(translationResults.map((result) => [result.fieldName, {
          status: result.status,
          missingLanguages: result.missingLanguages
        }]))
      };
      const updatedFormData = {
        ...currentFormData,
        translations: Object.fromEntries(translationResults.map((result) => [result.fieldName, result.translations])),
        translationStatus: translationSummary,
        translationOriginalLanguage: body.originalLanguage
      };
      await adminSupabase
        .from("purchase_orders")
        .update({ form_data: updatedFormData })
        .eq("id", orderId);
    } catch (transErr) {
      console.warn("Purchase-order translations remain pending because persistence failed:", transErr);
    }
    await writeAuditLog({
      action: "create",
      entityTable: "purchase_orders",
      entityId: orderId ?? null,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    revalidatePath("/dashboard/purchases", "layout");
    revalidatePath("/dashboard/reports", "layout");

    const resData = {
      purchaseOrderId: orderId as string,
      purchaseOrderNo: (inserted as any).purchase_order_no as string,
      translationStatus: translationSummary
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, resData);
    }

    return apiCreated(resData);
  } catch (error: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    return handleApiError(error);
  }
}
