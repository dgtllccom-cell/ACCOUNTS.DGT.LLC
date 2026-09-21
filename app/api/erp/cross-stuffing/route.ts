import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/**
 * Cross-Stuffing (Shipping / Clearing -> Cross-Stuffing). Table:
 * cross_stuffing_events + cross_stuffing_lines (migration
 * 20260921_container_master_and_cross_stuffing.sql). One event = one physical
 * transfer of goods from N trucks into a container at a warehouse; each line
 * is a truck -> goods -> quantity breakdown. Reuses trucks/warehouses/goods/
 * goods_variations/containers — no duplicate masters.
 */
type LineInput = {
  source_truck_id?: string | null;
  source_truck_loading_id?: string | null;
  goods_id?: string | null;
  goods_variation_id?: string | null;
  quantity: number | string;
  unit?: string | null;
  remarks?: string | null;
};

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const containerId = searchParams.get("containerId");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select e.id, e.container_id, e.warehouse_id, e.event_date, e.status, e.remarks,
               e.country_id, e.country_branch_id, e.city_branch_id, e.created_at, e.updated_at,
               c.container_number, w.warehouse_name as warehouse_name,
               coalesce(line_totals.line_count, 0) as line_count,
               coalesce(line_totals.total_quantity, 0) as total_quantity
        from public.cross_stuffing_events e
        left join public.containers c on c.id = e.container_id
        left join public.warehouses w on w.id = e.warehouse_id
        left join lateral (
          select count(*) as line_count, sum(l.quantity) as total_quantity
          from public.cross_stuffing_lines l
          where l.event_id = e.id
        ) line_totals on true
        where e.deleted_at is null
          and (${containerId ? sql`e.container_id = ${containerId}::uuid` : sql`true`})
        order by e.created_at desc
        limit ${limit}
      `;
    });

    return NextResponse.json({ events: rows || [] });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();

    const containerId = typeof body.container_id === "string" ? body.container_id.trim() : "";
    if (!containerId) return NextResponse.json({ error: "container_id is required" }, { status: 400 });

    const lines: LineInput[] = Array.isArray(body.lines) ? body.lines : [];
    const validLines = lines.filter((l) => Number(l.quantity) > 0);
    if (validLines.length === 0) {
      return NextResponse.json({ error: "At least one goods line with a quantity greater than zero is required." }, { status: 400 });
    }

    const countryId = body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.country_branch_id ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.city_branch_id ?? session.cityBranchIds?.[0] ?? null;

    const data = await withLocalPg(async (sql) => {
      return sql.begin(async (tx) => {
        const eventRows = await tx`
          insert into public.cross_stuffing_events (
            container_id, warehouse_id, event_date, status, country_id, country_branch_id,
            city_branch_id, remarks, created_by
          ) values (
            ${containerId}::uuid, ${body.warehouse_id || null}, ${body.event_date || new Date().toISOString().slice(0, 10)},
            ${body.status && ["draft", "completed", "reversed"].includes(body.status) ? body.status : "draft"},
            ${countryId}, ${countryBranchId}, ${cityBranchId}, ${body.remarks || null}, ${session.userId}
          )
          returning id, container_id, warehouse_id, event_date, status, remarks,
                    country_id, country_branch_id, city_branch_id, created_at, updated_at
        `;
        const event = eventRows[0];

        const insertedLines = [];
        for (const line of validLines) {
          const lineRows = await tx`
            insert into public.cross_stuffing_lines (
              event_id, source_truck_id, source_truck_loading_id, goods_id, goods_variation_id,
              quantity, unit, remarks
            ) values (
              ${event.id}, ${line.source_truck_id || null}, ${line.source_truck_loading_id || null},
              ${line.goods_id || null}, ${line.goods_variation_id || null},
              ${Number(line.quantity)}, ${line.unit || null}, ${line.remarks || null}
            )
            returning id, event_id, source_truck_id, source_truck_loading_id, goods_id, goods_variation_id, quantity, unit, remarks
          `;
          insertedLines.push(lineRows[0]);
        }

        return { ...event, lines: insertedLines };
      });
    });

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
