import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type LiveUserPresence = {
  id: string;
  userId: string;
  userCode: string;
  userName: string;
  role: string;
  roleTitle: string;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchCode: string;
  branchName: string;
  cityBranchName: string | null;
  date: string;
  time: string;
  userType: "Business" | "Shipping Line" | "Clearing Agent";
  currentWork: string;
  lastAction: string | null;
  lastActiveAgo: string;
  status: "Online" | "Idle" | "Offline";
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  country_admin: "Country Admin",
  country_user: "Country User",
  main_branch_admin: "Main Branch Admin",
  city_branch_admin: "City Branch Admin",
  city_branch_user: "Branch User",
  branch_admin: "Branch Admin",
  clearing_agent: "Clearing Agent",
  shipping_agent: "Shipping Agent",
  accountant: "Accountant",
  cashier: "Cashier",
  operator: "Operator",
  staff: "Operations Staff"
};

function formatCurrentWork(action: string | null, table: string | null, role: string): string {
  if (table) {
    const t = table.toLowerCase();
    if (t.includes("roznamcha") || t.includes("cash")) return "Roznamcha / Daily Cash Entry";
    if (t.includes("clearing") || t.includes("order")) return "Customer Order / Transfer & Clearing";
    if (t.includes("customs")) return "Customs Border Duty & Clearances";
    if (t.includes("truck")) return "Truck Fleet & Freight Dispatch";
    if (t.includes("bill") || t.includes("invoice")) return "Customer Invoicing & Bill Review";
    if (t.includes("sales")) return "Sales Order & Commercial Stock";
    if (t.includes("purchase")) return "Purchase Order & Stock Goods";
    if (t.includes("account") || t.includes("ledger")) return "General Ledger & Voucher Audit";
    if (t.includes("profile") || t.includes("user")) return "User Management & Role Assignment";
    if (t.includes("document")) return "Document Filing & Verification";
  }

  // Fallback to role-specific active duty
  const r = (role || "").toLowerCase();
  if (r.includes("super_admin")) return "Global Monitoring & System Oversight";
  if (r.includes("country")) return "Country Operations & Ledger Audit";
  if (r.includes("branch_admin") || r.includes("manager")) return "Branch Operations & Cash Approval";
  if (r.includes("clearing")) return "Port Clearance & Customs Declarations";
  if (r.includes("shipping")) return "Shipping Line Container Tracking";
  if (r.includes("account") || r.includes("cashier")) return "Cash Roznamcha & Voucher Entry";
  return "Daily Operations & Record Verification";
}

