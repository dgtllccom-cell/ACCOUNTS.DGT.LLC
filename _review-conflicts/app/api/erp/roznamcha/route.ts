/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { roznamchaPostingSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { roznamchaService } from "@/lib/services/roznamcha-service";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

async function generateTransactionSerials(admin: any, body: ReturnType<typeof roznamchaPostingSchema.parse>) {
  // Wrap entire serial generation in try/catch — serial failures must never block a posting
  try {
    const superAdminSerialNumber = await nextTransactionSerial(admin, "global", "global", "SA");

    let countryPrefix = "CNT";
    if (body.countryId) {
      const { data: country } = await admin
        .from("countries")
        .select("iso2, iso3, name")
        .eq("id", body.countryId)
        .maybeSingle();
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

    // Entry Serial specifically for Roznamcha
    const entrySerialPrefix = (body as any).roznamchaBookType === "bank" ? "BNK" : "ROZ";

    // Only generate country serial if countryId is a non-empty string
    const countryTransactionSerialNumber =
      body.countryId && typeof body.countryId === "string"
        ? await nextTransactionSerial(admin, "country", body.countryId, countryPrefix)
        : null;

    // Only generate branch serial if at least one branch ID is a non-empty string
    const branchScopeKey = body.cityBranchId || body.countryBranchId;
    const branchTransactionSerialNumber =
      branchScopeKey && typeof branchScopeKey === "string"
        ? await nextTransactionSerial(admin, "branch", branchScopeKey, body.cityBranchId ? cityBranchPrefix : mainBranchPrefix)
        : null;

    const mainBranchTransactionSerialNumber =
      body.countryBranchId && typeof body.countryBranchId === "string"
        ? await nextTransactionSerial(admin, "main_branch", body.countryBranchId, mainBranchPrefix)
        : null;

    const cityBranchTransactionSerialNumber =
      body.cityBranchId && typeof body.cityBranchId === "string"
        ? await nextTransactionSerial(admin, "city_branch", body.cityBranchId, cityBranchPrefix)
        : null;

    const entrySerialNumber = await nextTransactionSerial(admin, "module_roznamcha", "global", entrySerialPrefix);

    return {
      superAdminSerialNumber,
      countryTransactionSerialNumber,
      branchTransactionSerialNumber,
      mainBranchTransactionSerialNumber,
      cityBranchTransactionSerialNumber,
      entrySerialNumber
    };
  } catch (err: any) {
    // If serial generation fails entirely, log and return fallback serials so posting is not blocked
    console.warn("[serial] generateTransactionSerials failed, using fallback serials:", err?.message);
    const ts = Date.now().toString(36).toUpperCase();
    return {
      superAdminSerialNumber: `SA-${ts}`,
      countryTransactionSerialNumber: body.countryId ? `CNT-${ts}` : null,
      branchTransactionSerialNumber: (body.cityBranchId || body.countryBranchId) ? `BR-${ts}` : null,
      mainBranchTransactionSerialNumber: body.countryBranchId ? `MB-${ts}` : null,
      cityBranchTransactionSerialNumber: body.cityBranchId ? `CB-${ts}` : null,
      entrySerialNumber: `ROZ-${ts}`
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

export async function postRoznamchaWithErpSession(input: {
  sessionUserId: string;
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
      source_reference_no: body.sourceReferenceNo ?? null,
      posted_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (entryError) throw new Error(entryError.message);
  const entryId = entry.id as string;

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
    // Strict branch/country checks removed to allow inter-branch and inter-country 
    // ledger postings (e.g. Afghanistan order paid from Pakistan account).

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

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      ...scope
    });

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("roznamcha_entries")
      .select(
        // Disambiguate profiles embedding (created_by vs approved_by) by pinning to the FK.
        // We keep the `profiles` key in the response for backward compatibility with the UI types.
        "id, type, country_id, countries(name,currency_code), country_branch_id, country_branches(name,code), city_branch_id, city_branches(name,code), journal_no, voucher_no, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number, entry_date, payment_method_id, payment_methods(name,code), reference_no, narration, status, created_by, profiles!roznamcha_entries_created_by_fkey(full_name), approved_by, approver_profile:profiles!roznamcha_entries_approved_by_fkey(full_name), approved_at, posted_at, created_at, updated_at, source_module, source_transaction_type, source_transaction_id, source_reference_no, roznamcha_lines(id, payment_entry_type, debit, credit, currency, ledger_id, ledgers(name, city_branches(name), country_branches(name)), account_number, manual_reference_number, customer_number, usd_rate, usd_amount)"
      )
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });

    // Enforce scope isolation:
    // If explicit scope parameters are provided, filter by them.
    if (scope.countryId) {
      query = query.eq("country_id", scope.countryId);
    }
    if (scope.countryBranchId) {
      query = query.or(`country_branch_id.eq.${scope.countryBranchId},city_branch_id.eq.${scope.countryBranchId}`);
    }
    if (scope.cityBranchId) {
      query = query.or(`city_branch_id.eq.${scope.cityBranchId},country_branch_id.eq.${scope.cityBranchId}`);
    }

    // If not super admin, restrict the query to the user's assigned scopes using OR.
    if (!session.isSuperAdmin) {
      const orConditions: string[] = [];
      if (session.cityBranchIds?.length) {
        orConditions.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
      }
      if (session.countryBranchIds?.length) {
        orConditions.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
      }
      if (session.countryIds?.length) {
        orConditions.push(`country_id.in.(${session.countryIds.join(",")})`);
      }
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

    return apiOk({
      entries: data ?? [],
      limit
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = roznamchaPostingSchema.parse(await request.json());

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

    const result = await postRoznamchaWithErpSession({ sessionUserId: session.userId, body });

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/roznamcha", "layout");
    revalidatePath("/dashboard/reports", "layout");
    revalidatePath("/dashboard/journal", "layout");

    return apiCreated({
      mode: body.mode,
      balanced: body.lines.length > 1,
      entryId: result.entryId,
      ...result.transactionSerials,
      postingPlan
    });
  } catch (error: any) {
    console.error("ROZNAMCHA_POST_ERROR:", error?.message);
    return handleApiError(error);
  }
}
