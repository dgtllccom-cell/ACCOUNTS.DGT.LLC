import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { shippingBlRecordCreateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(300).default(100)
});

type Session = Awaited<ReturnType<typeof requireErpSession>>;

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function withTimeout<T>(query: PromiseLike<QueryResult<T>>, label: string, ms = 7000): Promise<QueryResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve(query),
      new Promise<QueryResult<T>>((resolve) => {
        timeout = setTimeout(() => resolve({ data: [], error: { message: `${label} timed out` } }), ms);
      })
    ]);
  } catch (error) {
    return {
      data: [],
      error: { message: error instanceof Error ? error.message : `${label} failed` }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function emptyShippingPayload(session: Session, message?: string) {
  return {
    records: [],
    filters: {
      countries: [],
      countryBranches: [],
      cityBranches: [],
      ledgers: []
    },
    setupRequired: Boolean(message),
    setupMessage: message,
    session: {
      isSuperAdmin: session.isSuperAdmin,
      userId: session.userId,
      fullName: session.fullName,
      roles: session.roles,
      countryIds: session.countryIds,
      countryBranchIds: session.countryBranchIds,
      cityBranchIds: session.cityBranchIds
    }
  };
}

async function resolveEffectiveScope(input: {
  session: Session;
  requested: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null };
}) {
  const { session, requested } = input;
  const effectiveCityBranchId = requested.cityBranchId || session.cityBranchIds[0] || null;
  
  if (effectiveCityBranchId) {
    const supabase = createSupabaseAdminClient() as any;
    const row = await requireSupabaseData(
      supabase
        .from("city_branches")
        .select("id, country_id, country_branch_id")
        .eq("id", effectiveCityBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? requested.countryId ?? session.countryIds[0] ?? null,
      countryBranchId: (row as any)?.country_branch_id ?? requested.countryBranchId ?? session.countryBranchIds[0] ?? null,
      cityBranchId: effectiveCityBranchId
    };
  }

  const effectiveCountryBranchId = requested.countryBranchId || session.countryBranchIds[0] || null;
  if (effectiveCountryBranchId) {
    const supabase = createSupabaseAdminClient() as any;
    const row = await requireSupabaseData(
      supabase
        .from("country_branches")
        .select("id, country_id")
        .eq("id", effectiveCountryBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? requested.countryId ?? session.countryIds[0] ?? null,
      countryBranchId: effectiveCountryBranchId,
      cityBranchId: null
    };
  }

  return {
    countryId: requested.countryId || session.countryIds[0] || null,
    countryBranchId: null,
    cityBranchId: null
  };
}

async function loadFilterOptions(session: Session) {
  let supabase: any;
  try {
    supabase = createSupabaseAdminClient() as any;
  } catch {
    return { countries: [], countryBranches: [], cityBranches: [], ledgers: [] };
  }

  let countriesQuery = supabase
    .from("countries")
    .select("id, name, iso2, iso3, currency_code")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (!session.isSuperAdmin) countriesQuery = countriesQuery.in("id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);

  let countryBranchesQuery = supabase
    .from("country_branches")
    .select("id, country_id, name, code, local_currency, status")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (!session.isSuperAdmin && session.countryIds.length) countryBranchesQuery = countryBranchesQuery.in("country_id", session.countryIds);

  let cityBranchesQuery = supabase
    .from("city_branches")
    .select("id, country_id, country_branch_id, city_name, name, code, local_currency, status")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (!session.isSuperAdmin && session.cityBranchIds.length) cityBranchesQuery = cityBranchesQuery.in("id", session.cityBranchIds);
  else if (!session.isSuperAdmin && session.countryBranchIds.length) cityBranchesQuery = cityBranchesQuery.in("country_branch_id", session.countryBranchIds);
  else if (!session.isSuperAdmin && session.countryIds.length) cityBranchesQuery = cityBranchesQuery.in("country_id", session.countryIds);

  let ledgersQuery = supabase
    .from("ledgers")
    .select("id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, code, name, currency, current_balance, is_active")
    .is("deleted_at", null)
    .order("code", { ascending: true });
  if (!session.isSuperAdmin && session.countryIds.length) ledgersQuery = ledgersQuery.in("country_id", session.countryIds);

  const [countries, countryBranches, cityBranches, ledgers] = await Promise.all([
    withTimeout<any>(countriesQuery.limit(20), "countries"),
    withTimeout<any>(countryBranchesQuery.limit(500), "country branches"),
    withTimeout<any>(cityBranchesQuery.limit(1000), "city branches"),
    withTimeout<any>(ledgersQuery.limit(500), "ledgers")
  ]);

  const ledgerRows = ledgers.error ? [] : ledgers.data ?? [];
  const accountIds = [
    ...new Set(
      ledgerRows
        .map((row: any) => row.enterprise_account_id)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    )
  ];
  const accountRes = accountIds.length
    ? await withTimeout<any>(
        supabase
          .from("enterprise_accounts")
          .select("id, account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number, name, currency, current_balance")
          .in("id", accountIds)
          .is("deleted_at", null),
        "ledger accounts"
      )
    : { data: [], error: null };
  const accountById = new Map(((accountRes.data ?? []) as any[]).map((row) => [row.id, row] as const));
  const enrichedLedgers = ledgerRows.map((row: any) => {
    const account = row.enterprise_account_id ? accountById.get(row.enterprise_account_id) : null;
    return {
      ...row,
      account_number: account?.account_number ?? row.code,
      manual_reference_number: account?.manual_reference_number ?? null,
      customer_number: account?.customer_number ?? null,
      country_serial_number: account?.country_serial_number ?? null,
      branch_serial_number: account?.branch_serial_number ?? null,
      account_name: account?.name ?? row.name,
      account_currency: account?.currency ?? row.currency,
      account_balance: account?.current_balance ?? row.current_balance
    };
  });

  return {
    countries: countries.error ? [] : countries.data ?? [],
    countryBranches: countryBranches.error ? [] : countryBranches.data ?? [],
    cityBranches: cityBranches.error ? [] : cityBranches.data ?? [],
    ledgers: enrichedLedgers
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    let supabase: any;
    try {
      supabase = createSupabaseAdminClient() as any;
    } catch (error) {
      return apiOk(emptyShippingPayload(session, error instanceof Error ? error.message : "Shipping data source unavailable"));
    }
    let recordsQuery = supabase
      .from("shipping_bl_records")
      .select(
        "id, country_id, country_branch_id, city_branch_id, shipping_line_name, bl_number, container_number, vessel_name, voyage_number, loading_port, discharge_port, eta, etd, shipment_status, account_number, debit, credit, currency_code, purchase_order_id, sales_order_id, loading_record_id, roznamcha_entry_id, ledger_id, created_at, countries(name, iso2, currency_code), country_branches(name, code), city_branches(name, code, city_name), ledgers(code, name, currency), profiles(full_name)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (query.countryId) recordsQuery = recordsQuery.eq("country_id", query.countryId);
    else if (!session.isSuperAdmin) recordsQuery = recordsQuery.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
    if (query.countryBranchId) recordsQuery = recordsQuery.eq("country_branch_id", query.countryBranchId);
    if (query.cityBranchId) recordsQuery = recordsQuery.eq("city_branch_id", query.cityBranchId);
    if (query.q) {
      const like = `%${query.q}%`;
      recordsQuery = (recordsQuery as any).or(
        `shipping_line_name.ilike.${like},bl_number.ilike.${like},container_number.ilike.${like},vessel_name.ilike.${like},account_number.ilike.${like}`
      );
    }

    const [recordsResult, filters] = await Promise.all([withTimeout<any>(recordsQuery.limit(query.limit), "shipping records"), loadFilterOptions(session)]);

    if (recordsResult.error) {
      const message = recordsResult.error.message ?? "";
      if (message.includes("shipping_bl_records") && message.includes("schema cache")) {
        return apiOk({
          records: [],
          filters,
          setupRequired: true,
          setupMessage: "shipping_bl_records table is not available yet. Apply supabase/migrations/0017_shipping_bl_records.sql.",
          session: {
            isSuperAdmin: session.isSuperAdmin,
            userId: session.userId,
            fullName: session.fullName,
            roles: session.roles,
            countryIds: session.countryIds,
            countryBranchIds: session.countryBranchIds,
            cityBranchIds: session.cityBranchIds
          }
        });
      }
      return apiOk({
        ...emptyShippingPayload(session, message || "Shipping records are temporarily unavailable."),
        filters
      });
    }

    return apiOk({
      records: recordsResult.data ?? [],
      filters,
      session: {
        isSuperAdmin: session.isSuperAdmin,
        userId: session.userId,
        fullName: session.fullName,
        roles: session.roles,
        countryIds: session.countryIds,
        countryBranchIds: session.countryBranchIds,
        cityBranchIds: session.cityBranchIds
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = shippingBlRecordCreateSchema.parse(await request.json());
    const scope = await resolveEffectiveScope({
      session,
      requested: {
        countryId: body.countryId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null
      }
    });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "create",
      countryId: scope.countryId,
      countryBranchId: scope.countryBranchId,
      cityBranchId: scope.cityBranchId
    });

    const supabase = createSupabaseAdminClient() as any;
    const payload = {
      country_id: scope.countryId,
      country_branch_id: scope.countryBranchId,
      city_branch_id: scope.cityBranchId,
      purchase_order_id: body.purchaseOrderId ?? null,
      sales_order_id: body.salesOrderId ?? null,
      loading_record_id: body.loadingRecordId ?? null,
      roznamcha_entry_id: body.roznamchaEntryId ?? null,
      ledger_id: body.ledgerId ?? null,
      created_by: session.userId,
      shipping_line_name: body.shippingLineName,
      bl_number: body.blNumber,
      container_number: body.containerNumber ?? null,
      vessel_name: body.vesselName ?? null,
      voyage_number: body.voyageNumber ?? null,
      loading_port: body.loadingPort ?? null,
      discharge_port: body.dischargePort ?? null,
      eta: body.eta ?? null,
      etd: body.etd ?? null,
      shipment_status: body.shipmentStatus,
      account_number: body.accountNumber ?? null,
      debit: body.debit,
      credit: body.credit,
      currency_code: body.currencyCode,
      report_payload: body.reportPayload ?? {}
    };

    const inserted = await requireSupabaseData(
      supabase.from("shipping_bl_records").insert(payload).select("id, bl_number").single()
    );

    await writeAuditLog({
      action: "shipping_bl_records.create",
      entityTable: "shipping_bl_records",
      entityId: (inserted as any).id ?? null,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiCreated({ recordId: (inserted as any).id, blNumber: (inserted as any).bl_number });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const {
      id,
      shippingLineName,
      blNumber,
      containerNumber,
      vesselName,
      voyageNumber,
      loadingPort,
      dischargePort,
      eta,
      etd,
      shipmentStatus,
      remarks
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: { message: "Record ID is required" } }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient() as any;

    // Fetch old record for audit
    const { data: before, error: fetchError } = await supabase
      .from("shipping_bl_records")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !before) {
      return NextResponse.json({ ok: false, error: { message: "Record not found" } }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "update",
      countryId: before.country_id,
      countryBranchId: before.country_branch_id,
      cityBranchId: before.city_branch_id
    });

    const reportPayload = before.report_payload || {};
    const updatedReportPayload = {
      ...reportPayload,
      carrierRemarks: remarks || reportPayload.carrierRemarks || null
    };

    const payload = {
      shipping_line_name: shippingLineName !== undefined ? shippingLineName : before.shipping_line_name,
      bl_number: blNumber !== undefined ? blNumber : before.bl_number,
      container_number: containerNumber !== undefined ? containerNumber : before.container_number,
      vessel_name: vesselName !== undefined ? vesselName : before.vessel_name,
      voyage_number: voyageNumber !== undefined ? voyageNumber : before.voyage_number,
      loading_port: loadingPort !== undefined ? loadingPort : before.loading_port,
      discharge_port: dischargePort !== undefined ? dischargePort : before.discharge_port,
      eta: eta !== undefined ? eta : before.eta,
      etd: etd !== undefined ? etd : before.etd,
      shipment_status: shipmentStatus !== undefined ? shipmentStatus : before.shipment_status,
      report_payload: updatedReportPayload,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error: updateError } = await supabase
      .from("shipping_bl_records")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: { message: updateError.message } }, { status: 400 });
    }

    await writeAuditLog({
      action: "shipping_bl_records.update",
      entityTable: "shipping_bl_records",
      entityId: id,
      before,
      after: updated,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ record: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

