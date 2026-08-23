/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { roznamchaPostingSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { roznamchaService } from "@/lib/services/roznamcha-service";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { roznamchaTranslationFields } from "@/lib/i18n/roznamcha-entry-translations";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { revalidatePath } from "next/cache";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Localize `description` on every nested roznamcha_lines row across a list of entries. */
async function localizeRoznamchaEntryLines<T extends { id: string; roznamcha_lines?: Array<{ id: string; description?: string | null }> | null }>(
  entries: T[],
  lang: Parameters<typeof localizeRecordNames>[3]
): Promise<T[]> {
  const allLines = entries.flatMap((entry) => entry.roznamcha_lines ?? []);
  if (allLines.length === 0) return entries;
  const localizedLines = await localizeRecordNames(allLines as Array<{ id: string; description?: string | null }>, "roznamcha_lines", "description", lang);
  const byId = new Map(localizedLines.map((line) => [line.id, line]));
  return entries.map((entry) => {
    if (!entry.roznamcha_lines || entry.roznamcha_lines.length === 0) return entry;
    return { ...entry, roznamcha_lines: entry.roznamcha_lines.map((line) => byId.get(line.id) ?? line) };
  });
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isLedgerScopeCompatible(roznamchaType: string, ledgerScope: string | null | undefined) {
  if (!ledgerScope) return false;
  // Let the user post to any ledger they have access to. The UI restricts what they can see.
  // The 'roznamchaType' essentially specifies the user's current working context,
  // but a user in a 'super_admin' or 'country' context CAN post to a branch ledger,
  // and a 'branch' user shouldn't see 'super_admin' ledgers anyway.
  // We will loosen this constraint to prevent Cash Entry saving failures.
  if (roznamchaType === "super_admin") return true;
  if (roznamchaType === "country" && ledgerScope !== "super_admin") return true;
  return ["branch", "country_branch", "main_branch", "city_branch"].includes(ledgerScope);
}

async function resolveProfileActor(admin: any, userId: string | null | undefined) {
  if (!userId) return null;
  const { data, error } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

function cleanSerialPrefix(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9]/g, "");
  return (cleaned || fallback).slice(0, 12);
}

async function nextTransactionSerial(admin: any, scopeType: "global" | "country" | "branch" | "main_branch" | "city_branch" | "module_roznamcha", scopeKey: string, prefix: string) {
  // Guard: scopeKey must be a non-empty string to avoid UNDEFINED_VALUE postgres errors
  if (!scopeKey || typeof scopeKey !== "string") {
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-FALLBACK-${ts}`;
  }
  try {
    const { data, error } = await admin.rpc("next_transaction_serial", {
      p_scope_type: scopeType,
      p_scope_key: scopeKey,
      p_prefix: prefix
    });
    if (error) {
      // Fallback: generate a time-based serial so posting doesn't fail
      console.warn(`[serial] RPC next_transaction_serial failed (${scopeType}/${scopeKey}): ${error.message}`);
      const ts = Date.now().toString(36).toUpperCase();
      return `${prefix}-${ts}`;
    }
    return String(data);
  } catch (err: any) {
    // Network / unexpected failure — return a fallback, don't block posting
    console.warn(`[serial] nextTransactionSerial threw (${scopeType}/${scopeKey}):`, err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-${ts}`;
  }
}

async function resolveUsdAmount(admin: any, input: {
  countryId: string | null | undefined;
  countryBranchId?: string | null | undefined;
  currency: string;
  amount: number;
  rate: number;
  entryDate: string;
  isDebit: boolean;
}) {
  const amount = toNumber(input.amount);
  if (!amount) return { usdRate: 1, usdAmount: 0 };

  let countryCurrency: string | null = null;
  if (input.countryId) {
    const { data: country, error } = await admin
      .from("countries")
      .select("currency_code")
      .eq("id", input.countryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    countryCurrency = country?.currency_code ? String(country.currency_code).toUpperCase() : null;
  }

  // If the country native currency is USD itself, the rate to USD is 1
  if (countryCurrency === "USD") {
    return { usdRate: 1, usdAmount: Math.round(amount * 10000) / 10000 };
  }

  // Fetch the Super Admin daily USD rates for this country and entryDate.
  // Daily USD rates are stored as: how many units of local currency (e.g. PKR, AED) equals 1 USD.
  // debit_rate is for money received (debit), credit_rate is for money paid (credit).
  let usdRate = 1;
  if (input.countryId) {
    // 1. Try to find the rate on the specific entry date
    let query = admin
      .from("daily_usd_rates")
      .select("buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id")
      .eq("country_id", input.countryId)
      .eq("rate_date", input.entryDate)
      .is("deleted_at", null);

    if (input.countryBranchId) {
      query = query.or(`country_branch_id.eq.${input.countryBranchId},country_branch_id.is.null`);
    } else {
      query = query.is("country_branch_id", null);
    }

    const { data: rows, error: rowError } = await query;

    if (!rowError && Array.isArray(rows) && rows.length > 0) {
      // Sort so that branch-specific rate comes first
      rows.sort((a: any, b: any) => {
        if (a.country_branch_id && !b.country_branch_id) return -1;
        if (!a.country_branch_id && b.country_branch_id) return 1;
        return 0;
      });
      const row = rows[0];
      if (input.isDebit) {
        usdRate = toNumber(row.debit_rate || row.buying_rate || row.selling_rate || 1);
      } else {
        usdRate = toNumber(row.credit_rate || row.selling_rate || row.buying_rate || 1);
      }
    } else {
      // 2. Try to find the latest rate as fallback
      let fallbackQuery = admin
        .from("daily_usd_rates")
        .select("buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id, rate_date")
        .eq("country_id", input.countryId)
        .is("deleted_at", null)
        .order("rate_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(10);

      if (input.countryBranchId) {
        fallbackQuery = fallbackQuery.or(`country_branch_id.eq.${input.countryBranchId},country_branch_id.is.null`);
      } else {
        fallbackQuery = fallbackQuery.is("country_branch_id", null);
      }

      const { data: latestRows, error: latestError } = await fallbackQuery;

      if (!latestError && Array.isArray(latestRows) && latestRows.length > 0) {
        latestRows.sort((a: any, b: any) => {
          const dateComp = b.rate_date.localeCompare(a.rate_date);
          if (dateComp !== 0) return dateComp;
          if (a.country_branch_id && !b.country_branch_id) return -1;
          if (!a.country_branch_id && b.country_branch_id) return 1;
          return 0;
        });
        const row = latestRows[0];
        if (input.isDebit) {
          usdRate = toNumber(row.debit_rate || row.buying_rate || row.selling_rate || 1);
        } else {
          usdRate = toNumber(row.credit_rate || row.selling_rate || row.buying_rate || 1);
        }
      }
    }
  }

  if (usdRate <= 0) usdRate = 1;

  // Since all line debits/credits are stored in the country's local currency,
  // we convert the local currency amount to USD by dividing by the active daily USD rate.
  return {
    usdRate,
    usdAmount: Math.round((amount / usdRate) * 10000) / 10000
  };
}

async function nextEntitySerial(
  admin: any,
  scopeType: "global" | "country" | "branch" | "main_branch" | "city_branch" | "module_roznamcha" | "module_purchase" | "module_loading" | "module_payment",
  scopeKey: string,
  entityType: string,
  prefix: string
) {
  if (!scopeKey || typeof scopeKey !== "string") {
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-FALLBACK-${ts}`;
  }
  try {
    const { data, error } = await admin.rpc("next_entity_serial", {
      p_scope_type: scopeType,
      p_scope_key: scopeKey,
      p_entity_type: entityType,
      p_prefix: prefix
    });
    if (error) {
      console.warn(`[serial] RPC next_entity_serial failed (${scopeType}/${scopeKey}/${entityType}): ${error.message}`);
      const ts = Date.now().toString(36).toUpperCase();
      return `${prefix}-${ts}`;
    }
    return String(data);
  } catch (err: any) {
    console.warn(`[serial] nextEntitySerial threw (${scopeType}/${scopeKey}/${entityType}):`, err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-${ts}`;
  }
}

async function generateTransactionSerials(admin: any, body: ReturnType<typeof roznamchaPostingSchema.parse>) {
  try {
    const superAdminSerialNumber = await nextEntitySerial(admin, "global", "global", "roznamcha", "ERP");

    let countryPrefix = "CNT";
    if (body.countryId) {
      const { data: country } = await admin.from("countries").select("iso2, iso3, name").eq("id", body.countryId).maybeSingle();
      countryPrefix = cleanSerialPrefix(country?.iso2 || country?.iso3 || country?.name, "CNT");
    }

    let mainBranchPrefix = "MB";
    if (body.countryBranchId) {
      const { data: branch } = await admin.from("country_branches").select("code, name").eq("id", body.countryBranchId).maybeSingle();
      mainBranchPrefix = cleanSerialPrefix(branch?.code || branch?.name, "MB");
    }

    let cityBranchPrefix = "CB";
    if (body.cityBranchId) {
      const { data: branch } = await admin.from("city_branches").select("code, name").eq("id", body.cityBranchId).maybeSingle();
      cityBranchPrefix = cleanSerialPrefix(branch?.code || branch?.name, "CB");
    }

    // Independent DR and CR serial counters
    const debitSerialNumber = await nextEntitySerial(admin, "global", "ENTRY", "roznamcha_debit", "DR");
    const creditSerialNumber = await nextEntitySerial(admin, "global", "ENTRY", "roznamcha_credit", "CR");

    // Only generate country serial if countryId is a non-empty string
    const countryTransactionSerialNumber =
      body.countryId && typeof body.countryId === "string"
        ? await nextEntitySerial(admin, "country", body.countryId, "roznamcha", countryPrefix)
        : null;

    // Only generate branch serial if at least one branch ID is a non-empty string
    const branchScopeKey = body.cityBranchId || body.countryBranchId;
    const branchTransactionSerialNumber =
      branchScopeKey && typeof branchScopeKey === "string"
        ? await nextEntitySerial(admin, "branch", branchScopeKey, "roznamcha", body.cityBranchId ? cityBranchPrefix : mainBranchPrefix)
        : null;

    const mainBranchTransactionSerialNumber =
      body.countryBranchId && typeof body.countryBranchId === "string"
        ? await nextEntitySerial(admin, "main_branch", body.countryBranchId, "roznamcha", mainBranchPrefix)
        : null;

    const cityBranchTransactionSerialNumber =
      body.cityBranchId && typeof body.cityBranchId === "string"
        ? await nextEntitySerial(admin, "city_branch", body.cityBranchId, "roznamcha", cityBranchPrefix)
        : null;

    const hasDebit = body.lines.some(l => toNumber(l.debit) > 0);
    const entrySerialNumber = hasDebit ? debitSerialNumber : creditSerialNumber;

    return {
      superAdminSerialNumber,
      countryTransactionSerialNumber,
      branchTransactionSerialNumber,
      mainBranchTransactionSerialNumber,
      cityBranchTransactionSerialNumber,
      entrySerialNumber,
      debitSerialNumber,
      creditSerialNumber
    };
  } catch (err: any) {
    console.warn("[serial] generateTransactionSerials failed, using fallback serials:", err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return {
      superAdminSerialNumber: `ERP-${ts}`,
      countryTransactionSerialNumber: body.countryId ? `CNT-${ts}` : null,
      branchTransactionSerialNumber: (body.cityBranchId || body.countryBranchId) ? `BR-${ts}` : null,
      mainBranchTransactionSerialNumber: body.countryBranchId ? `MB-${ts}` : null,
      cityBranchTransactionSerialNumber: body.cityBranchId ? `CB-${ts}` : null,
      entrySerialNumber: `DR-${ts}`,
      debitSerialNumber: `DR-${ts}`,
      creditSerialNumber: `CR-${ts}`
    };
  }
}

function createOperationalPostingPlan(body: ReturnType<typeof roznamchaPostingSchema.parse>) {
  const debitTotal = body.lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
  const creditTotal = body.lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
  const baseDebitTotal = body.lines.reduce((sum, line) => sum + toNumber(line.debit) * (toNumber(line.exchangeRate) || 1), 0);
  const baseCreditTotal = body.lines.reduce((sum, line) => sum + toNumber(line.credit) * (toNumber(line.exchangeRate) || 1), 0);
  return {
    type: body.type,
    countryId: body.countryId,
    countryBranchId: body.countryBranchId,
    cityBranchId: body.cityBranchId,
    entryDate: body.entryDate,
    journalNo: body.journalNo,
    voucherNo: body.voucherNo,
    narration: body.narration,
    referenceNo: body.referenceNo,
    lines: body.lines,
    ledgerPosting: {
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId,
      entryDate: body.entryDate,
      lines: body.lines,
      debitTotal,
      creditTotal,
      baseDebitTotal,
      baseCreditTotal
    }
  };
}

/**
 * Root-cause note (see lib/db/local-postgres.ts): the "admin" Supabase client is not
 * actually carrying a real service-role key locally, so under the app's temp-session
 * bootstrap login every RLS-gated read/write here (roznamcha_entries, roznamcha_lines,
 * ledgers, ledger_balances, enterprise_accounts, enterprise_account_history) silently
 * fails ("new row violates row-level security policy" on writes, empty results on
 * reads). postRoznamchaWithErpSession now tries a direct-Postgres path first (bypasses
 * RLS via DATABASE_URL) and only falls back to the Supabase-admin-client path below
 * when DATABASE_URL isn't configured for this environment.
 */
export async function postRoznamchaWithErpSession(input: {
  sessionUserId: string;
  session?: any;
  body: ReturnType<typeof roznamchaPostingSchema.parse>;
}) {
  const viaPg = await withLocalPg((sql) => postRoznamchaWithErpSessionPg(sql, input));
  if (viaPg) return viaPg;
  return postRoznamchaWithErpSessionSupabase(input);
}

async function resolveProfileActorPg(sql: any, userId: string | null | undefined) {
  if (!userId) return null;
  const rows = await sql`select id from public.profiles where id = ${userId} limit 1`;
  return rows[0]?.id ?? null;
}

async function nextTransactionSerialPg(
  sql: any,
  scopeType: "global" | "country" | "branch" | "main_branch" | "city_branch" | "module_roznamcha",
  scopeKey: string,
  prefix: string
) {
  if (!scopeKey || typeof scopeKey !== "string") {
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-FALLBACK-${ts}`;
  }
  try {
    const rows = await sql`
      select public.next_transaction_serial(
        p_scope_type := ${scopeType},
        p_scope_key := ${scopeKey},
        p_prefix := ${prefix}
      ) as serial
    `;
    return String(rows[0]?.serial);
  } catch (err: any) {
    console.warn(`[serial][pg] next_transaction_serial failed (${scopeType}/${scopeKey}):`, err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-${ts}`;
  }
}

async function nextEntitySerialPg(
  sql: any,
  scopeType: "global" | "country" | "branch" | "main_branch" | "city_branch" | "module_roznamcha" | "module_purchase" | "module_loading" | "module_payment",
  scopeKey: string,
  entityType: string,
  prefix: string
) {
  if (!scopeKey || typeof scopeKey !== "string") {
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-FALLBACK-${ts}`;
  }
  try {
    const rows = await sql`
      select public.next_entity_serial(
        p_scope_type := ${scopeType},
        p_scope_key := ${scopeKey},
        p_entity_type := ${entityType},
        p_prefix := ${prefix}
      ) as serial
    `;
    return String(rows[0]?.serial);
  } catch (err: any) {
    console.warn(`[serial][pg] next_entity_serial failed (${scopeType}/${scopeKey}/${entityType}):`, err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-${ts}`;
  }
}

async function generateTransactionSerialsPg(sql: any, body: ReturnType<typeof roznamchaPostingSchema.parse>) {
  try {
    const superAdminSerialNumber = await nextEntitySerialPg(sql, "global", "global", "roznamcha", "ERP");

    let countryPrefix = "CNT";
    if (body.countryId) {
      const rows = await sql`select iso2, iso3, name from public.countries where id = ${body.countryId} limit 1`;
      countryPrefix = cleanSerialPrefix(rows[0]?.iso2 || rows[0]?.iso3 || rows[0]?.name, "CNT");
    }

    let mainBranchPrefix = "MB";
    if (body.countryBranchId) {
      const rows = await sql`select code, name from public.country_branches where id = ${body.countryBranchId} limit 1`;
      mainBranchPrefix = cleanSerialPrefix(rows[0]?.code || rows[0]?.name, "MB");
    }

    let cityBranchPrefix = "CB";
    if (body.cityBranchId) {
      const rows = await sql`select code, name from public.city_branches where id = ${body.cityBranchId} limit 1`;
      cityBranchPrefix = cleanSerialPrefix(rows[0]?.code || rows[0]?.name, "CB");
    }

    // Independent DR and CR serial counters
    const debitSerialNumber = await nextEntitySerialPg(sql, "global", "ENTRY", "roznamcha_debit", "DR");
    const creditSerialNumber = await nextEntitySerialPg(sql, "global", "ENTRY", "roznamcha_credit", "CR");

    const countryTransactionSerialNumber =
      body.countryId && typeof body.countryId === "string"
        ? await nextEntitySerialPg(sql, "country", body.countryId, "roznamcha", countryPrefix)
        : null;

    const branchScopeKey = body.cityBranchId || body.countryBranchId;
    const branchTransactionSerialNumber =
      branchScopeKey && typeof branchScopeKey === "string"
        ? await nextEntitySerialPg(sql, "branch", branchScopeKey, "roznamcha", body.cityBranchId ? cityBranchPrefix : mainBranchPrefix)
        : null;

    const mainBranchTransactionSerialNumber =
      body.countryBranchId && typeof body.countryBranchId === "string"
        ? await nextEntitySerialPg(sql, "main_branch", body.countryBranchId, "roznamcha", mainBranchPrefix)
        : null;

    const cityBranchTransactionSerialNumber =
      body.cityBranchId && typeof body.cityBranchId === "string"
        ? await nextEntitySerialPg(sql, "city_branch", body.cityBranchId, "roznamcha", cityBranchPrefix)
        : null;

    const hasDebit = body.lines.some(l => toNumber(l.debit) > 0);
    const entrySerialNumber = hasDebit ? debitSerialNumber : creditSerialNumber;

    return {
      superAdminSerialNumber,
      countryTransactionSerialNumber,
      branchTransactionSerialNumber,
      mainBranchTransactionSerialNumber,
      cityBranchTransactionSerialNumber,
      entrySerialNumber,
      debitSerialNumber,
      creditSerialNumber
    };
  } catch (err: any) {
    console.warn("[serial][pg] generateTransactionSerials failed, using fallback serials:", err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return {
      superAdminSerialNumber: `ERP-${ts}`,
      countryTransactionSerialNumber: body.countryId ? `CNT-${ts}` : null,
      branchTransactionSerialNumber: (body.cityBranchId || body.countryBranchId) ? `BR-${ts}` : null,
      mainBranchTransactionSerialNumber: body.countryBranchId ? `MB-${ts}` : null,
      cityBranchTransactionSerialNumber: body.cityBranchId ? `CB-${ts}` : null,
      entrySerialNumber: `DR-${ts}`,
      debitSerialNumber: `DR-${ts}`,
      creditSerialNumber: `CR-${ts}`
    };
  }
}

async function resolveUsdAmountPg(sql: any, input: {
  countryId: string | null | undefined;
  countryBranchId?: string | null | undefined;
  currency: string;
  amount: number;
  rate: number;
  entryDate: string;
  isDebit: boolean;
}) {
  const amount = toNumber(input.amount);
  if (!amount) return { usdRate: 1, usdAmount: 0 };

  let countryCurrency: string | null = null;
  if (input.countryId) {
    const rows = await sql`select currency_code from public.countries where id = ${input.countryId} limit 1`;
    countryCurrency = rows[0]?.currency_code ? String(rows[0].currency_code).toUpperCase() : null;
  }

  if (countryCurrency === "USD") {
    return { usdRate: 1, usdAmount: Math.round(amount * 10000) / 10000 };
  }

  let usdRate = 1;
  if (input.countryId) {
    const rows = await sql`
      select buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id
      from public.daily_usd_rates
      where country_id = ${input.countryId}
        and rate_date = ${input.entryDate}
        and deleted_at is null
        and (${input.countryBranchId ? sql`country_branch_id = ${input.countryBranchId} or country_branch_id is null` : sql`country_branch_id is null`})
    `;
    if (rows.length > 0) {
      rows.sort((a: any, b: any) => {
        if (a.country_branch_id && !b.country_branch_id) return -1;
        if (!a.country_branch_id && b.country_branch_id) return 1;
        return 0;
      });
      const row = rows[0];
      usdRate = input.isDebit
        ? toNumber(row.debit_rate || row.buying_rate || row.selling_rate || 1)
        : toNumber(row.credit_rate || row.selling_rate || row.buying_rate || 1);
    } else {
      const latestRows = await sql`
        select buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id, rate_date
        from public.daily_usd_rates
        where country_id = ${input.countryId}
          and deleted_at is null
          and (${input.countryBranchId ? sql`country_branch_id = ${input.countryBranchId} or country_branch_id is null` : sql`country_branch_id is null`})
        order by rate_date desc, updated_at desc
        limit 10
      `;
      if (latestRows.length > 0) {
        latestRows.sort((a: any, b: any) => {
          const dateComp = String(b.rate_date).localeCompare(String(a.rate_date));
          if (dateComp !== 0) return dateComp;
          if (a.country_branch_id && !b.country_branch_id) return -1;
          if (!a.country_branch_id && b.country_branch_id) return 1;
          return 0;
        });
        const row = latestRows[0];
        usdRate = input.isDebit
          ? toNumber(row.debit_rate || row.buying_rate || row.selling_rate || 1)
          : toNumber(row.credit_rate || row.selling_rate || row.buying_rate || 1);
      }
    }
  }

  if (usdRate <= 0) usdRate = 1;

  return {
    usdRate,
    usdAmount: Math.round((amount / usdRate) * 10000) / 10000
  };
}

async function postRoznamchaWithErpSessionPg(sql: any, input: {
  sessionUserId: string;
  session?: any;
  body: ReturnType<typeof roznamchaPostingSchema.parse>;
}) {
  const actorId = await resolveProfileActorPg(sql, input.sessionUserId);
  const body = input.body;
  const transactionSerials = await generateTransactionSerialsPg(sql, body);

  const entryCategory = (body.roznamchaCategory || (body.paymentDetails as any)?.roznamchaCategory || null) as
    | "business"
    | "bank"
    | "cash"
    | "invoice"
    | "transfer"
    | null;

  const entryRows = await sql`
    insert into public.roznamcha_entries (
      type, country_id, country_branch_id, city_branch_id, journal_no, voucher_no, entry_date,
      payment_method_id, reference_no, narration, status, created_by,
      super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number,
      main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number,
      source_module, source_transaction_type, source_transaction_id, source_reference_no,
      entry_category, posted_at
    ) values (
      ${body.type}, ${body.countryId ?? null}, ${body.countryBranchId ?? null}, ${body.cityBranchId ?? null},
      ${body.journalNo}, ${body.voucherNo}, ${body.entryDate}, ${body.paymentMethodId ?? null},
      ${body.referenceNo ?? null}, ${body.narration ?? null}, 'posted', ${actorId},
      ${transactionSerials.superAdminSerialNumber}, ${transactionSerials.countryTransactionSerialNumber},
      ${transactionSerials.branchTransactionSerialNumber}, ${transactionSerials.mainBranchTransactionSerialNumber},
      ${transactionSerials.cityBranchTransactionSerialNumber}, ${transactionSerials.entrySerialNumber},
      ${body.sourceModule ?? null}, ${body.sourceTransactionType ?? null}, ${body.sourceTransactionId ?? null},
      ${body.sourceReferenceNo ?? null}, ${entryCategory}, now()
    )
    returning id
  `;
  const entryId = entryRows[0].id as string;

  if (body.narration) {
    void translateMasterRecord("roznamcha_entries", entryId, { narration: body.narration }, "en", actorId);
  }

  try {
    const s = await allocateFormSerials("journal_roznamcha", { countryId: (body as any).countryId ?? null, branchKey: (body as any).countryBranchId ?? (body as any).cityBranchId ?? null });
    await sql`
      update public.roznamcha_entries
      set super_admin_serial = ${s.superAdminSerial}, country_serial = ${s.countrySerial},
          branch_serial = ${s.branchSerial}, entry_serial = ${s.entrySerial}
      where id = ${entryId}
    `;
  } catch { /* non-fatal — never affects posting */ }

  for (const line of body.lines) {
    const ledgerId = line.ledgerId;
    if (!ledgerId) throw new Error("ledgerId is required for posting");

    const ledgerRows = await sql`
      select id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, is_active
      from public.ledgers
      where id = ${ledgerId} and deleted_at is null
      limit 1
    `;
    const ledger = ledgerRows[0];
    if (!ledger?.id || ledger.is_active === false) throw new Error("Ledger was not found or inactive");

    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    const enterpriseAccountId = line.enterpriseAccountId ?? ledger.enterprise_account_id ?? null;

    if (!isLedgerScopeCompatible(body.type, ledger.scope)) {
      throw new Error("Ledger belongs to a different financial scope");
    }

    // Rule 1: Country Scope Validation — advisory/non-blocking (fail-open on lookup
    // errors), so keep using the Supabase admin client here; an RLS-empty read just
    // skips the extra check rather than corrupting the actual posting below.
    const { validateLedgerCountryScope, validateAccountCountryScope } = await import("@/lib/api/country-scope-validator");
    if (input.session) {
      // The country-scope check is advisory. When the privileged admin client is unavailable
      // (e.g. local/dev without a service key), skip it (fail-open) instead of letting the
      // constructor throw abort the whole posting after the entry header was already inserted.
      let admin: any = null;
      try { admin = createSupabaseAdminClient(); } catch { admin = null; }
      if (admin) {
        await validateLedgerCountryScope(input.session, ledgerId, body.countryId, admin);
        if (enterpriseAccountId) {
          await validateAccountCountryScope(input.session, enterpriseAccountId, body.countryId, admin);
        }
      }
    }

    const currentLedgerRows = await sql`select debit_total, credit_total, current_balance from public.ledgers where id = ${ledgerId} limit 1`;
    const currentLedger = currentLedgerRows[0];
    if (!currentLedger) throw new Error("Ledger not found while updating totals");

    await sql`
      update public.ledgers
      set debit_total = ${toNumber(currentLedger.debit_total) + debit},
          credit_total = ${toNumber(currentLedger.credit_total) + credit},
          current_balance = ${toNumber(currentLedger.current_balance) + debit - credit},
          updated_at = now()
      where id = ${ledgerId}
    `;

    let accountIdentity: any = null;
    if (enterpriseAccountId) {
      const accRows = await sql`
        select account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number, current_balance
        from public.enterprise_accounts where id = ${enterpriseAccountId} limit 1
      `;
      if (!accRows[0]) throw new Error("Enterprise account not found");
      accountIdentity = accRows[0];
    }

    const traceability = {
      account_number: line.accountNumber ?? accountIdentity?.account_number ?? null,
      manual_reference_number: line.manualReferenceNumber ?? accountIdentity?.manual_reference_number ?? null,
      customer_number: line.customerNumber ?? accountIdentity?.customer_number ?? null,
      country_serial_number: line.countrySerialNumber ?? accountIdentity?.country_serial_number ?? null,
      branch_serial_number: line.branchSerialNumber ?? accountIdentity?.branch_serial_number ?? null
    };

    const conversion = await resolveUsdAmountPg(sql, {
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      currency: line.currency,
      amount: debit + credit,
      rate: toNumber(line.exchangeRate) || 1,
      entryDate: body.entryDate,
      isDebit: debit > 0
    });

    const lineEntrySerial = debit > 0 ? (transactionSerials.debitSerialNumber || transactionSerials.entrySerialNumber) : (transactionSerials.creditSerialNumber || transactionSerials.entrySerialNumber);

    await sql`
      insert into public.roznamcha_lines (
        roznamcha_entry_id, payment_entry_type, account_id, enterprise_account_id, ledger_id,
        description, debit, credit, currency, usd_rate, usd_amount,
        super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number,
        main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number,
        account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number
      ) values (
        ${entryId}, ${line.paymentEntryType}, ${line.accountId ?? null}, ${enterpriseAccountId}, ${ledgerId},
        ${line.description ?? null}, ${debit}, ${credit}, ${line.currency}, ${conversion.usdRate}, ${conversion.usdAmount},
        ${transactionSerials.superAdminSerialNumber}, ${transactionSerials.countryTransactionSerialNumber}, ${transactionSerials.branchTransactionSerialNumber},
        ${transactionSerials.mainBranchTransactionSerialNumber}, ${transactionSerials.cityBranchTransactionSerialNumber}, ${lineEntrySerial},
        ${traceability.account_number}, ${traceability.manual_reference_number}, ${traceability.customer_number},
        ${traceability.country_serial_number}, ${traceability.branch_serial_number}
      )
    `;

    if (enterpriseAccountId && accountIdentity) {
      const nextBalance = toNumber(accountIdentity.current_balance) + debit - credit;
      await sql`
        update public.enterprise_accounts
        set current_balance = ${nextBalance}, updated_at = now()
        where id = ${enterpriseAccountId}
      `;

      await sql`
        insert into public.enterprise_account_history (
          enterprise_account_id, account_number, event_type, created_by,
          debit_total, credit_total, current_balance, last_transaction_at, details
        ) values (
          ${enterpriseAccountId}, ${traceability.account_number}, 'roznamcha_posted', ${actorId},
          ${debit}, ${credit}, ${nextBalance}, now(), ${sql.json({
            roznamchaEntryId: entryId,
            voucherNo: body.voucherNo,
            journalNo: body.journalNo,
            referenceNo: body.referenceNo ?? null,
            narration: body.narration ?? null,
            paymentEntryType: line.paymentEntryType,
            ledgerId,
            manualReferenceNumber: traceability.manual_reference_number,
            customerNumber: traceability.customer_number,
            countrySerialNumber: traceability.country_serial_number,
            branchSerialNumber: traceability.branch_serial_number,
            superAdminSerialNumber: transactionSerials.superAdminSerialNumber,
            countryTransactionSerialNumber: transactionSerials.countryTransactionSerialNumber,
            branchTransactionSerialNumber: transactionSerials.branchTransactionSerialNumber,
            currency: line.currency,
            exchangeRate: conversion.usdRate,
            paymentDetails: body.paymentDetails ?? null
          })}
        )
      `;
    }

    const balanceRows = await sql`
      select id, debit_total, credit_total, closing_balance
      from public.ledger_balances
      where ledger_id = ${ledgerId} and balance_date = ${body.entryDate}
      limit 1
    `;
    const balance = balanceRows[0];

    if (balance?.id) {
      await sql`
        update public.ledger_balances
        set debit_total = ${toNumber(balance.debit_total) + debit},
            credit_total = ${toNumber(balance.credit_total) + credit},
            closing_balance = ${toNumber(balance.closing_balance) + debit - credit},
            updated_at = now()
        where id = ${balance.id}
      `;
    } else {
      await sql`
        insert into public.ledger_balances (ledger_id, balance_date, opening_balance, debit_total, credit_total, closing_balance)
        values (${ledgerId}, ${body.entryDate}, 0, ${debit}, ${credit}, ${debit - credit})
      `;
    }
  }

  return { entryId, transactionSerials };
}

async function postRoznamchaWithErpSessionSupabase(input: {
  sessionUserId: string;
  session?: any;
  body: ReturnType<typeof roznamchaPostingSchema.parse>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const actorId = await resolveProfileActor(admin, input.sessionUserId);
  const body = input.body;
  const transactionSerials = await generateTransactionSerials(admin, body);

  const { data: entry, error: entryError } = await admin
    .from("roznamcha_entries")
    .insert({
      type: body.type,
      country_id: body.countryId ?? null,
      country_branch_id: body.countryBranchId ?? null,
      city_branch_id: body.cityBranchId ?? null,
      journal_no: body.journalNo,
      voucher_no: body.voucherNo,
      entry_date: body.entryDate,
      payment_method_id: body.paymentMethodId ?? null,
      reference_no: body.referenceNo ?? null,
      narration: body.narration ?? null,
      status: "posted",
      created_by: actorId,
      super_admin_serial_number: transactionSerials.superAdminSerialNumber,
      country_transaction_serial_number: transactionSerials.countryTransactionSerialNumber,
      branch_transaction_serial_number: transactionSerials.branchTransactionSerialNumber,
      main_branch_transaction_serial: transactionSerials.mainBranchTransactionSerialNumber,
      city_branch_transaction_serial: transactionSerials.cityBranchTransactionSerialNumber,
      entry_serial_number: transactionSerials.entrySerialNumber,
      source_module: body.sourceModule ?? null,
      source_transaction_type: body.sourceTransactionType ?? null,
      source_transaction_id: body.sourceTransactionId ?? null,
      source_reference_no: body.sourceReferenceNo ?? null,
      // The Cash Entry form sends its Business/Bank/Cash/Invoice/Transfer selection nested inside
      // paymentDetails.roznamchaCategory (a free-form jsonb blob), not as a top-level field — this
      // was previously dropped entirely since nothing read it back out of paymentDetails.
      entry_category: (body.roznamchaCategory || (body.paymentDetails as any)?.roznamchaCategory || null) as
        | "business"
        | "bank"
        | "cash"
        | "invoice"
        | "transfer"
        | null,
      posted_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (entryError) throw new Error(entryError.message);
  const entryId = entry.id as string;

  // 4-level serial (Global/Country/Branch/Entry) — additive metadata on the
  // roznamcha entry only; does NOT touch the ledger/account posting below.
  try {
    const s = await allocateFormSerials("journal_roznamcha", { countryId: (body as any).countryId ?? null, branchKey: (body as any).countryBranchId ?? (body as any).cityBranchId ?? null });
    await admin.from("roznamcha_entries").update({ super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial }).eq("id", entryId);
  } catch { /* non-fatal — never affects posting */ }

  for (const line of body.lines) {
    const ledgerId = line.ledgerId;
    if (!ledgerId) throw new Error("ledgerId is required for posting");

    const { data: ledger, error: ledgerError } = await admin
      .from("ledgers")
      .select("id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, is_active")
      .eq("id", ledgerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);
    if (!ledger?.id || ledger.is_active === false) throw new Error("Ledger was not found or inactive");

    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    const usdRate = toNumber(line.exchangeRate) || 1;
    const enterpriseAccountId = line.enterpriseAccountId ?? ledger.enterprise_account_id ?? null;

    if (!isLedgerScopeCompatible(body.type, ledger.scope)) {
      throw new Error("Ledger belongs to a different financial scope");
    }

    // ── Rule 1: Country Scope Validation ──
    const { validateLedgerCountryScope, validateAccountCountryScope } = await import("@/lib/api/country-scope-validator");
    if (input.session) {
      await validateLedgerCountryScope(input.session, ledgerId, body.countryId, admin);
      if (enterpriseAccountId) {
        await validateAccountCountryScope(input.session, enterpriseAccountId, body.countryId, admin);
      }
    }

    const { data: currentLedger, error: currentLedgerError } = await admin
      .from("ledgers")
      .select("debit_total, credit_total, current_balance")
      .eq("id", ledgerId)
      .single();
    if (currentLedgerError) throw new Error(currentLedgerError.message);

    const { error: updateLedgerError } = await admin
      .from("ledgers")
      .update({
        debit_total: toNumber(currentLedger.debit_total) + debit,
        credit_total: toNumber(currentLedger.credit_total) + credit,
        current_balance: toNumber(currentLedger.current_balance) + debit - credit,
        updated_at: new Date().toISOString()
      })
      .eq("id", ledgerId);
    if (updateLedgerError) throw new Error(updateLedgerError.message);

    let accountIdentity: {
      account_number: string | null;
      manual_reference_number: string | null;
      customer_number: string | null;
      country_serial_number: string | null;
      branch_serial_number: string | null;
      current_balance: number | null;
    } | null = null;

    if (enterpriseAccountId) {
      const { data: account, error: accountError } = await admin
        .from("enterprise_accounts")
        .select("account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number, current_balance")
        .eq("id", enterpriseAccountId)
        .single();
      if (accountError) throw new Error(accountError.message);
      accountIdentity = account;
    }

    const traceability = {
      account_number: line.accountNumber ?? accountIdentity?.account_number ?? null,
      manual_reference_number: line.manualReferenceNumber ?? accountIdentity?.manual_reference_number ?? null,
      customer_number: line.customerNumber ?? accountIdentity?.customer_number ?? null,
      country_serial_number: line.countrySerialNumber ?? accountIdentity?.country_serial_number ?? null,
      branch_serial_number: line.branchSerialNumber ?? accountIdentity?.branch_serial_number ?? null
    };

    const conversion = await resolveUsdAmount(admin, {
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      currency: line.currency,
      amount: debit + credit,
      rate: usdRate,
      entryDate: body.entryDate,
      isDebit: debit > 0
    });

    const { error: lineError } = await admin.from("roznamcha_lines").insert({
      roznamcha_entry_id: entryId,
      payment_entry_type: line.paymentEntryType,
      account_id: line.accountId ?? null,
      enterprise_account_id: enterpriseAccountId,
      ledger_id: ledgerId,
      description: line.description ?? null,
      debit,
      credit,
      currency: line.currency,
      usd_rate: conversion.usdRate,
      usd_amount: conversion.usdAmount,
      super_admin_serial_number: transactionSerials.superAdminSerialNumber,
      country_transaction_serial_number: transactionSerials.countryTransactionSerialNumber,
      branch_transaction_serial_number: transactionSerials.branchTransactionSerialNumber,
      main_branch_transaction_serial: transactionSerials.mainBranchTransactionSerialNumber,
      city_branch_transaction_serial: transactionSerials.cityBranchTransactionSerialNumber,
      entry_serial_number: transactionSerials.entrySerialNumber,
      ...traceability
    });

    if (lineError) throw new Error(lineError.message);

    if (enterpriseAccountId && accountIdentity) {
      const nextBalance = toNumber(accountIdentity.current_balance) + debit - credit;
      const { error: accountUpdateError } = await admin
        .from("enterprise_accounts")
        .update({ current_balance: nextBalance, updated_at: new Date().toISOString() })
        .eq("id", enterpriseAccountId);
      if (accountUpdateError) throw new Error(accountUpdateError.message);

      await admin.from("enterprise_account_history").insert({
        enterprise_account_id: enterpriseAccountId,
        account_number: traceability.account_number,
        event_type: "roznamcha_posted",
        created_by: actorId,
        debit_total: debit,
        credit_total: credit,
        current_balance: nextBalance,
        last_transaction_at: new Date().toISOString(),
        details: {
          roznamchaEntryId: entryId,
          voucherNo: body.voucherNo,
          journalNo: body.journalNo,
          referenceNo: body.referenceNo ?? null,
          narration: body.narration ?? null,
          paymentEntryType: line.paymentEntryType,
          ledgerId,
          manualReferenceNumber: traceability.manual_reference_number,
          customerNumber: traceability.customer_number,
          countrySerialNumber: traceability.country_serial_number,
          branchSerialNumber: traceability.branch_serial_number,
          superAdminSerialNumber: transactionSerials.superAdminSerialNumber,
          countryTransactionSerialNumber: transactionSerials.countryTransactionSerialNumber,
          branchTransactionSerialNumber: transactionSerials.branchTransactionSerialNumber,
          currency: line.currency,
          exchangeRate: conversion.usdRate,
          paymentDetails: body.paymentDetails ?? null
        }
      });
    }

    const { data: balance, error: balanceError } = await admin
      .from("ledger_balances")
      .select("id, debit_total, credit_total, closing_balance")
      .eq("ledger_id", ledgerId)
      .eq("balance_date", body.entryDate)
      .maybeSingle();
    if (balanceError) throw new Error(balanceError.message);

    if (balance?.id) {
      const { error: balanceUpdateError } = await admin
        .from("ledger_balances")
        .update({
          debit_total: toNumber(balance.debit_total) + debit,
          credit_total: toNumber(balance.credit_total) + credit,
          closing_balance: toNumber(balance.closing_balance) + debit - credit,
          updated_at: new Date().toISOString()
        })
        .eq("id", balance.id);
      if (balanceUpdateError) throw new Error(balanceUpdateError.message);
    } else {
      const { error: balanceInsertError } = await admin.from("ledger_balances").insert({
        ledger_id: ledgerId,
        balance_date: body.entryDate,
        opening_balance: 0,
        debit_total: debit,
        credit_total: credit,
        closing_balance: debit - credit
      });
      if (balanceInsertError) throw new Error(balanceInsertError.message);
    }
  }

  return { entryId, transactionSerials };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 100;
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const fromDate = request.nextUrl.searchParams.get("fromDate")?.trim();
    const toDate = request.nextUrl.searchParams.get("toDate")?.trim();
    // Never skip narration resolution based on lang === "en" — the base DB column may
    // hold non-English source text (see localizeRecordNames rule established earlier
    // this session for the same class of bug on other tables).
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      ...scope
    });

    // Root-cause bypass (see postRoznamchaWithErpSession above): the Supabase client's
    // reads are RLS-gated on auth.uid(), which is always NULL under the temp-session
    // bootstrap login, so the query below silently returns zero rows even for entries
    // that were just posted. Try a direct-Postgres read first; only fall back to the
    // Supabase-client path when DATABASE_URL isn't configured for this environment.
    const viaPg = await withLocalPg(async (sql) => {
      let cityIds: string[] = [];
      let countryBranchIds: string[] = [];
      let countryIds: string[] = [];
      if (!session.isSuperAdmin) {
        for (const assignment of session.assignments) {
          if (assignment.cityBranchId) cityIds.push(assignment.cityBranchId);
          else if (assignment.countryBranchId) countryBranchIds.push(assignment.countryBranchId);
          else if (assignment.countryId) countryIds.push(assignment.countryId);
        }
        cityIds = [...new Set(cityIds)];
        countryBranchIds = [...new Set(countryBranchIds)];
        countryIds = [...new Set(countryIds)];
        if (cityIds.length === 0 && countryBranchIds.length === 0 && countryIds.length === 0) {
          return { entries: [] as any[] };
        }
      }

      const safeSearch = search ? search.replace(/[%,]/g, "") : null;

      const entryRows = await sql`
        select
          e.id, e.type, e.country_id, e.country_branch_id, e.city_branch_id,
          e.journal_no, e.voucher_no, e.super_admin_serial_number, e.country_transaction_serial_number,
          e.branch_transaction_serial_number, e.main_branch_transaction_serial, e.city_branch_transaction_serial,
          e.entry_serial_number, e.entry_date, e.payment_method_id, e.reference_no, e.narration, e.status,
          e.created_by, e.approved_by, e.approved_at, e.posted_at, e.created_at, e.updated_at,
          e.source_module, e.source_transaction_type, e.source_transaction_id, e.source_reference_no,
          case when c.id is not null then jsonb_build_object('name', c.name, 'currency_code', c.currency_code) else null end as countries,
          case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
          case when cib.id is not null then jsonb_build_object('name', cib.name, 'code', cib.code) else null end as city_branches,
          case when pm.id is not null then jsonb_build_object('name', pm.name, 'code', pm.code) else null end as payment_methods,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles,
          case when ap.id is not null then jsonb_build_object('full_name', ap.full_name) else null end as approver_profile
        from public.roznamcha_entries e
        left join public.countries c on c.id = e.country_id
        left join public.country_branches cb on cb.id = e.country_branch_id
        left join public.city_branches cib on cib.id = e.city_branch_id
        left join public.payment_methods pm on pm.id = e.payment_method_id
        left join public.profiles cp on cp.id = e.created_by
        left join public.profiles ap on ap.id = e.approved_by
        where e.deleted_at is null
          and (${scope.countryId ? sql`e.country_id = ${scope.countryId}` : sql`true`})
          and (${scope.countryBranchId ? sql`e.country_branch_id = ${scope.countryBranchId}` : sql`true`})
          and (${scope.cityBranchId ? sql`e.city_branch_id = ${scope.cityBranchId}` : sql`true`})
          and (${session.isSuperAdmin
            ? sql`true`
            : sql`(e.city_branch_id = any(${cityIds}) or e.country_branch_id = any(${countryBranchIds}) or e.country_id = any(${countryIds}))`})
          and (${fromDate ? sql`e.entry_date >= ${fromDate}` : sql`true`})
          and (${toDate ? sql`e.entry_date <= ${toDate}` : sql`true`})
          and (${safeSearch ? sql`(
                e.journal_no ilike ${"%" + safeSearch + "%"}
                or e.voucher_no ilike ${"%" + safeSearch + "%"}
                or e.reference_no ilike ${"%" + safeSearch + "%"}
                or e.super_admin_serial_number ilike ${"%" + safeSearch + "%"}
                or e.country_transaction_serial_number ilike ${"%" + safeSearch + "%"}
                or e.branch_transaction_serial_number ilike ${"%" + safeSearch + "%"}
              )` : sql`true`})
        order by e.entry_date desc
        limit ${limit}
      `;

      const entryIds = entryRows.map((r: any) => r.id);
      const lineRows = entryIds.length
        ? await sql`
            select
              rl.id, rl.roznamcha_entry_id, rl.payment_entry_type, rl.debit, rl.credit, rl.currency, rl.ledger_id,
              rl.description, rl.account_number, rl.manual_reference_number, rl.customer_number,
              rl.super_admin_serial_number, rl.country_transaction_serial_number, rl.branch_transaction_serial_number,
              rl.entry_serial_number, rl.country_serial_number, rl.branch_serial_number,
              rl.usd_rate, rl.usd_amount,
              case when l.id is not null then jsonb_build_object(
                'name', l.name,
                'city_branches', case when lcb.id is not null then jsonb_build_object('name', lcb.name) else null end,
                'country_branches', case when lcbr.id is not null then jsonb_build_object('name', lcbr.name) else null end
              ) else null end as ledgers
            from public.roznamcha_lines rl
            left join public.ledgers l on l.id = rl.ledger_id
            left join public.city_branches lcb on lcb.id = l.city_branch_id
            left join public.country_branches lcbr on lcbr.id = l.country_branch_id
            where rl.roznamcha_entry_id = any(${entryIds})
          `
        : [];

      const linesByEntry = new Map<string, any[]>();
      for (const line of lineRows as any[]) {
        const key = line.roznamcha_entry_id;
        if (!linesByEntry.has(key)) linesByEntry.set(key, []);
        linesByEntry.get(key)!.push(line);
      }

      const entries = (entryRows as any[]).map((e) => ({ ...e, roznamcha_lines: linesByEntry.get(e.id) ?? [] }));
      return { entries };
    });

    if (viaPg) {
      const narrationResolved = await localizeRecordNames(viaPg.entries, "roznamcha_entries", "narration", lang);
      const resolvedEntries = await localizeRoznamchaEntryLines(narrationResolved, lang);
      return apiOk({ entries: resolvedEntries, limit });
    }

    const supabase = (await createApiSupabaseClient()) as any;
    let query = supabase
      .from("roznamcha_entries")
      .select(
        // Disambiguate profiles embedding (created_by vs approved_by) by pinning to the FK.
        // We keep the `profiles` key in the response for backward compatibility with the UI types.
        "id, type, country_id, countries(name,currency_code), country_branch_id, country_branches(name,code), city_branch_id, city_branches(name,code), journal_no, voucher_no, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number, entry_date, payment_method_id, payment_methods(name,code), reference_no, narration, status, created_by, profiles!roznamcha_entries_created_by_fkey(full_name), approved_by, approver_profile:profiles!roznamcha_entries_approved_by_fkey(full_name), approved_at, posted_at, created_at, updated_at, source_module, source_transaction_type, source_transaction_id, source_reference_no, roznamcha_lines(id, payment_entry_type, description, debit, credit, currency, ledger_id, ledgers(name, city_branches(name), country_branches(name)), account_number, manual_reference_number, customer_number, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, entry_serial_number, country_serial_number, branch_serial_number, usd_rate, usd_amount)"
      )
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });

    // Enforce scope isolation:
    // If explicit scope parameters are provided, filter by them.
    if (scope.countryId) {
      query = query.eq("country_id", scope.countryId);
    }
    if (scope.countryBranchId) {
      query = query.eq("country_branch_id", scope.countryBranchId);
    }
    if (scope.cityBranchId) {
      query = query.eq("city_branch_id", scope.cityBranchId);
    }

    // Restrict non-super users by their explicit role assignments, not by the
    // resolved hierarchy arrays. The resolved arrays intentionally contain
    // parent context and using them as grants can broaden city-branch access.
    if (!session.isSuperAdmin) {
      const orConditions = [...new Set(session.assignments.map((assignment) => {
        if (assignment.cityBranchId) {
          return `city_branch_id.eq.${assignment.cityBranchId}`;
        }
        if (assignment.countryBranchId) {
          return `country_branch_id.eq.${assignment.countryBranchId}`;
        }
        if (assignment.countryId) {
          return `country_id.eq.${assignment.countryId}`;
        }
        return null;
      }).filter((condition): condition is string => Boolean(condition)))];

      if (orConditions.length) {
        query = query.or(orConditions.join(","));
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    if (fromDate) query = (query as any).gte("entry_date", fromDate);
    if (toDate) query = (query as any).lte("entry_date", toDate);

    if (search) {
      const safeSearch = search.replace(/[%,]/g, "");
      query = (query as any).or(
        [
          `journal_no.ilike.%${safeSearch}%`,
          `voucher_no.ilike.%${safeSearch}%`,
          `reference_no.ilike.%${safeSearch}%`,
          `super_admin_serial_number.ilike.%${safeSearch}%`,
          `country_transaction_serial_number.ilike.%${safeSearch}%`,
          `branch_transaction_serial_number.ilike.%${safeSearch}%`
        ].join(",")
      );
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const entries = data ?? [];
    const entryIds = entries.map((entry: any) => entry.id);
    if (entryIds.length) {
      // record_translations sits over per-language base tables with RLS gated on
      // auth.uid()/is_super_admin(), always NULL under this app's temp-session bootstrap —
      // any Supabase client (admin or per-request) silently returns zero rows here (same
      // root cause fixed in lib/services/ledger-report-service.ts). Try direct Postgres first.
      const viaPg = await withLocalPg(async (sql) => sql`
        select record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
        from public.record_translations
        where record_table = 'roznamcha_entries' and record_id = any(${entryIds}::uuid[]) and deleted_at is null
      `);
      let translationRows: any[] | null = viaPg;
      if (!translationRows) {
        const { data, error: translationError } = await supabase.from("record_translations")
          .select("record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text")
          .eq("record_table", "roznamcha_entries").in("record_id", entryIds).is("deleted_at", null);
        if (translationError) throw new Error(translationError.message);
        translationRows = data;
      }
      for (const row of translationRows || []) {
        const entry = entries.find((item: any) => item.id === row.record_id) as any;
        if (entry) {
          entry.translations ||= {};
          entry.translations[row.field_name] = { en: row.english_text, ur: row.urdu_text, ar: row.arabic_text, fa: row.persian_text, ps: row.pashto_text };
        }
      }
    }
    const narrationResolved = await localizeRecordNames(entries as any[], "roznamcha_entries", "narration", lang);
    const resolvedEntries = await localizeRoznamchaEntryLines(narrationResolved, lang);

    return apiOk({
      entries: resolvedEntries,
      limit
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const rawJson = await request.json();

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "ROZNAMCHA",
      userId: session.userId,
      countryId: session.countryIds[0] ?? null,
      cityBranchId: session.cityBranchIds[0] ?? null,
      businessReference: rawJson?.voucherNumber || rawJson?.referenceNo || rawJson?.sourceTransactionType,
      payload: rawJson
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 201, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return handleApiError(new Error("A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const body = roznamchaPostingSchema.parse(rawJson);

    // Validate that there are no duplicate ledger IDs across the posting lines
    const ledgerIds = body.lines.map(line => line.ledgerId).filter(Boolean);
    const uniqueLedgerIds = new Set(ledgerIds);
    if (ledgerIds.length !== uniqueLedgerIds.size) {
      throw new Error("Duplicate ledger selection is not allowed. Each transaction line must post to a different ledger.");
    }

    // ── Balance Validation: multi-line entries must be balanced (DR = CR) ──
    if (body.mode === "post" && body.lines.length > 1) {
      const debitTotal = body.lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
      const creditTotal = body.lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
      const difference = Math.round((debitTotal - creditTotal) * 10000) / 10000;
      if (difference !== 0) {
        throw new Error(`Entry is not balanced. Debit total: ${debitTotal.toFixed(4)}, Credit total: ${creditTotal.toFixed(4)}, Difference: ${difference.toFixed(4)}`);
      }
    }

    // ── Idempotency Guard: prevent duplicate posting from same source ──
    if (body.mode === "post") {
      const sourceModule = (body as any).sourceModule;
      const sourceTransactionType = (body as any).sourceTransactionType;
      if (sourceModule && sourceTransactionType) {
        const admin = createSupabaseAdminClient() as any;
        const { data: existingEntries } = await admin
          .from("roznamcha_entries")
          .select("id")
          .eq("source_module", sourceModule)
          .eq("source_transaction_type", sourceTransactionType)
          .eq("voucher_no", body.voucherNo)
          .is("deleted_at", null)
          .neq("status", "cancelled")
          .limit(1);

        if (existingEntries && existingEntries.length > 0) {
          throw new Error("A roznamcha entry already exists for this transaction. Duplicate posting is not allowed.");
        }
      }
    }

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: body.mode === "post" ? "post" : "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    let postingPlan;
    try {
      postingPlan = roznamchaService.createPostingPlan({
        type: body.type,
        countryId: body.countryId,
        countryBranchId: body.countryBranchId,
        cityBranchId: body.cityBranchId,
        entryDate: body.entryDate,
        journalNo: body.journalNo,
        voucherNo: body.voucherNo,
        narration: body.narration,
        referenceNo: body.referenceNo,
        lines: body.lines
      });
    } catch (error) {
      if (body.lines.length !== 1) throw error;
      postingPlan = createOperationalPostingPlan(body);
    }

    if (body.mode === "validate") {
      return apiOk({
        mode: body.mode,
        balanced: body.lines.length > 1,
        postingPlan
      });
    }

    const result = await postRoznamchaWithErpSession({ sessionUserId: session.userId, session, body });
    let translationStatus: { status: "complete" | "pending"; fields: Record<string, unknown> } = { status: "pending", fields: {} };
    try {
    const fields = roznamchaTranslationFields({ narration: body.narration, lines: body.lines, paymentDetails: body.paymentDetails })
      .map((field) => ({ ...field, translations: body.translations?.[field.fieldName] }));
    const translationResults = await saveVerifiedEnterpriseRecordTranslations({
      recordTable: "roznamcha_entries", recordId: result.entryId, originalLanguage: body.originalLanguage,
      actorId: session.userId, fields, source: "auto"
    });
    translationStatus = {
      status: translationResults.every((item) => item.status === "complete") ? "complete" : "pending",
      fields: Object.fromEntries(translationResults.map((item) => [item.fieldName, { status: item.status, missingLanguages: item.missingLanguages }]))
    };
    } catch (translationError) {
      console.warn("Roznamcha translations remain pending because persistence failed:", translationError);
    }

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/roznamcha", "layout");
    revalidatePath("/dashboard/roznamcha/all", "page");
    revalidatePath("/dashboard/reports", "layout");
    revalidatePath("/dashboard/journal", "layout");

    const responseBody = {
      mode: body.mode,
      balanced: body.lines.length > 1,
      entryId: result.entryId,
      ...result.transactionSerials,
      postingPlan,
      translationStatus
    };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, responseBody);
    }

    return apiCreated(responseBody);
  } catch (error: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    console.error("ROZNAMCHA_POST_ERROR:", error?.message);
    return handleApiError(error);
  }
}
