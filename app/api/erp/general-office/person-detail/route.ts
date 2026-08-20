/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Real linked-record detail for a selected Person Master (customer id): the linked user/login
 * profile, its active role assignments, and any documents attached to the person. Everything is
 * REAL — sections with no linked record come back empty so the wizard can show honest states.
 */
export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) return apiOk({ found: false });

    const data = await withLocalPg(async (sql) => {
      const [profile] = await sql`
        select id, user_code, full_name, first_name, last_name, preferred_language_code, employee_id
        from profiles
        where (person_master_id = ${id} or id = ${id}) and deleted_at is null
        limit 1`;

      let roles: any[] = [];
      if (profile) {
        roles = await sql`
          select ura.role, ura.is_active, co.name country_name, cb.name main_branch_name, cib.name city_branch_name
          from user_role_assignments ura
          left join countries co on co.id = ura.country_id
          left join country_branches cb on cb.id = ura.country_branch_id
          left join city_branches cib on cib.id = ura.city_branch_id
          where ura.user_id = ${profile.id} and ura.deleted_at is null
          order by ura.is_active desc`;
      }

      const docs = await sql`
        select path, mime_type, size_bytes, created_at
        from attachments
        where owner_table = 'customers' and owner_id = ${id} and deleted_at is null
        order by created_at asc`;

      return { profile: profile || null, roles, docs };
    });

    if (!data) return apiOk({ found: false });
    const { profile, roles, docs } = data as any;

    return apiOk({
      found: true,
      user: profile ? {
        userCode: profile.user_code || "",
        fullName: profile.full_name || "",
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        language: profile.preferred_language_code || "",
        hasLogin: true
      } : null,
      roles: (roles as any[]).map((r) => ({
        role: r.role,
        active: r.is_active,
        scope: [r.country_name, r.main_branch_name, r.city_branch_name].filter(Boolean).join(" / ")
      })),
      documents: (docs as any[]).map((d) => ({
        name: String(d.path || "").split("/").pop() || d.path,
        mime: d.mime_type || "",
        size: Number(d.size_bytes || 0)
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
