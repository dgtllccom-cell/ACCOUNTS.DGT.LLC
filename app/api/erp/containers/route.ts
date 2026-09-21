import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/**
 * Container Master (Settings / Shipping / Clearing -> Containers).
 * Table: containers (migration 20260921_container_master_and_cross_stuffing.sql).
 * First-class container entity shared by Shipping Line (shipping_bl_records.
 * container_id) and Clearing Agent (clearing_customer_order_legs.container_id)
 * instead of each keeping its own disconnected free-text container_number.
 *
 * withLocalPg, not the RLS-gated Supabase admin client — same root cause as
 * trucks/route.ts: the RLS WITH CHECK on containers_scope_write requires a
 * real Supabase Auth JWT via is_super_admin()/can_manage_country(), which
 * createSupabaseAdminClient() cannot provide.
 */
const TEXT = ["container_number", "container_type", "seal_number", "status", "remarks"];

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
    const searchLike = search ? `%${search}%` : null;

    const rows = await withLocalPg(async (sql) => {
      return sql`
        select c.id, c.container_number, c.container_type, c.seal_number, c.warehouse_id,
               c.status, c.country_id, c.country_branch_id, c.city_branch_id, c.remarks,
               c.created_at, c.updated_at,
               w.warehouse_name as warehouse_name,
               country.name as country_name
        from public.containers c
        left join public.warehouses w on w.id = c.warehouse_id
        left join public.countries country on country.id = c.country_id
        where c.deleted_at is null
          and (${searchLike ? sql`c.container_number ilike ${searchLike}` : sql`true`})
        order by c.created_at desc
        limit ${limit}
      `;
    });

    return NextResponse.json({ containers: rows || [] });
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

    const containerNumber = typeof body.container_number === "string" ? body.container_number.trim() : "";
    if (!containerNumber) return NextResponse.json({ error: "container_number is required" }, { status: 400 });

    const existing = await withLocalPg(async (sql) => {
      const r = await sql`
        select id, container_number, container_type, status
        from public.containers
        where deleted_at is null and lower(btrim(container_number)) = lower(${containerNumber})
        limit 1`;
      return r[0] ?? null;
    });
    if (existing) {
      return NextResponse.json(
        { error: "A container with this number already exists.", duplicate: true, container: existing },
        { status: 409 },
      );
    }

    const row: Record<string, unknown> = {
      country_id: body.country_id ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null),
      country_branch_id: body.country_branch_id ?? session.countryBranchIds?.[0] ?? null,
      city_branch_id: body.city_branch_id ?? session.cityBranchIds?.[0] ?? null,
      warehouse_id: body.warehouse_id || null,
      created_by: session.userId,
    };
    for (const f of TEXT) if (body[f] !== undefined) row[f] = body[f] === "" || body[f] === null ? null : String(body[f]).trim();
    row.container_number = containerNumber;
    if (!row.status) row.status = "active";

    const data = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.containers ${sql(row as any)}
        returning id, container_number, container_type, seal_number, warehouse_id,
                  status, country_id, country_branch_id, city_branch_id, remarks,
                  created_at, updated_at
      `;
      return rows[0];
    });

    if (!data) return NextResponse.json({ error: "Insert failed." }, { status: 500 });
    return NextResponse.json({ container: data }, { status: 201 });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
