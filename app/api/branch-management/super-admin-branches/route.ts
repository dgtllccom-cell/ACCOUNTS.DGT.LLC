import { NextResponse } from "next/server";
import { createSuperAdminBranchSchema } from "@/features/branch-management/validation";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";

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

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("branches")
      .select(
        "id,company_id,name,code,country_id,state_province_id,district_id,city_id,currency,address,phone,email,owner_name,contacts,documents,created_at,companies(name),countries(name),states_provinces(name),districts(name),cities(name)"
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

    const supabase = createSupabaseAdminClient() as any;
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
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from("branches").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    await auditApiAction(request as any, {
      action: "super_admin_branches.create.api",
      entityTable: "branches",
      entityId: data?.id ?? null,
      after: payload
    });

    return NextResponse.json({ id: data?.id }, { status: 201 });
  } catch (error) {
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

    const supabase = createSupabaseAdminClient() as any;
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
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("branches")
      .update(payload)
      .eq("id", id)
      .eq("is_super_admin", true)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    await auditApiAction(request as any, {
      action: "super_admin_branches.update.api",
      entityTable: "branches",
      entityId: data?.id ?? id,
      after: payload
    });

    return NextResponse.json({ id: data?.id ?? id }, { status: 200 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
