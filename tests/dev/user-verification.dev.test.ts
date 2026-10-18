// @vitest-environment node
/**
 * DEV-ONLY per-user verification (Task C). Skipped unless DEV_USER_VERIFY=1.
 *
 *   DEV_USER_VERIFY=1 npx vitest run tests/dev/user-verification.dev.test.ts
 *
 * For EVERY profile that has a live assignment in the DEV database (READ-ONLY queries) it asks the production session resolver
 * (resolveEffectiveAccessForUser = exactly what that user's next request would be) for the effective session, then computes the
 * sidebar, the dashboard route and the direct-URL decisions with the production route policy. No cookie is issued, no password
 * is read or typed. Output: DEV_USER_VERIFY_OUT (default %TEMP%/user-verification.json), consumed by
 * scripts/dev/user-verification-report.mjs.
 */
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";

const RUN = process.env.DEV_USER_VERIFY === "1";

describe.skipIf(!RUN)("DEV per-user verification", () => {
  it("resolves every live user and checks menus / URLs / domain separation", async () => {
    // Next skips .env.local under NODE_ENV=test, so read it here (DEV worktree copy) without overriding the real environment.
    const envFile = join(process.cwd(), ".env.local");
    if (existsSync(envFile)) {
      for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
    const dbUrl = process.env.DATABASE_URL ?? "";
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    // hard guard: DEV project only, never Production
    expect(dbUrl).toContain("csesvyxxjivnkkozgopt");
    expect(dbUrl).not.toContain("inmayhrxucimxqhgseqi");
    expect(supaUrl).toContain("csesvyxxjivnkkozgopt");

    const { resolveEffectiveAccessForUser } = await import("@/lib/auth/session");
    const { evaluateRouteAccess, BUSINESS_ONLY_ROUTE_PREFIXES, SHIPPING_ONLY_ROUTE_PREFIXES } = await import("@/lib/navigation/route-policy");
    const { dashboardForRoles } = await import("@/lib/permissions/enterprise-roles");
    const { visibleMenuHrefsFor } = await import("@/components/layout/digital-dock-premium-sidebar");

    const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });
    try {
      const users = (await sql`
        select p.id, p.full_name, p.user_code, u.email,
               a.role, a.access_profile, a.operational_domain, a.ledger_visibility, a.mobile_profile,
               c.name as country, cb.name as country_branch, cib.name as city_branch, cib.operational_domain as city_branch_domain,
               a.clearing_agent_id is not null as agent_bound, a.shipping_line_id is not null as shipping_line_bound,
               ps.source as perm_source, coalesce(array_length(ps.permissions, 1), 0) as perm_count
        from public.profiles p
        join auth.users u on u.id = p.id
        join public.user_role_assignments a on a.user_id = p.id and a.deleted_at is null and a.is_active
        left join public.countries c on c.id = a.country_id
        left join public.country_branches cb on cb.id = a.country_branch_id
        left join public.city_branches cib on cib.id = a.city_branch_id
        left join public.user_permission_sets ps on ps.user_id = p.id and ps.deleted_at is null
        where p.deleted_at is null
        order by u.email
      `) as unknown as any[];

      const byUser = new Map<string, any[]>();
      for (const r of users) byUser.set(r.id, [...(byUser.get(r.id) ?? []), r]);

      const startsWith = (href: string, prefixes: readonly string[]) => {
        const p = href.split("?")[0];
        return prefixes.some((x) => p === x || p.startsWith(x + "/"));
      };

      const out: any[] = [];
      for (const [id, assigns] of byUser) {
        const a = assigns[0];
        const session = await resolveEffectiveAccessForUser(id, a.email);
        const rec: any = {
          userId: id, email: a.email, name: a.full_name, userCode: a.user_code, assignments: assigns.length,
          storedRole: a.role, accessProfile: a.access_profile, assignedDomain: a.operational_domain ?? "business",
          country: a.country, countryBranch: a.country_branch, cityBranch: a.city_branch, cityBranchDomain: a.city_branch_domain,
          agentBound: a.agent_bound, shippingLineBound: a.shipping_line_bound, permSource: a.perm_source, permCount: a.perm_count,
          issues: [] as string[],
        };
        if (!session) {
          rec.resolved = false;
          rec.issues.push("session does not resolve (revoked / no effective assignment)");
          out.push(rec);
          continue;
        }
        rec.resolved = true;
        rec.effectiveRoles = session.roles;
        rec.operationalDomains = session.operationalDomains;
        rec.isSuperAdmin = session.isSuperAdmin;
        rec.isGlobalScope = session.isGlobalScope;
        rec.canViewFinancials = session.canViewFinancials;
        rec.permissionCount = session.permissions.length;
        rec.scope = { countries: session.countryIds.length, mainBranches: session.countryBranchIds.length, cityBranches: session.cityBranchIds.length };
        rec.dashboard = dashboardForRoles(session.roles, { isSuperAdmin: session.isSuperAdmin, isShippingScoped: session.isShippingScoped });

        const ctx = { operationalDomains: session.operationalDomains, ledgerVisibility: session.ledgerVisibility, isShippingScoped: session.isShippingScoped, canViewFinancials: session.canViewFinancials };
        const menu = visibleMenuHrefsFor(session.roles, session.permissions, ctx);
        rec.menuCount = menu.length;
        rec.menuGroups = [...new Set(menu.map((h) => h.split("?")[0].split("/").slice(0, 3).join("/")))].sort();
        // reports and data-entry forms the sidebar offers (counts + the paths, for the per-user table)
        rec.reportEntries = menu.filter((h) => /\/reports?(\/|$|\?)|report/i.test(h.split("?")[0]));
        rec.formEntries = menu.filter((h) => /(new-|\/setup|registration|cash-entry|expenses-bill|customer-order|customer-bill|truck-|bl-entry|agent-entry|branch-entry)/i.test(h.split("?")[0]));

        const can = (pathname: string) =>
          evaluateRouteAccess({ pathname, permissions: session.permissions, roles: session.roles, operationalDomains: session.operationalDomains, canViewFinancials: session.canViewFinancials }).allowed;
        const probe = (prefixes: readonly string[]) => prefixes.filter((p) => can(p));
        const domains = session.operationalDomains;
        const businessOnly = !session.isSuperAdmin && domains.includes("business") && !domains.includes("shipping") && !domains.includes("both");
        const shippingOnly = !session.isSuperAdmin && domains.includes("shipping") && !domains.includes("business") && !domains.includes("both");
        rec.domainClass = session.isSuperAdmin ? "global" : businessOnly ? "business" : shippingOnly ? "shipping" : "both";
        rec.urlCheck = {
          shippingUrlsOpen: probe(SHIPPING_ONLY_ROUTE_PREFIXES),
          businessUrlsOpen: probe(BUSINESS_ONLY_ROUTE_PREFIXES),
        };
        rec.menuLeak = {
          shippingEntriesInBusinessMenu: businessOnly ? menu.filter((h) => startsWith(h, SHIPPING_ONLY_ROUTE_PREFIXES)) : [],
          businessEntriesInShippingMenu: shippingOnly ? menu.filter((h) => startsWith(h, BUSINESS_ONLY_ROUTE_PREFIXES)) : [],
        };

        // ---- findings -------------------------------------------------------------------------------------------
        if (businessOnly && rec.urlCheck.shippingUrlsOpen.length) rec.issues.push(`Business login can open Shipping URLs: ${rec.urlCheck.shippingUrlsOpen.join(", ")}`);
        if (shippingOnly && rec.urlCheck.businessUrlsOpen.length) rec.issues.push(`Shipping login can open Business URLs: ${rec.urlCheck.businessUrlsOpen.join(", ")}`);
        if (rec.menuLeak.shippingEntriesInBusinessMenu.length) rec.issues.push("Shipping entries in a Business menu");
        if (rec.menuLeak.businessEntriesInShippingMenu.length) rec.issues.push("Business entries in a Shipping menu");
        for (const as of assigns) {
          const ad = as.operational_domain ?? "business";
          const bd = as.city_branch_domain;
          if (as.city_branch && bd && ad !== "both" && bd !== "both" && ad !== bd) {
            rec.issues.push(`Assignment domain '${ad}' contradicts its branch '${as.city_branch}' (branch domain '${bd}')`);
          }
        }
        out.push(rec);
      }

      writeFileSync(process.env.DEV_USER_VERIFY_OUT || join(process.env.TEMP || ".", "user-verification.json"), JSON.stringify(out, null, 2));
      // eslint-disable-next-line no-console
      console.log(`verified ${out.length} users; with issues: ${out.filter((r) => r.issues.length).length}`);
      expect(out.length).toBeGreaterThan(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 240_000);
});
