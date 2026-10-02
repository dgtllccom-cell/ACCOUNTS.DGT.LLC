import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession, sessionInDomain } from "@/lib/auth/session";
import { isShippingDomainOnly } from "@/lib/permissions/shipping-explicit-gate";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames, wantsRawRecord } from "@/lib/i18n/localize-records";
import { ledgerScopeSchema, optionalUuidSchema, scopeSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

const updateSchema = scopeSchema.extend({
  scope: ledgerScopeSchema.optional(),
  parentId: optionalUuidSchema,
  code: z.preprocess(
    (val) => (val === "" || val === undefined || val === null || (typeof val === "string" && val.trim().toUpperCase() === "AUTO") ? undefined : val),
    z.string().trim().min(2).max(50).optional()
  ),
  manualReferenceNumber: z.string().trim().min(1).max(120).optional().nullable(),
  name: z.string().trim().min(2).max(200).optional(),
  kind: z.enum(["asset", "liability", "equity", "income", "expense"]).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  openingBalance: z.coerce.number().finite().optional(),
  status: z.enum(["active", "archived"]).optional(),
  operationalDomain: z.enum(["business", "shipping", "both"]).optional(),
  isControlAccount: z.coerce.boolean().optional(),
  customerId: optionalUuidSchema,
  companyId: optionalUuidSchema,
  companyIds: z.array(z.string()).optional(),
  linkedCompanies: z.array(z.any()).optional(),
  bankId: optionalUuidSchema,
  bankIds: z.array(z.string()).optional(),
  linkedBanks: z.array(z.any()).optional(),
  shippingLineId: optionalUuidSchema,
  warehouseId: optionalUuidSchema,
  warehouseIds: z.array(z.string()).optional(),
  linkedCountries: z.array(z.string()).optional(),
  contacts: z.array(z.object({ type: z.string(), value: z.string() })).optional()
});

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function loadAccount(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const selectFields = "id, scope, operational_domain, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, shipping_line_id, linked_countries, linked_companies, linked_banks, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, contacts, created_at, updated_at, deleted_at";

  let data = null;
  if (isUuid(id)) {
    const res = await admin.from("enterprise_accounts").select(selectFields).eq("id", id).maybeSingle();
    if (res.data) data = res.data;
    
    // If not found, check if id is a ledger ID
    if (!data) {
      const { data: ledger } = await admin.from("ledgers").select("enterprise_account_id").eq("id", id).maybeSingle();
      if (ledger?.enterprise_account_id) {
        const accRes = await admin.from("enterprise_accounts").select(selectFields).eq("id", ledger.enterprise_account_id).maybeSingle();
        if (accRes.data) data = accRes.data;
      }
    }
  }

  // If still not found or not UUID, try matching code, account_number, or manual_reference_number
  if (!data) {
    const res = await admin.from("enterprise_accounts").select(selectFields).or(`code.eq.${id},account_number.eq.${id},manual_reference_number.eq.${id}`).maybeSingle();
    if (res.data) data = res.data;
  }

  let warehouses: any[] = [];
  let companies: any[] = [];
  let banks: any[] = [];
  let customer: any = null;
  let shippingLine: any = null;

  if (data?.id) {
    // 1. Warehouses
    try {
      const { data: whRows } = await admin
        .from("enterprise_account_warehouses")
        .select("warehouse_id, is_primary, company_id, customer_id, warehouses(id, warehouse_name, warehouse_code, country_id, full_address, status)")
        .eq("account_id", data.id);
      if (whRows) {
        warehouses = whRows.map((r: any) => ({
          warehouseId: r.warehouse_id,
          id: r.warehouse_id,
          isPrimary: r.is_primary,
          warehouseName: r.warehouses?.warehouse_name,
          name: r.warehouses?.warehouse_name,
          warehouseCode: r.warehouses?.warehouse_code,
          code: r.warehouses?.warehouse_code,
          fullAddress: r.warehouses?.full_address,
          address: r.warehouses?.full_address,
          status: r.warehouses?.status
        }));
      }
    } catch {}

    // 2. Companies
    const parseJsonArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
      return [];
    };

    // 2. Companies
    try {
      const rawLinkedCompanies = parseJsonArray(data.linked_companies);
      const companyIds = Array.from(new Set([
        ...rawLinkedCompanies.map((c: any) => c.id || c.companyId).filter(Boolean),
        ...(data.company_id ? [data.company_id] : [])
      ]));

      if (companyIds.length > 0) {
        const { data: compRows } = await admin
          .from("companies")
          .select("id, name, legal_name, company_code, country_id, countries(name)")
          .in("id", companyIds);

        const compMap = new Map((compRows || []).map((c: any) => [c.id, c]));

        companies = companyIds.map((cid, idx) => {
          const comp: any = compMap.get(cid);
          const rawItem = rawLinkedCompanies.find((r: any) => (r.id || r.companyId) === cid);
          const isPrimary = rawItem ? Boolean(rawItem.isPrimary) : (cid === data.company_id || idx === 0);
          return {
            id: cid,
            companyId: cid,
            name: comp?.name || comp?.legal_name || rawItem?.name || "Company",
            code: comp?.company_code || rawItem?.code || "",
            country: comp?.countries?.name || rawItem?.country || "",
            countryId: comp?.country_id || rawItem?.countryId || null,
            isPrimary
          };
        });
      }
    } catch (compErr) {
      console.error("Error loading linked companies:", compErr);
    }

    // 3. Banks
    try {
      const rawLinkedBanks = parseJsonArray(data.linked_banks);
      const bankIds = Array.from(new Set([
        ...rawLinkedBanks.map((b: any) => b.id || b.bankId).filter(Boolean),
        ...(data.bank_id ? [data.bank_id] : [])
      ]));

      if (bankIds.length > 0) {
        const { data: bankRows } = await admin
          .from("banks")
          .select("id, bank_name, branch_name, account_number, currency, swift_bic, iban_number")
          .in("id", bankIds);

        const bankMap = new Map((bankRows || []).map((b: any) => [b.id, b]));

        banks = bankIds.map((bid, idx) => {
          const b: any = bankMap.get(bid);
          const rawItem = rawLinkedBanks.find((r: any) => (r.id || r.bankId) === bid);
          const isPrimary = rawItem ? Boolean(rawItem.isPrimary) : (bid === data.bank_id || idx === 0);
          return {
            id: bid,
            bankId: bid,
            name: b?.bank_name || rawItem?.name || "Bank",
            branchName: b?.branch_name || rawItem?.branchName || "",
            accountNumber: b?.account_number || rawItem?.accountNumber || "",
            currency: b?.currency || rawItem?.currency || "",
            swiftBic: b?.swift_bic || rawItem?.swiftBic || "",
            ibanNumber: b?.iban_number || rawItem?.ibanNumber || "",
            isPrimary
          };
        });
      }
    } catch (bankErr) {
      console.error("Error loading linked banks:", bankErr);
    }

    // 4. Customer
    if (data.customer_id) {
      try {
        const { data: custRow } = await admin
          .from("customers")
          .select("id, customer_name, company_name, mobile, whatsapp, email, address, country_id, person_code")
          .eq("id", data.customer_id)
          .maybeSingle();
        if (custRow) {
          customer = {
            ...custRow,
            phone_number: custRow.mobile || custRow.whatsapp || "",
            mobile_number: custRow.mobile || "",
            email_address: custRow.email || "",
            customer_code: custRow.person_code || ""
          };
        }
      } catch {}
    }

    // 5. Shipping Line
    if (data.shipping_line_id) {
      try {
        const { data: shipRow } = await admin
          .from("shipping_lines")
          .select("id, name, shipping_line_code, contact_person, phone, email")
          .eq("id", data.shipping_line_id)
          .maybeSingle();
        if (shipRow) {
          shippingLine = shipRow;
        }
      } catch {}
    }
  }

  if (!data) return null;

  return { ...data, warehouses, companies, banks, customer, shippingLine } as
    | {
        id: string;
        scope: "super_admin" | "country" | "main_branch" | "city_branch";
        country_id: string | null;
        country_branch_id: string | null;
        city_branch_id: string | null;
        parent_id: string | null;
        customer_id?: string | null;
        company_id?: string | null;
        bank_id?: string | null;
        shipping_line_id?: string | null;
        linked_countries?: any;
        linked_companies?: any[];
        linked_banks?: any[];
        operational_domain?: string | null;
        code: string;
        account_number?: string | null;
        customer_number?: string | null;
        account_serial_number?: number | null;
        country_serial_number?: string | null;
        branch_serial_number?: string | null;
        manual_reference_number?: string | null;
        creation_date?: string | null;
        branch_code?: string | null;
        branch_account_sequence?: number | null;
        name: string;
        kind: "asset" | "liability" | "equity" | "income" | "expense";
        currency: string;
        opening_balance: string | number;
        current_balance: string | number;
        status: "active" | "archived";
        is_control_account: boolean;
        warehouses?: any[];
        companies?: any[];
        banks?: any[];
        customer?: any;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }
    | null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const fallbackLanguage = await getRequestLanguage();
    const language = supportedLanguageSchema.default(fallbackLanguage).parse(request.nextUrl.searchParams.get("language") ?? undefined);
    const { id } = await context.params;
    const account = await loadAccount(id);

    if (!account || account.deleted_at) {
      return apiOk({ account: null }, { status: 404 });
    }

    if (isShippingDomainOnly(session) && (account.operational_domain ?? "business") === "business") {
      return apiOk({ account: null }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      countryId: account.country_id,
      countryBranchId: account.country_branch_id,
      cityBranchId: account.city_branch_id
    });

    const admin = createSupabaseAdminClient() as any;
    const { data: ledger, error: ledgerError } = await admin
      .from("ledgers")
      .select("id, enterprise_account_id, parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, normal_balance, is_active, created_at, updated_at, deleted_at")
      .eq("enterprise_account_id", account.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);

    // Resolve the account name through the single central 3-tier resolver (record-specific
    // approved translation → central system_dictionary → honest original) — the same policy
    // every other ERP screen uses. Replaces the old resolveText path that ignored the dictionary.
    const [resolvedAccount] = wantsRawRecord(request)
      ? [{ id: account.id, name: account.name }]
      : await localizeRecordNames(
          [{ id: account.id, name: account.name }],
          "enterprise_accounts",
          "name",
          language,
          { phraseFallback: true }
        );
    const localizedName = resolvedAccount?.name ?? account.name;
    const localizedAccount = {
      ...account,
      raw_name: account.name,
      localized_name: localizedName,
      name: localizedName
    };

    return apiOk({ account: localizedAccount, ledger: ledger ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const rawBody = await request.json();
    const body = updateSchema.parse(rawBody);
    // optionalUuidSchema (used for customerId/companyId/bankId/shippingLineId/
    // warehouseId) preprocesses an ABSENT field to null, the same as an
    // explicitly-cleared one — so `body.field !== undefined` can't tell "the
    // caller omitted this field, leave it alone" from "the caller wants it
    // cleared". A partial PATCH that only sends e.g. manualReferenceNumber
    // must not silently wipe the account's customer/company/bank/warehouse
    // links. Gate those specific merges on presence in the raw JSON body
    // instead; the zod-validated `body.*` value is still what gets written.
    const rawHas = (key: string) => Object.prototype.hasOwnProperty.call(rawBody ?? {}, key);
    const admin = createSupabaseAdminClient() as any;
    
    let actorId = isUuid(session.userId) ? session.userId : null;
    if (actorId) {
      const { data: userProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", actorId)
        .maybeSingle();
      if (!userProfile) actorId = null;
    }
    if (!actorId) {
      const { data: fallbackProfile } = await admin
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle();
      actorId = fallbackProfile?.id ?? null;
    }

    const current = await loadAccount(id);

    if (!current || current.deleted_at) {
      return apiOk({ account: null }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "accounts",
      action: "update",
      countryId: body.countryId ?? current.country_id,
      countryBranchId: body.countryBranchId ?? current.country_branch_id,
      cityBranchId: body.cityBranchId ?? current.city_branch_id
    });

    const targetId = current.id;
    const nextScope = body.scope ?? current.scope;
    const nextCountryId = body.countryId ?? current.country_id;
    const nextCountryBranchId = body.countryBranchId ?? current.country_branch_id;
    const nextCityBranchId = body.cityBranchId ?? current.city_branch_id;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (body.scope) updatePayload.scope = body.scope;
    if (rawHas("parentId")) updatePayload.parent_id = body.parentId;
    if (body.code !== undefined) updatePayload.code = body.code;
    if (body.manualReferenceNumber !== undefined) updatePayload.manual_reference_number = body.manualReferenceNumber?.trim() || null;
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.kind !== undefined) updatePayload.kind = body.kind;
    if (body.currency !== undefined) updatePayload.currency = body.currency;
    if (body.openingBalance !== undefined) {
      updatePayload.opening_balance = body.openingBalance;
      updatePayload.current_balance = body.openingBalance;
    }
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.operationalDomain !== undefined && body.operationalDomain !== (current.operational_domain ?? "business")) {
      const from = current.operational_domain ?? "business";
      const to = body.operationalDomain;
      const isUpgradeToBoth = to === "both" && from !== "both";
      if (!isUpgradeToBoth && !session.isSuperAdmin) {
        throw new ApiClientError("Only a Super Admin can narrow or switch an account's operational domain.", { status: 403, code: "DOMAIN_FORBIDDEN" });
      }
      if (to === "both" ? !(sessionInDomain(session, "business") && sessionInDomain(session, "shipping")) : !sessionInDomain(session, to as any)) {
        throw new ApiClientError("You do not have access to that operational domain.", { status: 403, code: "DOMAIN_FORBIDDEN" });
      }
      updatePayload.operational_domain = to;
    }
    if (body.isControlAccount !== undefined) updatePayload.is_control_account = body.isControlAccount;
    if (rawHas("customerId")) updatePayload.customer_id = body.customerId;
    if (rawHas("companyId")) updatePayload.company_id = body.companyId;
    if (rawHas("bankId")) updatePayload.bank_id = body.bankId;
    if (rawHas("shippingLineId")) updatePayload.shipping_line_id = body.shippingLineId;
    if (body.linkedCountries !== undefined) updatePayload.linked_countries = body.linkedCountries;
    if (rawHas("linkedCompanies")) {
      const dedupedComps = (body.linkedCompanies || []).filter((item: any, idx: number, arr: any[]) => {
        const id = item?.id ? String(item.id).trim() : null;
        return id ? arr.findIndex((x: any) => String(x?.id).trim() === id) === idx : true;
      });
      updatePayload.linked_companies = dedupedComps;
      if (!rawHas("companyId")) {
        const primaryComp = dedupedComps.find((c: any) => c.isPrimary) || dedupedComps[0];
        if (primaryComp?.id) {
          updatePayload.company_id = primaryComp.id;
        }
      }
    }
    if (rawHas("linkedBanks")) {
      const dedupedBnks = (body.linkedBanks || []).filter((item: any, idx: number, arr: any[]) => {
        const id = item?.id ? String(item.id).trim() : null;
        return id ? arr.findIndex((x: any) => String(x?.id).trim() === id) === idx : true;
      });
      updatePayload.linked_banks = dedupedBnks;
      if (!rawHas("bankId")) {
        const primaryBank = dedupedBnks.find((b: any) => b.isPrimary) || dedupedBnks[0];
        if (primaryBank?.id) {
          updatePayload.bank_id = primaryBank.id;
        }
      }
    }
    if (body.contacts !== undefined) updatePayload.contacts = body.contacts;
    if (nextScope === "super_admin") {
      updatePayload.country_id = null;
      updatePayload.country_branch_id = null;
      updatePayload.city_branch_id = null;
    } else if (nextScope === "country") {
      updatePayload.country_id = nextCountryId;
      updatePayload.country_branch_id = null;
      updatePayload.city_branch_id = null;
    } else if (nextScope === "main_branch") {
      updatePayload.country_id = nextCountryId;
      updatePayload.country_branch_id = nextCountryBranchId;
      updatePayload.city_branch_id = null;
    } else {
      updatePayload.country_id = nextCountryId;
      updatePayload.country_branch_id = nextCountryBranchId;
      updatePayload.city_branch_id = nextCityBranchId;
    }

    const { data: updatedAccount, error: accountError } = await admin
      .from("enterprise_accounts")
      .update(updatePayload)
      .eq("id", targetId)
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, shipping_line_id, linked_countries, linked_companies, linked_banks, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, created_at, updated_at, deleted_at"
      )
      .single();

    if (accountError) throw new Error(accountError.message);

    const ledgerUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.code !== undefined) ledgerUpdate.code = body.code;
    if (body.name !== undefined) ledgerUpdate.name = body.name;
    if (body.currency !== undefined) ledgerUpdate.currency = body.currency;
    if (body.openingBalance !== undefined) ledgerUpdate.opening_balance = body.openingBalance;
    if (body.status !== undefined) ledgerUpdate.is_active = body.status === "active";

    await admin
      .from("ledgers")
      .update(ledgerUpdate)
      .eq("enterprise_account_id", targetId);

    if (body.name !== undefined && actorId) {
      const actorLanguage = (session.preferredLanguage || "en") as "en" | "ar" | "ur" | "fa" | "ps";
      admin.from("ledgers").select("id").eq("enterprise_account_id", targetId).maybeSingle().then(({ data: ledger }: { data: { id?: string } | null }) => {
        import("@/lib/services/enterprise-multilingual-service")
          .then(({ saveEnterpriseRecordTranslations }) => {
            const promises = [
              saveEnterpriseRecordTranslations({
                recordTable: "enterprise_accounts",
                recordId: targetId,
                originalLanguage: actorLanguage,
                fields: [{ fieldName: "name", value: body.name }],
                actorId,
                source: "auto"
              })
            ];
            if (ledger?.id) {
              promises.push(
                saveEnterpriseRecordTranslations({
                  recordTable: "ledgers",
                  recordId: ledger.id,
                  originalLanguage: actorLanguage,
                  fields: [{ fieldName: "name", value: body.name }],
                  actorId,
                  source: "auto"
                })
              );
            }
            return Promise.all(promises);
          })
          .catch((err: any) => console.error("Failed to register updated account name translations:", err));
      });
    }

    if (rawHas("warehouseIds") || rawHas("warehouseId")) {
      const warehousesToUpdate = Array.from(
        new Set([
          ...(body.warehouseIds || []),
          ...(body.warehouseId ? [body.warehouseId] : [])
        ].filter(Boolean))
      );

      try {
        await admin.from("enterprise_account_warehouses").delete().eq("account_id", targetId);
        let validCcpId: string | null = null;
        const candidateCompanyId = (updatedAccount as any)?.company_id || current.company_id || null;
        if (candidateCompanyId) {
          const { data: ccp } = await admin.from("country_company_profiles").select("id").eq("id", candidateCompanyId).maybeSingle();
          if (ccp) validCcpId = ccp.id;
        }

        for (let i = 0; i < warehousesToUpdate.length; i++) {
          const whId = warehousesToUpdate[i];
          await admin.from("enterprise_account_warehouses").insert({
            account_id: targetId,
            warehouse_id: whId,
            company_id: validCcpId,
            customer_id: (updatedAccount as any)?.customer_id || current.customer_id || null,
            is_primary: i === 0
          });
          await admin.from("warehouses").update({
            account_id: targetId,
            company_id: validCcpId
          }).eq("id", whId);
        }
      } catch (whErr) {
        console.error("Failed to update enterprise_account_warehouses on PATCH:", whErr);
      }
    }

    if (actorId) {
      void writeRecordChangeHistory({
        recordTable: "enterprise_accounts",
        recordId: targetId,
        action: "update",
        actorId,
        countryId: (updatedAccount as any)?.country_id ?? current.country_id ?? null,
        cityBranchId: (updatedAccount as any)?.city_branch_id ?? current.city_branch_id ?? null,
        beforeData: current,
        afterData: updatedAccount
      }).catch(() => {});
    }

    return apiOk({ account: updatedAccount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient() as any;

    let actorId = isUuid(session.userId) ? session.userId : null;
    if (actorId) {
      const { data: userProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", actorId)
        .maybeSingle();
      if (!userProfile) actorId = null;
    }
    if (!actorId) {
      const { data: fallbackProfile } = await admin
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle();
      actorId = fallbackProfile?.id ?? null;
    }

    const current = await loadAccount(id);

    if (!current || current.deleted_at) {
      return apiOk({ deleted: false }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "accounts",
      action: "delete",
      countryId: current.country_id,
      countryBranchId: current.country_branch_id,
      cityBranchId: current.city_branch_id
    });

    const targetId = current.id;
    const timestamp = new Date().toISOString();
    const { error: accountError } = await admin
      .from("enterprise_accounts")
      .update({
        status: "archived",
        deleted_at: timestamp,
        updated_at: timestamp
      })
      .eq("id", targetId);

    if (accountError) throw new Error(accountError.message);

    const { error: ledgerError } = await admin
      .from("ledgers")
      .update({
        is_active: false,
        deleted_at: timestamp,
        updated_at: timestamp
      })
      .eq("enterprise_account_id", targetId);

    if (ledgerError) throw new Error(ledgerError.message);

    if (actorId) {
      void writeRecordChangeHistory({
        recordTable: "enterprise_accounts",
        recordId: targetId,
        action: "delete",
        actorId,
        countryId: current.country_id ?? null,
        cityBranchId: current.city_branch_id ?? null,
        beforeData: current,
        afterData: { status: "archived", deleted_at: timestamp }
      }).catch(() => {});
    }

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}




