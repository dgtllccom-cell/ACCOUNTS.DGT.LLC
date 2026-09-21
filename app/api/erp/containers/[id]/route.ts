import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

const TEXT = ["container_number", "container_type", "seal_number", "status", "remarks"];

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        select c.*, w.warehouse_name as warehouse_name, country.name as country_name
        from public.containers c
        left join public.warehouses w on w.id = c.warehouse_id
        left join public.countries country on country.id = c.country_id
        where c.id = ${id}::uuid and c.deleted_at is null
        limit 1
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Container not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "read",
      countryId: (data as any).country_id,
      countryBranchId: (data as any).country_branch_id,
      cityBranchId: (data as any).city_branch_id
    });

    return NextResponse.json({ container: data });
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
      const rows = await sql`select country_id, country_branch_id, city_branch_id from public.containers where id = ${id}::uuid and deleted_at is null limit 1`;
      return rows[0];
    });
    if (!existing) return NextResponse.json({ error: "Container not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "update",
      countryId: (existing as any).country_id,
      countryBranchId: (existing as any).country_branch_id,
      cityBranchId: (existing as any).city_branch_id
    });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of TEXT) if (body[f] !== undefined) patch[f] = body[f] === "" || body[f] === null ? null : String(body[f]).trim();
    if (body.warehouse_id !== undefined) patch.warehouse_id = body.warehouse_id || null;

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.containers set ${sql(patch as any)}
        where id = ${id}::uuid and deleted_at is null
        returning id, container_number, container_type, seal_number, warehouse_id,
                  status, country_id, country_branch_id, city_branch_id, remarks,
                  created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Container not found." }, { status: 404 });
    return NextResponse.json({ container: data });
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
      const rows = await sql`select country_id, country_branch_id, city_branch_id from public.containers where id = ${id}::uuid and deleted_at is null limit 1`;
      return rows[0];
    });
    if (!existing) return NextResponse.json({ error: "Container not found." }, { status: 404 });

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: "delete",
      countryId: (existing as any).country_id,
      countryBranchId: (existing as any).country_branch_id,
      cityBranchId: (existing as any).city_branch_id
    });

    await withLocalPg(async (sql) => {
      await sql`update public.containers set deleted_at = now(), updated_at = now() where id = ${id}::uuid`;
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
