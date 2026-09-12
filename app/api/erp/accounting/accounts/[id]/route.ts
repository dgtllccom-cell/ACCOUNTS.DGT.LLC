import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
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
  isControlAccount: z.coerce.boolean().optional(),
  customerId: optionalUuidSchema,
  companyId: optionalUuidSchema,
  bankId: optionalUuidSchema,
  shippingLineId: optionalUuidSchema,
  linkedCountries: z.array(z.string()).optional(),
  contacts: z.array(z.object({ type: z.string(), value: z.string() })).optional()
});

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function loadAccount(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const selectFields = "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, shipping_line_id, linked_countries, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, contacts, created_at, updated_at, deleted_at";

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

  return data as
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
    const body = updateSchema.parse(await request.json());
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
    if (body.parentId !== undefined) updatePayload.parent_id = body.parentId;
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
    if (body.isControlAccount !== undefined) updatePayload.is_control_account = body.isControlAccount;
    if (body.customerId !== undefined) updatePayload.customer_id = body.customerId;
    if (body.companyId !== undefined) updatePayload.company_id = body.companyId;
    if (body.bankId !== undefined) updatePayload.bank_id = body.bankId;
    if (body.shippingLineId !== undefined) updatePayload.shipping_line_id = body.shippingLineId;
    if (body.linkedCountries !== undefined) updatePayload.linked_countries = body.linkedCountries;
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
        "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, created_at, updated_at, deleted_at"
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




