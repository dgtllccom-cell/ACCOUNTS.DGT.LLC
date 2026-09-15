import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ERP_MODULE_DEFINITIONS } from "@/lib/permissions/rbac-matrix-builder";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

const branchRulesPayloadSchema = z.object({
  scopeType: z.enum(["country", "country_branch", "city_branch"]),
  scopeId: z.string().uuid(),
  allowedDomains: z.array(z.string()).default(["business"]),
  permissions: z.array(z.string()).default([]),
  deniedPermissions: z.array(z.string()).default([]),
  moduleAccess: z.record(z.string(), z.record(z.string(), z.boolean())).default({})
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get("scopeType") as "country" | "country_branch" | "city_branch" | null;
    const scopeId = searchParams.get("scopeId");

    if (!scopeType || !scopeId) {
      return NextResponse.json({ error: "scopeType and scopeId are required" }, { status: 400 });
    }

    const response = await withLocalPg(async (sql) => {
      // 1. Resolve hierarchy parents
      let countryId: string | null = null;
      let countryBranchId: string | null = null;
      let cityBranchId: string | null = null;
      let scopeName = "";

      if (scopeType === "country") {
        countryId = scopeId;
        const [c] = await sql`select name from countries where id = ${countryId}::uuid and deleted_at is null limit 1`;
        scopeName = c?.name || "Country";
      } else if (scopeType === "country_branch") {
        countryBranchId = scopeId;
        const [b] = await sql`select name, country_id from country_branches where id = ${countryBranchId}::uuid and deleted_at is null limit 1`;
        scopeName = b?.name || "Main Branch";
        countryId = b?.country_id || null;
      } else if (scopeType === "city_branch") {
        cityBranchId = scopeId;
        const [cb] = await sql`select name, city_name, country_branch_id, country_id from city_branches where id = ${cityBranchId}::uuid and deleted_at is null limit 1`;
        scopeName = cb ? `${cb.city_name || ""} - ${cb.name}` : "City Branch";
        countryBranchId = cb?.country_branch_id || null;
        countryId = cb?.country_id || null;
      }

      // 2. Fetch all rules in this chain
      const scopeIds: string[] = [];
      if (countryId) scopeIds.push(countryId);
      if (countryBranchId) scopeIds.push(countryBranchId);
      if (cityBranchId) scopeIds.push(cityBranchId);

      const rulesRows = scopeIds.length > 0
        ? await sql`
            select scope_type, scope_id, allowed_domains, permissions, denied_permissions, module_access
            from branch_rules
            where scope_id = any(${scopeIds}::uuid[])
          `
        : [];

      const rulesMap = new Map<string, any>();
      rulesRows.forEach((r: any) => {
        rulesMap.set(`${r.scope_type}:${r.scope_id}`, r);
      });

      // Country rule
      const countryRule = countryId ? rulesMap.get(`country:${countryId}`) : null;
      // Main branch rule
      const mainBranchRule = countryBranchId ? rulesMap.get(`country_branch:${countryBranchId}`) : null;
      // Current scope rule
      const currentRule = rulesMap.get(`${scopeType}:${scopeId}`);

      // 3. Compute baseline inherited permissions
      // Country inherits country_admin default role perms unless overridden
      const baseCountryPerms = new Set<string>(
        countryRule?.permissions?.length > 0
          ? countryRule.permissions
          : enterpriseRolePermissions.country_admin ?? []
      );
      // Remove country denied
      (countryRule?.denied_permissions ?? []).forEach((p: string) => baseCountryPerms.delete(p));

      // Main branch inherits from Country
      const baseMainBranchPerms = new Set<string>(baseCountryPerms);
      if (mainBranchRule) {
        (mainBranchRule.permissions ?? []).forEach((p: string) => baseMainBranchPerms.add(p));
        (mainBranchRule.denied_permissions ?? []).forEach((p: string) => baseMainBranchPerms.delete(p));
      }

      // Determine inherited set for the requested scope
      let inheritedPerms: Set<string>;
      let inheritedDenied: Set<string>;
      if (scopeType === "country") {
        inheritedPerms = new Set(enterpriseRolePermissions.country_admin ?? []);
        inheritedDenied = new Set();
      } else if (scopeType === "country_branch") {
        inheritedPerms = baseCountryPerms;
        inheritedDenied = new Set(countryRule?.denied_permissions ?? []);
      } else {
        // city branch
        inheritedPerms = baseMainBranchPerms;
        inheritedDenied = new Set([
          ...(countryRule?.denied_permissions ?? []),
          ...(mainBranchRule?.denied_permissions ?? [])
        ]);
      }

      // Current explicit rules
      const customPerms = new Set<string>(currentRule?.permissions ?? []);
      const explicitlyDenied = new Set<string>(currentRule?.denied_permissions ?? []);

      // Effective permissions
      const effectivePerms = new Set<string>(inheritedPerms);
      customPerms.forEach((p) => effectivePerms.add(p));
      explicitlyDenied.forEach((p) => effectivePerms.delete(p));
      inheritedDenied.forEach((p) => effectivePerms.delete(p));

      // Resolve module capabilities status
      const moduleMatrix = ERP_MODULE_DEFINITIONS.map((mod) => {
        const checkAction = (perms: string[]) => {
          if (!perms.length) return { status: "none", allowed: false };
          const hasInherited = perms.some((p) => inheritedPerms.has(p) || inheritedPerms.has("*:*"));
          const isDenied = perms.some((p) => explicitlyDenied.has(p) || inheritedDenied.has(p) || explicitlyDenied.has(`${p.split(":")[0]}:*`));
          const isCustom = perms.some((p) => customPerms.has(p) || customPerms.has(`${p.split(":")[0]}:*`));

          if (isDenied) return { status: "denied", allowed: false };
          if (isCustom) return { status: "custom", allowed: true };
          if (hasInherited) return { status: "inherited", allowed: true };
          return { status: "none", allowed: false };
        };

        return {
          key: mod.key,
          name: mod.name,
          category: mod.category,
          view: checkAction(mod.viewPerms),
          create: checkAction(mod.createPerms),
          edit: checkAction(mod.editPerms),
          delete: checkAction(mod.deletePerms),
          approve: checkAction(mod.approvePerms),
          export: checkAction(mod.exportPerms)
        };
      });

      return NextResponse.json({
        ok: true,
        scope: {
          scopeType,
          scopeId,
          scopeName,
          countryId,
          countryBranchId,
          cityBranchId
        },
        currentRule: currentRule || {
          scope_type: scopeType,
          scope_id: scopeId,
          allowed_domains: ["business"],
          permissions: [],
          denied_permissions: [],
          module_access: {}
        },
        inherited: {
          permissions: Array.from(inheritedPerms),
          deniedPermissions: Array.from(inheritedDenied)
        },
        customPermissions: Array.from(customPerms),
        explicitlyDenied: Array.from(explicitlyDenied),
        effectivePermissions: Array.from(effectivePerms),
        allowedDomains: currentRule?.allowed_domains ?? (scopeType === "country" ? ["business", "shipping"] : ["business"]),
        moduleMatrix
      });
    });

    return response ?? NextResponse.json({ error: "Failed to connect to database" }, { status: 503 });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message || "Failed to load branch rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can configure branch rules and permissions." }, { status: 403 });
    }

    const body = branchRulesPayloadSchema.parse(await request.json());

    const result = await withLocalPg(async (sql) => {
      const [saved] = await sql`
        insert into branch_rules (
          scope_type,
          scope_id,
          allowed_domains,
          permissions,
          denied_permissions,
          module_access,
          updated_at
        ) values (
          ${body.scopeType},
          ${body.scopeId}::uuid,
          ${body.allowedDomains}::text[],
          ${body.permissions}::text[],
          ${body.deniedPermissions}::text[],
          ${sql.json(body.moduleAccess)},
          now()
        )
        on conflict (scope_type, scope_id) do update set
          allowed_domains = excluded.allowed_domains,
          permissions = excluded.permissions,
          denied_permissions = excluded.denied_permissions,
          module_access = excluded.module_access,
          updated_at = now()
        returning *;
      `;
      return saved;
    });

    return NextResponse.json({
      ok: true,
      rule: result,
      message: "Branch rules updated successfully"
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message || "Failed to save branch rules" }, { status: 500 });
  }
}
