import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { dailyRateEffectiveFrom } from "@/lib/currency/daily-rate-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Daily Exchange Rate register — backed by the real `daily_usd_rates` table
 * and audited in `exchange_rate_history`.
 *
 * Rules:
 * 1. Country Admin owns their country's rate (Pakistan -> PKR, UAE -> AED, AFN, INR, etc.).
 * 2. Country-wide allocation: one authoritative country rate (country_branch_id = null),
 *    automatically available to all branches, operations, shipping, purchase, sales, roznamcha.
 * 3. Append-only: a second rate for the same date is a controlled correction (mandatory reason,
 *    audit row) that INSERTS a new row. The trigger daily_usd_rates_mark_superseded sets
 *    superseded_at on the previous row, so nothing is overwritten and no duplicate active row exists.
 * 4. Missing rate status tracking for Super Admin (all countries) and Country Admin (own country).
 *    Status and the latest approved rate are computed over the whole scope, never over the table filters.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function mapRow(row: any) {
  return {
    id: row.id,
    country_id: row.country_id,
    country_branch_id: row.country_branch_id ?? null,
    rate_date: row.rate_date,
    rate_time: row.rate_time ?? null,
    carried_forward_from: row.carried_forward_from ?? null,
    effective_from: row.effective_from ?? null,
    superseded_at: row.superseded_at ?? null,
    currency_code: row.currency_code ?? row.countries?.currency_code ?? null,
    buying_rate: row.buying_rate != null ? Number(row.buying_rate) : null,
    selling_rate: row.selling_rate != null ? Number(row.selling_rate) : null,
    credit_rate: row.credit_rate != null ? Number(row.credit_rate) : null,
    debit_rate: row.debit_rate != null ? Number(row.debit_rate) : null,
    user_name: row.user_name ?? null,
    branch_name: row.branch_name ?? "Country-wide (All Branches)",
    entered_by: row.entered_by ?? null,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    countries: row.countries ?? null,
  };
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId");
    const query = searchParams.get("query")?.toLowerCase().trim();
    const dateParam = searchParams.get("date")?.trim();
    const dateFrom = searchParams.get("dateFrom") || (dateParam ? dateParam : null);
    const dateTo = searchParams.get("dateTo") || (dateParam ? dateParam : null);
    authorizeApiScope(session, { resource: hasRolePermission(session, "currency_rates", "read") ? "currency_rates" : "roznamcha", action: "read", countryId: countryId && countryId !== "all" ? countryId : null });

    const supabase = createSupabaseAdminClient() as any;

    // 1. Fetch exchange rate records (the filtered list shown in the table)
    let q = supabase
      .from("daily_usd_rates")
      .select("*, countries(id, name, currency_code, iso2)")
      .is("deleted_at", null)
      .order("rate_date", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1000);

    // Backend scope: non-super-admin only sees their assigned countries.
    if (!session.isSuperAdmin) {
      q = q.in("country_id", session.countryIds);
    }
    if (countryId && countryId !== "all") q = q.eq("country_id", countryId);
    if (dateFrom) q = q.gte("rate_date", dateFrom);
    if (dateTo) q = q.lte("rate_date", dateTo);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    let rows = (Array.isArray(data) ? data : []).map(mapRow);
    if (query) {
      rows = rows.filter(
        (r) =>
          (r.user_name || "").toLowerCase().includes(query) ||
          (r.branch_name || "").toLowerCase().includes(query) ||
          (r.countries?.name || "").toLowerCase().includes(query) ||
          (r.currency_code || "").toLowerCase().includes(query)
      );
    }

    // 2. Fetch countries master to build Country Status Board
    const { data: countriesMaster } = await supabase
      .from("countries")
      .select("id, name, currency_code, iso2")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    // Only countries where the company has a live branch (country or city branch). Other countries stay in the
    // master list (goods origin, customers, accounts); they are simply not offered on the daily-rate board.
    const { data: operatingBranchRows } = await supabase.from("country_branches").select("country_id").is("deleted_at", null);
    const { data: operatingCityRows } = await supabase.from("city_branches").select("country_id").is("deleted_at", null);
    const operatingCountryIds = new Set([...(operatingBranchRows || []), ...(operatingCityRows || [])].map((r: any) => r.country_id));

    const cleanCountries = (countriesMaster || []).filter((c: any) => {
      const n = (c.name || "").toUpperCase();
      return !n.startsWith("QA ") && !n.includes("QA COUNTRY") && !n.startsWith("DEVTEST") && !n.startsWith("DEV-DEMO")
        && operatingCountryIds.has(c.id);
    });

    const scopedCountries = session.isSuperAdmin
      ? cleanCountries
      : cleanCountries.filter((c: any) => session.countryIds?.includes(c.id));

    // "Today" is the operator's local calendar date, sent by the page as ?today=YYYY-MM-DD.
    // The UTC server date is only a fallback: in Dubai it is still yesterday until 04:00.
    const todayParam = searchParams.get("today")?.trim() || "";
    const targetRateDate = dateParam || (DATE_ONLY.test(todayParam) ? todayParam : isoToday());

    // Status and the latest approved rate are read over the WHOLE scope, never from the filtered list above,
    // so a search, branch or date-range filter can never make an approved rate look missing.
    const activeScopeRows = async (onDate?: string) => {
      if (!session.isSuperAdmin && !session.countryIds?.length) return [] as any[];
      let aq = supabase
        .from("daily_usd_rates")
        .select("*, countries(name, currency_code, iso2)")
        .is("deleted_at", null)
        .is("superseded_at", null)
        .order("effective_from", { ascending: false })
        .limit(1000);
      if (!session.isSuperAdmin) aq = aq.in("country_id", session.countryIds);
      if (onDate) aq = aq.eq("rate_date", onDate);
      const { data: activeData, error: activeErr } = await aq;
      if (activeErr) throw new Error(activeErr.message);
      return (Array.isArray(activeData) ? activeData : []).map(mapRow);
    };
    const [targetActive, latestActive] = await Promise.all([activeScopeRows(targetRateDate), activeScopeRows()]);

    // Map status for each scoped country for the requested date (exact match prioritized, carry-forward identified)
    const countriesStatus = scopedCountries.map((c: any) => {
      // Today's approved rate (exact date). Carry-forward = newest approved rate dated before the target date.
      const activeRate: any = targetActive.find((r: any) => r.country_id === c.id);
      const prevRate: any = !activeRate
        ? latestActive.find((r: any) => r.country_id === c.id && r.rate_date < targetRateDate)
        : null;
      const isCarryForward = !activeRate && Boolean(prevRate);
      const chosenRate: any = activeRate || prevRate;
      return {
        countryId: c.id,
        countryName: c.name,
        currencyCode: c.currency_code,
        iso2: c.iso2,
        rateDate: chosenRate ? chosenRate.rate_date : targetRateDate,
        status: activeRate ? ("APPROVED" as const) : isCarryForward ? ("CARRY_FORWARD" as const) : ("PENDING_MISSING" as const),
        isCarryForward,
        creditRate: chosenRate ? chosenRate.credit_rate : null,
        debitRate: chosenRate ? chosenRate.debit_rate : null,
        rateTime: chosenRate ? chosenRate.rate_time : null,
        enteredBy: chosenRate ? chosenRate.user_name : null,
        updatedAt: chosenRate ? chosenRate.updated_at || chosenRate.created_at : null,
      };
    });

    // Latest APPROVED (active) rate per country, with its own date: the carry-forward source and the summary card.
    const latestApproved = scopedCountries.flatMap((c: any) => {
      const r: any = latestActive.find((x: any) => x.country_id === c.id);
      if (!r) return [];
      return [{
        countryId: c.id,
        countryName: c.name,
        currencyCode: r.currency_code ?? c.currency_code,
        iso2: c.iso2,
        rateId: r.id,
        rateDate: r.rate_date,
        rateTime: r.rate_time ?? null,
        effectiveFrom: r.effective_from ?? null,
        creditRate: r.credit_rate,
        debitRate: r.debit_rate,
        enteredBy: r.user_name ?? null,
        updatedAt: r.updated_at || r.created_at || null,
      }];
    });

    // 3. Fetch Audit History from exchange_rate_history
    let histQ = supabase
      .from("exchange_rate_history")
      .select("*, countries(name, currency_code, iso2)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!session.isSuperAdmin) {
      histQ = histQ.in("country_id", session.countryIds);
    }
    if (countryId && countryId !== "all") {
      histQ = histQ.eq("country_id", countryId);
    }

    const { data: auditRows } = await histQ;

    const payload = {
      rates: rows,
      countriesStatus,
      latestApproved,
      auditHistory: auditRows || [],
    };

    return NextResponse.json({
      ok: true,
      data: payload,
      rates: rows,
      countriesStatus,
      latestApproved,
      auditHistory: auditRows || [],
    });
  } catch (error: any) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_")) throw error;
    if (error?.message === "NEXT_REDIRECT" || error?.message === "NEXT_NOT_FOUND") throw error;
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load exchange rates" },
      { status: error?.status ?? 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const {
      countryId,
      rateDate,
      rateTime,
      buyingRate,
      sellingRate,
      creditRate,
      debitRate,
      currencyCode,
      userName,
      reason,
      action, // 'create' | 'correct'
      timeZoneOffsetMinutes,
      carriedForwardFrom, // YYYY-MM-DD of the approved rate this row copies (carry-forward only)
    } = body;

    if (!countryId) {
      return NextResponse.json({ ok: false, error: "countryId is required." }, { status: 400 });
    }

    // RBAC: Super Admin or Country Admin for this country only
    const isSuperAdmin = Boolean(session.isSuperAdmin);
    const isAuthorizedCountry = isSuperAdmin || (Array.isArray(session.countryIds) && session.countryIds.includes(countryId));

    if (!isAuthorizedCountry) {
      return NextResponse.json(
        { ok: false, error: "Country Admin may only enter or modify rates for their own assigned country." },
        { status: 403 }
      );
    }

    // Branch users need an explicit rate-management grant; country scope remains mandatory.
    const isCountryAdminOrSuper = isSuperAdmin || session.roles?.includes("country_admin") || hasRolePermission(session, "currency_rates", "create") || hasRolePermission(session, "currency_rates", "update");
    if (!isCountryAdminOrSuper) {
      return NextResponse.json(
        { ok: false, error: "Branch users are not authorized to create or edit country exchange rates. Rates are managed by the Country Admin." },
        { status: 403 }
      );
    }

    const credit = Number(creditRate ?? sellingRate);
    const debit = Number(debitRate ?? buyingRate);
    if (!Number.isFinite(credit) || !Number.isFinite(debit) || !(credit > 0) || !(debit > 0)) {
      return NextResponse.json(
        { ok: false, error: "Credit (Selling) and Debit (Buying) rates must both be greater than zero." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient() as any;

    // Resolve currency & country name
    let currency = currencyCode ? String(currencyCode).toUpperCase() : null;
    let countryName = "";
    const { data: c } = await supabase.from("countries").select("name, currency_code").eq("id", countryId).maybeSingle();
    if (c) {
      currency = currency || String(c.currency_code).toUpperCase();
      countryName = c.name;
    }

    const targetDate = rateDate || isoToday();
    // A rate applies from the START of its rate date (operator's local midnight), so a rate entered for today is
    // active today. The entry time is kept for display only (rate_time); it no longer moves the start.
    const effectiveFrom = dailyRateEffectiveFrom(targetDate, "00:00", timeZoneOffsetMinutes);
    const operatorName = session.fullName || session.email || "Country Admin";
    const cleanReason = String(reason || "").trim();

    // Safely check if session.userId exists in profiles to satisfy FK constraint
    let validUserId: string | null = session.userId || null;
    if (validUserId) {
      const { data: userProfile } = await supabase.from("profiles").select("id").eq("id", validUserId).maybeSingle();
      if (!userProfile) {
        validUserId = null;
      }
    }

    // Check if an authoritative rate ALREADY exists for this Country on targetDate (newest first)
    const { data: existingRates } = await supabase
      .from("daily_usd_rates")
      .select("*")
      .eq("country_id", countryId)
      .eq("rate_date", targetDate)
      .is("deleted_at", null)
      .order("effective_from", { ascending: false });

    const existingRate = existingRates && existingRates.length > 0 ? existingRates[0] : null;
    authorizeApiScope(session, { resource: "currency_rates", action: existingRate ? "update" : "create", countryId });

    // The values a new rate row carries (a correction and a first entry share them).
    const rateRow = (effective: string, time: string | null) => ({
      country_id: countryId,
      country_branch_id: null, // country-wide allocation (Requirement 2)
      rate_date: targetDate,
      rate_time: time,
      effective_from: effective,
      currency_code: currency,
      buying_rate: debit,
      selling_rate: credit,
      credit_rate: credit,
      debit_rate: debit,
      entered_by: validUserId,
      user_name: operatorName,
      branch_name: "Country-wide (All Branches)",
      carried_forward_from: /^\d{4}-\d{2}-\d{2}$/.test(String(carriedForwardFrom || "")) && carriedForwardFrom !== targetDate
        ? String(carriedForwardFrom)
        : null,
    });

    // Case 1: Rate ALREADY exists for this date -> controlled, append-only correction
    if (existingRate) {
      // If user did not provide a reason or did not explicitly choose correction mode
      if (!cleanReason || action !== "correct") {
        return NextResponse.json(
          {
            ok: false,
            requiresCorrection: true,
            error: "RATE_EXISTS_CORRECTION_REQUIRED",
            message: `A daily rate for ${countryName || "this country"} already exists for ${targetDate} (Credit: ${existingRate.credit_rate}, Debit: ${existingRate.debit_rate}). To correct it, please provide a reason for the audit history.`,
            existingRate: mapRow(existingRate),
          },
          { status: 409 }
        );
      }

      // Log the full audit history in exchange_rate_history first:
      // Old Rate -> New Rate -> Changed By -> Date/Time -> Reason
      const { error: auditError } = await supabase.from("exchange_rate_history").insert({
        country_id: countryId,
        from_currency: currency,
        to_currency: "USD",
        old_rate: existingRate.credit_rate,
        old_credit_rate: existingRate.credit_rate,
        old_debit_rate: existingRate.debit_rate,
        new_rate: credit,
        new_credit_rate: credit,
        new_debit_rate: debit,
        effective_date: targetDate,
        changed_by: validUserId,
        user_name: operatorName,
        reason: cleanReason,
        created_at: new Date().toISOString(),
      });
      if (auditError) throw new Error(auditError.message);

      // Append-only: the corrected rate is a NEW row. The trigger daily_usd_rates_mark_superseded
      // sets superseded_at on the previous row. The new row must sort after the newest rate of this
      // country, otherwise the trigger would supersede the correction at once.
      const { data: newest } = await supabase
        .from("daily_usd_rates")
        .select("effective_from")
        .eq("country_id", countryId)
        .is("deleted_at", null)
        .order("effective_from", { ascending: false })
        .limit(1);
      const newestMs = newest?.[0]?.effective_from ? Date.parse(newest[0].effective_from) : Number.NaN;
      const correctedAt = new Date(Math.max(Date.parse(effectiveFrom), Number.isFinite(newestMs) ? newestMs + 1000 : 0)).toISOString();

      const { data: corrected, error: correctedErr } = await supabase
        .from("daily_usd_rates")
        .insert(rateRow(correctedAt, rateTime || existingRate.rate_time))
        .select("*, countries(name, currency_code, iso2)")
        .single();
      if (correctedErr) throw new Error(correctedErr.message);

      return NextResponse.json({
        ok: true,
        data: mapRow(corrected),
        message: `Exchange rate for ${countryName} (${targetDate}) corrected. The previous rate is superseded and kept in history.`,
      });
    }

    // Case 2: New Daily Rate entry for this date.
    // A reason is optional here; the carry-forward action sends one so the history says where the rate came from.
    const historyReason = cleanReason || "Initial daily exchange rate entry";
    const insertRow = rateRow(effectiveFrom, rateTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    const { data: inserted, error: insertErr } = await supabase
      .from("daily_usd_rates")
      .insert(insertRow)
      .select("*, countries(name, currency_code, iso2)")
      .single();

    if (insertErr) {
      // If unique collision on effective_from happens, adjust timestamp by 1s
      if (String(insertErr.message).toLowerCase().includes("duplicate")) {
        const bumped = new Date(new Date(effectiveFrom).getTime() + 1000).toISOString();
        const retry = await supabase
          .from("daily_usd_rates")
          .insert({ ...insertRow, effective_from: bumped })
          .select("*, countries(name, currency_code, iso2)")
          .single();
        if (retry.error) throw new Error(retry.error.message);

        // Log initial entry in audit trail
        await supabase.from("exchange_rate_history").insert({
          country_id: countryId,
          from_currency: currency,
          to_currency: "USD",
          old_rate: null,
          old_credit_rate: null,
          old_debit_rate: null,
          new_rate: credit,
          new_credit_rate: credit,
          new_debit_rate: debit,
          effective_date: targetDate,
          changed_by: session.userId || null,
          user_name: operatorName,
          reason: historyReason,
          created_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          data: mapRow(retry.data),
          message: `Daily exchange rate confirmed and active country-wide for ${countryName}.`,
        });
      }
      throw new Error(insertErr.message);
    }

    // Log initial entry in audit trail
    await supabase.from("exchange_rate_history").insert({
      country_id: countryId,
      from_currency: currency,
      to_currency: "USD",
      old_rate: null,
      old_credit_rate: null,
      old_debit_rate: null,
      new_rate: credit,
      new_credit_rate: credit,
      new_debit_rate: debit,
      effective_date: targetDate,
      changed_by: session.userId || null,
      user_name: operatorName,
      reason: historyReason,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      data: mapRow(inserted),
      message: `Daily exchange rate confirmed and active country-wide for ${countryName}.`,
    });
  } catch (error: any) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_")) throw error;
    if (error?.message === "NEXT_REDIRECT" || error?.message === "NEXT_NOT_FOUND") throw error;
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save rate" },
      { status: error?.status ?? 400 }
    );
  }
}
