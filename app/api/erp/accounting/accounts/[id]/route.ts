import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { multilingualService } from "@/lib/services/multilingual-service";
import { ledgerScopeSchema, optionalUuidSchema, scopeSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";

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
  contacts: z.array(z.object({ type: z.string(), value: z.string() })).optional()
});

type ApiSupabaseClient = Awaited<ReturnType<typeof createApiSupabaseClient>>;
type TranslationRow = {
  record_table: string;
  record_id: string;
  field_name: string;
  original_text: string;
  original_language_code: string;
  english_text: string | null;
  arabic_text: string | null;
  urdu_text: string | null;
  persian_text: string | null;
  pashto_text: string | null;
};

function resolveTranslation(row: TranslationRow | null | undefined, language: "en" | "ar" | "ur" | "fa" | "ps", fallback: string) {
  if (!row) return fallback;
  return (
    multilingualService.resolveText(
      {
        originalText: row.original_text,
        originalLanguage: row.original_language_code as "en" | "ar" | "ur" | "fa" | "ps",
        en: row.english_text ?? undefined,
        ar: row.arabic_text ?? undefined,
        ur: row.urdu_text ?? undefined,
        fa: row.persian_text ?? undefined,
        ps: row.pashto_text ?? undefined
      },
      language
    ) || fallback
  );
}
async function loadAccount(supabase: ApiSupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("enterprise_accounts")
    .select(
      "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, contacts, created_at, updated_at, deleted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
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
    const supabase = await createApiSupabaseClient();
    const account = await loadAccount(supabase, id);

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

    const { data: ledger, error: ledgerError } = await supabase
      .from("ledgers")
      .select("id, enterprise_account_id, parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, normal_balance, is_active, created_at, updated_at, deleted_at")
      .eq("enterprise_account_id", account.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);

    const { data: translations, error: translationError } = await supabase
      .from("record_translations")
      .select("record_table, record_id, field_name, original_text, original_language_code, english_text, arabic_text, urdu_text, persian_text, pashto_text")
      .eq("record_table", "enterprise_accounts")
      .eq("record_id", account.id)
      .eq("field_name", "name")
      .is("deleted_at", null)
      .maybeSingle();

    if (translationError) throw new Error(translationError.message);

    const localizedName = resolveTranslation((translations ?? null) as TranslationRow | null, language, account.name);
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
    const supabase = await createApiSupabaseClient();
    
    const actorId = isUuid(session.userId) ? session.userId : null;
    if (!actorId) {
      throw new Error("A valid logged-in user ID is required to update an account.");
    }

    // Verify the actorId exists in the profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", actorId)
      .maybeSingle();

    if (profileError || !userProfile) {
      throw new Error("The user ID does not exist in the referenced users table. Account update requires a valid user reference.");
    }

    const current = await loadAccount(supabase, id);

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

    const { data: updatedAccount, error: accountError } = await supabase
      .from("enterprise_accounts")
      .update(updatePayload)
      .eq("id", id)
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

    await supabase
      .from("ledgers")
      .update(ledgerUpdate)
      .eq("enterprise_account_id", id);

    if (body.name !== undefined) {
      const actorLanguage = (session.preferredLanguage || "en") as "en" | "ar" | "ur" | "fa" | "ps";
      supabase.from("ledgers").select("id").eq("enterprise_account_id", id).maybeSingle().then(({ data: ledger }) => {
        import("@/lib/services/enterprise-multilingual-service")
          .then(({ saveEnterpriseRecordTranslations }) => {
            const promises = [
              saveEnterpriseRecordTranslations({
                recordTable: "enterprise_accounts",
                recordId: id,
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
          .catch((err) => console.error("Failed to auto-translate updated account names:", err));
      });
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
    const supabase = await createApiSupabaseClient();

    const actorId = isUuid(session.userId) ? session.userId : null;
    if (!actorId) {
      throw new Error("A valid logged-in user ID is required to delete an account.");
    }

    // Verify the actorId exists in the profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", actorId)
      .maybeSingle();

    if (profileError || !userProfile) {
      throw new Error("The user ID does not exist in the referenced users table. Account deletion requires a valid user reference.");
    }

    const current = await loadAccount(supabase, id);

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

    const timestamp = new Date().toISOString();
    const { error: accountError } = await supabase
      .from("enterprise_accounts")
      .update({
        status: "archived",
        deleted_at: timestamp,
        updated_at: timestamp
      })
      .eq("id", id);

    if (accountError) throw new Error(accountError.message);

    const { error: ledgerError } = await supabase
      .from("ledgers")
      .update({
        is_active: false,
        deleted_at: timestamp,
        updated_at: timestamp
      })
      .eq("enterprise_account_id", id);

    if (ledgerError) throw new Error(ledgerError.message);

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}




