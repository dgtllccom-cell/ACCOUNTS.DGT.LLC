import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const event = await withLocalPg(async (sql) => {
      const rows = await sql`
        select e.*, c.container_number, w.warehouse_name as warehouse_name
        from public.cross_stuffing_events e
        left join public.containers c on c.id = e.container_id
        left join public.warehouses w on w.id = e.warehouse_id
        where e.id = ${id}::uuid and e.deleted_at is null
        limit 1
      `;
      return rows[0];
    });
    if (!event) return NextResponse.json({ error: "Cross-stuffing event not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "read",
      countryId: (event as any).country_id,
      countryBranchId: (event as any).country_branch_id,
      cityBranchId: (event as any).city_branch_id
    });

    const lines = await withLocalPg(async (sql) => {
      return sql`
        select l.*, t.truck_number, t.driver_name, g.goods_name, gv.size, gv.brand
        from public.cross_stuffing_lines l
        left join public.trucks t on t.id = l.source_truck_id
        left join public.goods g on g.id = l.goods_id
        left join public.goods_variations gv on gv.id = l.goods_variation_id
        where l.event_id = ${id}::uuid
        order by l.created_at asc
      `;
    });

    return NextResponse.json({ event: { ...(event as any), lines: lines || [] } });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const body = await req.json();

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`select country_id, country_branch_id, city_branch_id from public.cross_stuffing_events where id = ${id}::uuid and deleted_at is null limit 1`;
      return rows[0];
    });
    if (!existing) return NextResponse.json({ error: "Cross-stuffing event not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "update",
      countryId: (existing as any).country_id,
      countryBranchId: (existing as any).country_branch_id,
      cityBranchId: (existing as any).city_branch_id
    });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined && ["draft", "completed", "reversed"].includes(body.status)) patch.status = body.status;
    if (body.remarks !== undefined) patch.remarks = body.remarks || null;
    if (body.warehouse_id !== undefined) patch.warehouse_id = body.warehouse_id || null;
    if (body.event_date !== undefined) patch.event_date = body.event_date || null;

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.cross_stuffing_events set ${sql(patch as any)}
        where id = ${id}::uuid and deleted_at is null
        returning id, container_id, warehouse_id, event_date, status, remarks,
                  country_id, country_branch_id, city_branch_id, created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Cross-stuffing event not found." }, { status: 404 });
    return NextResponse.json({ event: data });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`select country_id, country_branch_id, city_branch_id from public.cross_stuffing_events where id = ${id}::uuid and deleted_at is null limit 1`;
      return rows[0];
    });
    if (!existing) return NextResponse.json({ error: "Cross-stuffing event not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "delete",
      countryId: (existing as any).country_id,
      countryBranchId: (existing as any).country_branch_id,
      cityBranchId: (existing as any).city_branch_id
    });

    await withLocalPg(async (sql) => {
      await sql`update public.cross_stuffing_events set deleted_at = now(), updated_at = now() where id = ${id}::uuid`;
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
