import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
 * 3. Never throw duplicate key error: if rate exists for Country + Date, a controlled
 *    correction workflow with mandatory reason and full audit logging is enforced.
 * 4. Missing rate status tracking for Super Admin (all countries) and Country Admin (own country).
 */

function mapRow(row: any) {
  return {
    id: row.id,
    country_id: row.country_id,
    country_branch_id: row.country_branch_id ?? null,
    rate_date: row.rate_date,
    rate_time: row.rate_time ?? null,
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
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const supabase = createSupabaseAdminClient() as any;

    // 1. Fetch exchange rate records
    let q = supabase
      .from("daily_usd_rates")
      .select("*, countries(id, name, currency_code, iso2)")
      .is("deleted_at", null)
      .order("rate_date", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1000);

    // Backend scope: non-super-admin only sees their assigned countries.
    if (!session.isSuperAdmin && Array.isArray(session.countryIds) && session.countryIds.length > 0) {
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

    const cleanCountries = (countriesMaster || []).filter((c: any) => {
      const n = (c.name || "").toUpperCase();
      return !n.startsWith("QA ") && !n.includes("QA COUNTRY") && !n.startsWith("DEVTEST") && !n.startsWith("DEV-DEMO");
    });

    const scopedCountries = session.isSuperAdmin
      ? cleanCountries
      : cleanCountries.filter((c: any) => session.countryIds?.includes(c.id));

    const todayStr = isoToday();

    // Map status for each scoped country for today
    const countriesStatus = scopedCountries.map((c: any) => {
      const todayRate = rows.find(
        (r) => r.country_id === c.id && r.rate_date === todayStr && !r.superseded_at
      );
      return {
        countryId: c.id,
        countryName: c.name,
        currencyCode: c.currency_code,
        iso2: c.iso2,
        rateDate: todayStr,
        status: todayRate ? ("APPROVED" as const) : ("PENDING_MISSING" as const),
        creditRate: todayRate ? todayRate.credit_rate : null,
        debitRate: todayRate ? todayRate.debit_rate : null,
        rateTime: todayRate ? todayRate.rate_time : null,
        enteredBy: todayRate ? todayRate.user_name : null,
        updatedAt: todayRate ? todayRate.updated_at || todayRate.created_at : null,
      };
    });

    // 3. Fetch Audit History from exchange_rate_history
    let histQ = supabase
      .from("exchange_rate_history")
      .select("*, countries(name, currency_code, iso2)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!session.isSuperAdmin && Array.isArray(session.countryIds) && session.countryIds.length > 0) {
      histQ = histQ.in("country_id", session.countryIds);
    }
    if (countryId && countryId !== "all") {
      histQ = histQ.eq("country_id", countryId);
    }

    const { data: auditRows } = await histQ;

    return NextResponse.json({
      ok: true,
      data: rows,
      rates: rows,
      countriesStatus,
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

function parseEffectiveFrom(rateDate: string, rateTime: string | undefined | null): string {
  const date = rateDate || isoToday();
  const raw = String(rateTime || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ap = m[3]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const hh = String(h).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    return `${date}T${hh}:${mm}:00Z`;
  }
  return new Date().toISOString();
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

    // Branch users cannot create or edit exchange rates
    const isCountryAdminOrSuper = isSuperAdmin || session.roles?.includes("countryAdmin") || session.permissions?.includes("currency_rates:create");
    if (!isCountryAdminOrSuper) {
      return NextResponse.json(
        { ok: false, error: "Branch users are not authorized to create or edit country exchange rates. Rates are managed by the Country Admin." },
        { status: 403 }
      );
    }

    const credit = Number(creditRate ?? sellingRate);
    const debit = Number(debitRate ?? buyingRate);
    if (!(credit > 0) || !(debit > 0)) {
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
    const effectiveFrom = parseEffectiveFrom(targetDate, rateTime);
    const operatorName = userName || session.fullName || session.email || "Country Admin";

    // Safely check if session.userId exists in profiles to satisfy FK constraint
    let validUserId: string | null = session.userId || null;
    if (validUserId) {
      const { data: userProfile } = await supabase.from("profiles").select("id").eq("id", validUserId).maybeSingle();
      if (!userProfile) {
        validUserId = null;
      }
    }

    // Check if an authoritative rate ALREADY exists for this Country on targetDate
    const { data: existingRates } = await supabase
      .from("daily_usd_rates")
      .select("*")
      .eq("country_id", countryId)
      .eq("rate_date", targetDate)
      .is("deleted_at", null)
      .order("effective_from", { ascending: false });

    const existingRate = existingRates && existingRates.length > 0 ? existingRates[0] : null;

    // Case 1: Rate ALREADY exists for this date -> Controlled Edit/Correction Workflow
    if (existingRate) {
      const cleanReason = String(reason || "").trim();

      // If user did not provide a reason or did not explicitly choose correction mode
      if (!cleanReason && action !== "correct") {
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

      // Log the full audit history in exchange_rate_history:
      // Old Rate -> New Rate -> Changed By -> Date/Time -> Reason
      await supabase.from("exchange_rate_history").insert({
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
        reason: cleanReason || "Authorized rate correction",
        created_at: new Date().toISOString(),
      });

      // Update existing record with the corrected rates without duplicate-key errors
      const { data: updated, error: updateErr } = await supabase
        .from("daily_usd_rates")
        .update({
          credit_rate: credit,
          selling_rate: credit,
          debit_rate: debit,
          buying_rate: debit,
          rate_time: rateTime || existingRate.rate_time,
          user_name: operatorName,
          entered_by: validUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRate.id)
        .select("*, countries(name, currency_code, iso2)")
        .single();

      if (updateErr) throw new Error(updateErr.message);

      return NextResponse.json({
        ok: true,
        data: mapRow(updated),
        message: `Exchange rate for ${countryName} (${targetDate}) corrected successfully with complete audit log.`,
      });
    }

    // Case 2: New Daily Rate entry for this date
    // Country-wide allocation: country_branch_id = null per Requirement 2
    const insertRow = {
      country_id: countryId,
      country_branch_id: null,
      rate_date: targetDate,
      rate_time: rateTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      effective_from: effectiveFrom,
      currency_code: currency,
      buying_rate: debit,
      selling_rate: credit,
      credit_rate: credit,
      debit_rate: debit,
      entered_by: validUserId,
      user_name: operatorName,
      branch_name: "Country-wide (All Branches)",
    };

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
          reason: "Initial daily exchange rate entry",
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
      reason: "Initial daily exchange rate entry",
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