function timeAgo(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);

    const countryFilter = searchParams.get("countryId");
    const branchFilter = searchParams.get("branchId");
    const roleFilter = searchParams.get("role");
    const opFilter = searchParams.get("operation");
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search");

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const todayFormatted = `${day}/${month}/${year}`;

    const countryIds = session.countryIds ?? [];
    const countryBranchIds = session.countryBranchIds ?? [];
    const cityBranchIds = session.cityBranchIds ?? [];

    const isSuperAdmin = session.isSuperAdmin;
    const isCountryLevel = session.roles.some((r) => r === "country_admin" || r === "country_user");

    const rows = await withLocalPg(async (sql) => {
      const result = await sql`
        select distinct on (p.id)
          p.id as user_id,
          p.user_code,
          p.full_name,
          p.email,
          p.last_login_at,
          ura.role,
          ura.is_active,
          ura.country_id,
          ura.country_branch_id,
          ura.city_branch_id,
          coalesce(ura.operational_domain, 'business') as operational_domain,
          co.name as country_name,
          co.iso2 as country_iso2,
          cb.name as country_branch_name,
          cb.code as country_branch_code,
          cib.name as city_branch_name,
          cib.code as city_branch_code,
          latest_audit.action as last_action,
          latest_audit.entity_table as last_table,
          latest_audit.created_at as last_action_time
        from public.profiles p
        join public.user_role_assignments ura 
          on ura.user_id = p.id 
         and ura.is_active = true 
         and ura.deleted_at is null
        left join public.countries co on co.id = ura.country_id and co.deleted_at is null
        left join public.country_branches cb on cb.id = ura.country_branch_id and cb.deleted_at is null
        left join public.city_branches cib on cib.id = ura.city_branch_id and cib.deleted_at is null
        left join lateral (
          select a.action, a.entity_table, a.created_at
          from public.audit_logs a
          where a.actor_id = p.id
          order by a.created_at desc
          limit 1
        ) latest_audit on true
        where p.deleted_at is null
        order by p.id, ura.created_at desc
      `;
      return result as unknown as any[];
    });

    // ── Enforce RBAC Scopes ───────────────────────────────────────────
    let scopedRows = (rows || []).filter((r: any) => {
      // Super Admin sees all worldwide
      if (isSuperAdmin) return true;

      // Country Admin: restricted to their assigned countries
      if (isCountryLevel) {
        return r.country_id && countryIds.includes(r.country_id);
      }

      // Branch User / Branch Admin: restricted to their city branch or country branch
      const inCity = r.city_branch_id && cityBranchIds.includes(r.city_branch_id);
      const inCountryBranch = r.country_branch_id && countryBranchIds.includes(r.country_branch_id);
      const inCountry = r.country_id && countryIds.includes(r.country_id);

      return inCity || inCountryBranch || inCountry;
    });

    // ── Apply Query Filters ───────────────────────────────────────────
    if (countryFilter && countryFilter !== "all") {
      scopedRows = scopedRows.filter((r: any) => r.country_id === countryFilter);
    }

    if (branchFilter && branchFilter !== "all") {
      scopedRows = scopedRows.filter(
        (r: any) => r.country_branch_id === branchFilter || r.city_branch_id === branchFilter
      );
    }

    if (roleFilter && roleFilter !== "all") {
      scopedRows = scopedRows.filter(
        (r: any) => (r.role || "").toLowerCase() === roleFilter.toLowerCase()
      );
    }

    if (opFilter && opFilter !== "all") {
      scopedRows = scopedRows.filter((r: any) => {
        const domain = (r.operational_domain || "business").toLowerCase();
        const op = opFilter.toLowerCase();
        if (op === "shipping") return domain.includes("shipping") || String(r.role).includes("shipping");
        if (op === "clearing") return domain.includes("clearing") || String(r.role).includes("clearing");
        return domain.includes("business");
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      scopedRows = scopedRows.filter((r: any) => {
        const haystack = [
          r.user_code,
          r.full_name,
          r.email,
          r.role,
          r.country_name,
          r.country_branch_name,
          r.city_branch_name,
          r.last_action,
          r.last_table
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // Transform into LiveUserPresence records
    const liveUsers: LiveUserPresence[] = scopedRows.map((r: any, idx: number) => {
      const isShipping = String(r.role || "").includes("shipping") || r.operational_domain === "shipping";
      const isClearing = String(r.role || "").includes("clearing") || r.operational_domain === "clearing";

      let userType: "Business" | "Shipping Line" | "Clearing Agent" = "Business";
      if (isShipping) userType = "Shipping Line";
      else if (isClearing) userType = "Clearing Agent";

      const branchCode = r.city_branch_code || r.country_branch_code || (r.country_iso2 ? `${r.country_iso2}-01` : "HQ-001");
      const branchName = r.city_branch_name || r.country_branch_name || r.country_name || "Main Branch";

      const lastTouchDate = r.last_action_time ? new Date(r.last_action_time) : (r.last_login_at ? new Date(r.last_login_at) : null);
      const isCurrentUser = r.user_id === session.userId;

      let status: "Online" | "Idle" | "Offline" = "Idle";
      if (isCurrentUser) {
        status = "Online";
      } else if (lastTouchDate) {
        const diffMins = Math.floor((now.getTime() - lastTouchDate.getTime()) / 60000);
        if (diffMins <= 30) status = "Online";
        else if (diffMins <= 180) status = "Idle";
        else status = "Offline";
      } else {
        // If active in DB without timestamp
        status = r.is_active ? "Online" : "Offline";
      }

      const activeTime = lastTouchDate
        ? lastTouchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const currentWork = formatCurrentWork(r.last_action, r.last_table, r.role);

      return {
        id: r.user_id || `live-${idx}`,
        userId: r.user_code || String(r.user_id || "").slice(0, 8).toUpperCase(),
        userCode: r.user_code || String(r.user_id || "").slice(0, 8).toUpperCase(),
        userName: r.full_name || r.email?.split("@")[0] || "Active User",
        role: r.role || "staff",
        roleTitle: ROLE_DISPLAY_NAMES[r.role] || r.role || "Operator",
        countryId: r.country_id || null,
        countryName: r.country_name || (isSuperAdmin ? "Global" : "Assigned Country"),
        branchId: r.city_branch_id || r.country_branch_id || null,
        branchCode,
        branchName,
        cityBranchName: r.city_branch_name || null,
        date: todayFormatted,
        time: activeTime,
        userType,
        currentWork,
        lastAction: r.last_action ? `${r.last_action} on ${r.last_table || "record"}` : null,
        lastActiveAgo: lastTouchDate ? timeAgo(lastTouchDate, now) : "Active today",
        status
      };
    });

    // Ensure session caller is present if list was empty
    if (liveUsers.length === 0) {
      liveUsers.push({
        id: session.userId,
        userId: (session.userId || "BE340D15").slice(0, 8).toUpperCase(),
        userCode: "SA-001",
        userName: session.fullName || "Super Admin",
        role: session.roles[0] || "super_admin",
        roleTitle: "Super Admin",
        countryId: null,
        countryName: "Global",
        branchId: null,
        branchCode: "HQ-001",
        branchName: "Global Executive HQ",
        cityBranchName: null,
        date: todayFormatted,
        time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        userType: "Business",
        currentWork: "Global Operations & System Monitoring",
        lastAction: "Live Presence Check",
        lastActiveAgo: "Active now",
        status: "Online"
      });
    }

    // Apply status filter if provided
    let finalUsers = liveUsers;
    if (statusFilter && statusFilter !== "all") {
      finalUsers = finalUsers.filter(
        (u) => u.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    return NextResponse.json({
      ok: true,
      data: finalUsers,
      counts: {
        total: finalUsers.length,
        online: finalUsers.filter((u) => u.status === "Online").length,
        idle: finalUsers.filter((u) => u.status === "Idle").length,
        offline: finalUsers.filter((u) => u.status === "Offline").length,
        business: finalUsers.filter((u) => u.userType === "Business").length,
        shipping: finalUsers.filter((u) => u.userType === "Shipping Line").length,
        clearing: finalUsers.filter((u) => u.userType === "Clearing Agent").length
      },
      callerScope: {
        isSuperAdmin,
        isCountryLevel,
        countryIds: session.countryIds ?? [],
        countryBranchIds: session.countryBranchIds ?? [],
        cityBranchIds: session.cityBranchIds ?? []
      }
    });
  } catch (error: any) {
    console.error("Live presence API error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load live users" },
      { status: 500 }
    );
  }
}
