import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const _domain = searchParams.get("domain") || "shipping";

    const data = await withLocalPg(async (sql) => {
      // ── Branch & User details ──────────────────────────────────────────
      let branchInfo: any = null;
      if (!session.isSuperAdmin && session.cityBranchIds?.length) {
        const branchRows = (await sql`
          SELECT cb.name AS branch_name, cb.code AS branch_code,
                 cb.city_name,
                 co.name AS country_name
          FROM public.city_branches cb
          LEFT JOIN public.countries co ON co.id = cb.country_id
          WHERE cb.id = ${session.cityBranchIds[0]}
          LIMIT 1
        `) as any[];
        if (branchRows.length) branchInfo = branchRows[0];
      } else if (!session.isSuperAdmin && session.countryBranchIds?.length) {
        const branchRows = (await sql`
          SELECT cb.name AS branch_name, cb.code AS branch_code,
                 co.name AS country_name
          FROM public.country_branches cb
          LEFT JOIN public.countries co ON co.id = cb.country_id
          WHERE cb.id = ${session.countryBranchIds[0]}
          LIMIT 1
        `) as any[];
        if (branchRows.length) branchInfo = branchRows[0];
      } else if (!session.isSuperAdmin && session.countryIds?.length) {
        const countryRows = (await sql`
          SELECT name AS country_name FROM public.countries
          WHERE id = ${session.countryIds[0]} LIMIT 1
        `) as any[];
        if (countryRows.length)
          branchInfo = { branch_name: "Main Branch", country_name: countryRows[0].country_name };
      }

      // ── Build scope filter ─────────────────────────────────────────────
      const scopeFilter = session.isSuperAdmin
        ? sql``
        : session.cityBranchIds?.length
        ? sql`AND o.city_branch_id = ANY(${session.cityBranchIds})`
        : session.countryBranchIds?.length
        ? sql`AND o.country_branch_id = ANY(${session.countryBranchIds})`
        : session.countryIds?.length
        ? sql`AND o.country_id = ANY(${session.countryIds})`
        : sql``;

      // ── Shipment & Container Summary ───────────────────────────────────
      const summaryRows = (await sql`
        SELECT
          COUNT(DISTINCT o.id)::int AS total_shipments,
          COUNT(DISTINCT l.container_number) FILTER (WHERE l.container_number IS NOT NULL)::int AS total_containers,
          COUNT(DISTINCT o.id) FILTER (
            WHERE o.current_stage NOT IN ('completed','booking')
          )::int AS in_transit,
          COUNT(DISTINCT o.id) FILTER (WHERE o.current_stage = 'completed')::int AS delivered,
          COUNT(DISTINCT o.id) FILTER (WHERE o.current_stage = 'booking')::int AS pending
        FROM public.clearing_customer_orders o
        LEFT JOIN public.clearing_customer_order_legs l ON l.order_id = o.id AND l.deleted_at IS NULL
        WHERE o.deleted_at IS NULL
        ${scopeFilter}
      `) as any[];
      const summary = summaryRows[0] ?? {};

      // ── Arrived count (orders that have an "arrived" event) ───────────
      const arrivedRows = (await sql`
        SELECT COUNT(DISTINCT o.id)::int AS arrived_count
        FROM public.clearing_customer_orders o
        WHERE o.deleted_at IS NULL
          AND o.current_stage = 'destination_review'
        ${scopeFilter}
      `) as any[];
      const arrivedCount = arrivedRows[0]?.arrived_count ?? 0;

      // ── Movement by Mode (use active leg or order-level mode) ─────────
      const modeRows = (await sql`
        SELECT
          COALESCE(
            (SELECT l2.transport_mode FROM public.clearing_customer_order_legs l2
             WHERE l2.order_id = o.id AND l2.deleted_at IS NULL
             ORDER BY l2.leg_no ASC LIMIT 1),
            o.transport_mode,
            'by_sea'
          ) AS mode,
          COUNT(*)::int AS cnt
        FROM public.clearing_customer_orders o
        WHERE o.deleted_at IS NULL
        ${scopeFilter}
        GROUP BY 1
      `) as any[];

      const modeMap: Record<string, number> = {};
      for (const r of modeRows) {
        modeMap[r.mode as string] = (modeMap[r.mode as string] ?? 0) + parseInt(r.cnt ?? "0");
      }

      // ── Tracking Status Summary ────────────────────────────────────────
      const statusRows = (await sql`
        SELECT
          COUNT(*) FILTER (WHERE current_stage = 'booking')::int AS booking_confirmed,
          COUNT(*) FILTER (WHERE current_stage IN ('loading','goods_verification'))::int AS loaded_gate_in,
          COUNT(*) FILTER (WHERE current_stage IN ('shipment_bl','customs_clearing'))::int AS vessel_departed,
          COUNT(*) FILTER (
            WHERE current_stage NOT IN ('completed','booking','loading','goods_verification','shipment_bl','customs_clearing','destination_review')
          )::int AS in_transit_count,
          COUNT(*) FILTER (WHERE current_stage = 'destination_review')::int AS arrived_at_dest,
          COUNT(*) FILTER (WHERE current_stage = 'completed')::int AS delivered_count,
          COUNT(*) FILTER (
            WHERE current_stage NOT IN ('completed')
              AND updated_at < NOW() - INTERVAL '7 days'
          )::int AS delayed_pending
        FROM public.clearing_customer_orders o
        WHERE o.deleted_at IS NULL
        ${scopeFilter}
      `) as any[];
      const status = statusRows[0] ?? {};

      // ── Role label ────────────────────────────────────────────────────
      const roleLabel = session.isSuperAdmin
        ? "Super Admin"
        : session.roles?.[0]
          ? session.roles[0]
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : "ERP User";

      return {
        branchUser: {
          branchName: session.isSuperAdmin
            ? "All Branches (Global)"
            : (branchInfo?.branch_name ?? "Main Branch"),
          branchCode: session.isSuperAdmin
            ? "GLOBAL"
            : (branchInfo?.branch_code ?? branchInfo?.code ?? "—"),
          countryName: session.isSuperAdmin
            ? "All Countries"
            : (branchInfo?.country_name ?? "—"),
          cityName: branchInfo?.city_name ?? null,
          userName: session.fullName ?? session.email ?? "Unknown",
          roleLabel,
          isSuperAdmin: session.isSuperAdmin,
        },
        shipmentSummary: {
          totalShipments: summary.total_shipments ?? 0,
          totalContainers: summary.total_containers ?? 0,
          inTransit: summary.in_transit ?? 0,
          arrived: arrivedCount,
          delivered: summary.delivered ?? 0,
          pending: summary.pending ?? 0,
        },
        movementByMode: {
          byRoad: modeMap["by_road"] ?? 0,
          bySea: modeMap["by_sea"] ?? 0,
          byAir: modeMap["by_air"] ?? 0,
          byRail: modeMap["by_rail"] ?? 0,
        },
        trackingStatus: {
          bookingConfirmed: status.booking_confirmed ?? 0,
          loadedGateIn: status.loaded_gate_in ?? 0,
          vesselDeparted: status.vessel_departed ?? 0,
          inTransit: status.in_transit_count ?? 0,
          arrivedAtDestination: status.arrived_at_dest ?? 0,
          delivered: status.delivered_count ?? 0,
          delayedPending: status.delayed_pending ?? 0,
        },
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Tracking summary error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: { message: err?.message || "Failed to load tracking summary" },
      },
      { status: err?.status || 500 }
    );
  }
}
