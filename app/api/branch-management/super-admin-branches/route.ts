import { NextResponse } from "next/server";
import { createSuperAdminBranchSchema } from "@/features/branch-management/validation";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ superAdminBranches: [] }, { status: 200 });
    }

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          b.id, b.company_id, b.name, b.code, b.country_id, b.state_province_id, b.district_id, b.city_id,
          b.currency, b.address, b.phone, b.email, b.owner_name, b.owner_customer_id, b.owner_profile_id,
          b.contacts, b.documents, b.created_at,
          row_to_json(c) as companies,
          row_to_json(cnt) as countries,
          row_to_json(sp) as states_provinces,
          row_to_json(d) as districts,
          row_to_json(ct) as cities
        from public.branches b
        left join public.companies c on c.id = b.company_id
        left join public.countries cnt on cnt.id = b.country_id
        left join public.states_provinces sp on sp.id = b.state_province_id
        left join public.districts d on d.id = b.district_id
        left join public.cities ct on ct.id = b.city_id
        where b.is_super_admin = true
          and b.deleted_at is null
          and (${companyId && isUuid(companyId) ? sql`b.company_id = ${companyId}::uuid` : sql`true`})
        order by b.created_at desc
      `;
      return rows;
    });

    if (viaPg) {
      return NextResponse.json({ superAdminBranches: viaPg }, { status: 200 });
    }

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("branches")
      .select(
        "id,company_id,name,code,country_id,state_province_id,district_id,city_id,currency,address,phone,email,owner_name,owner_customer_id,owner_profile_id,contacts,documents,created_at,companies(name),countries(name),states_provinces(name),districts(name),cities(name)"
      )
      .eq("is_super_admin", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (companyId && isUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    return NextResponse.json({ superAdminBranches: data ?? [] }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can create the Super Admin Branch." }, { status: 403 });
    }

    const parsed = createSuperAdminBranchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
      company_id: parsed.data.companyId,
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
      is_active: true,
      is_super_admin: true,
      country_id: parsed.data.countryId ?? null,
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      currency: parsed.data.currencyCode ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email?.trim() ? parsed.data.email.trim().toLowerCase() : null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      owner_customer_id: parsed.data.ownerCustomerId ?? null,
      owner_profile_id: parsed.data.ownerProfileId ?? null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let insertedId: string | null = null;
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.branches (
          company_id, name, code, is_active, is_super_admin,
          country_id, state_province_id, district_id, city_id, currency,
          address, phone, email, owner_name, owner_customer_id, owner_profile_id,
          contacts, documents, created_at, updated_at
        ) values (
          ${payload.company_id}::uuid,
          ${payload.name},
          ${payload.code},
          ${payload.is_active},
          ${payload.is_super_admin},
          ${payload.country_id ? payload.country_id : null}::uuid,
          ${payload.state_province_id ? payload.state_province_id : null}::uuid,
          ${payload.district_id ? payload.district_id : null}::uuid,
          ${payload.city_id ? payload.city_id : null}::uuid,
          ${payload.currency},
          ${payload.address},
          ${payload.phone},
          ${payload.email},
          ${payload.owner_name},
          ${payload.owner_customer_id ? payload.owner_customer_id : null}::uuid,
          ${payload.owner_profile_id ? payload.owner_profile_id : null}::uuid,
          ${JSON.stringify(payload.contacts)}::jsonb,
          ${JSON.stringify(payload.documents)}::jsonb,
          ${payload.created_at},
          ${payload.updated_at}
        )
        returning id
      `;
      return rows[0]?.id ?? null;
    });

    if (viaPg) {
      insertedId = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase.from("branches").insert(payload).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 403 });
      insertedId = data?.id ?? null;
    }

    await auditApiAction(request as any, {
      action: "super_admin_branches.create.api",
      entityTable: "branches",
      entityId: insertedId,
      after: payload
    });

    return NextResponse.json({ id: insertedId }, { status: 201 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can update the Super Admin Branch." }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Valid branch id is required." }, { status: 400 });
    }

    const parsed = createSuperAdminBranchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
      company_id: parsed.data.companyId,
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
      is_active: true,
      is_super_admin: true,
      country_id: parsed.data.countryId ?? null,
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      currency: parsed.data.currencyCode ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email?.trim() ? parsed.data.email.trim().toLowerCase() : null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      owner_customer_id: parsed.data.ownerCustomerId ?? null,
      owner_profile_id: parsed.data.ownerProfileId ?? null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      updated_at: new Date().toISOString()
    };

    let updatedId: string | null = null;
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.branches
        set
          company_id = ${payload.company_id}::uuid,
          name = ${payload.name},
          code = ${payload.code},
          is_active = ${payload.is_active},
          is_super_admin = ${payload.is_super_admin},
          country_id = ${payload.country_id ? payload.country_id : null}::uuid,
          state_province_id = ${payload.state_province_id ? payload.state_province_id : null}::uuid,
          district_id = ${payload.district_id ? payload.district_id : null}::uuid,
          city_id = ${payload.city_id ? payload.city_id : null}::uuid,
          currency = ${payload.currency},
          address = ${payload.address},
          phone = ${payload.phone},
          email = ${payload.email},
          owner_name = ${payload.owner_name},
          owner_customer_id = ${payload.owner_customer_id ? payload.owner_customer_id : null}::uuid,
          owner_profile_id = ${payload.owner_profile_id ? payload.owner_profile_id : null}::uuid,
          contacts = ${JSON.stringify(payload.contacts)}::jsonb,
          documents = ${JSON.stringify(payload.documents)}::jsonb,
          updated_at = ${payload.updated_at}
        where id = ${id}::uuid and is_super_admin = true and deleted_at is null
        returning id
      `;
      return rows[0]?.id ?? null;
    });

    if (viaPg) {
      updatedId = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("branches")
        .update(payload)
        .eq("id", id)
        .eq("is_super_admin", true)
        .is("deleted_at", null)
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 403 });
      updatedId = data?.id ?? null;
    }

    await auditApiAction(request as any, {
      action: "super_admin_branches.update.api",
      entityTable: "branches",
      entityId: updatedId ?? id,
      after: payload
    });

    return NextResponse.json({ id: updatedId ?? id }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
