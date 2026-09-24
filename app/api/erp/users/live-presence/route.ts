import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type LiveUserPresence = {
  id: string;
  userId: string;
  branchCode: string;
  date: string;
  time: string;
  userType: "Business" | "Shipping Line";
  userName: string;
  currentWork: string;
  status: "Online" | "Offline" | "Idle";
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role") || "all";
    const opFilter = searchParams.get("operation") || "all";

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const todayFormatted = `${day}/${month}/${year}`;

    const admin = createSupabaseAdminClient();
    const { data: assignments } = await admin
      .from("user_role_assignments")
      .select("user_id, role, is_active, profiles:user_id(id, full_name, user_code), branches:country_branch_id(code, name)")
      .is("deleted_at", null)
      .limit(10);

    const liveUsers: LiveUserPresence[] = (assignments || []).map((a: any, idx: number) => {
      const prof = a.profiles || {};
      const branch = a.branches || {};
      const isShipping = String(a.role || "").includes("shipping");
      return {
        id: a.user_id || `usr-${idx}`,
        userId: prof.user_code || String(a.user_id || "").slice(0, 8).toUpperCase() || "USR",
        branchCode: branch.code || "HQ-001",
        date: todayFormatted,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userType: (isShipping ? "Shipping Line" : "Business") as "Business" | "Shipping Line",
        userName: prof.full_name || a.role || "User",
        currentWork: isShipping ? "Shipping Ledger" : "Roznamcha / Review",
        status: (a.is_active ? "Online" : "Idle") as "Online" | "Offline" | "Idle"
      };
    });

    if (liveUsers.length === 0) {
      liveUsers.push({
        id: session.userId,
        userId: (session.userId || "BE340D15").slice(0, 8).toUpperCase(),
        branchCode: "HQ-001",
        date: todayFormatted,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userType: "Business",
        userName: session.fullName || "Super Admin",
        currentWork: "Roznamcha / Global Review",
        status: "Online"
      });
    }

    let filtered = liveUsers;
    if (roleFilter && roleFilter !== "all") {
      filtered = filtered.filter((u) => u.userName.toLowerCase().includes(roleFilter.toLowerCase()));
    }
    if (opFilter && opFilter !== "all") {
      filtered = filtered.filter(
        (u) =>
          u.userType.toLowerCase().includes(opFilter.toLowerCase()) ||
          u.currentWork.toLowerCase().includes(opFilter.toLowerCase())
      );
    }

    return NextResponse.json({
      ok: true,
      data: filtered,
      totalOnline: filtered.filter(u => u.status === "Online").length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load live users" },
      { status: 500 }
    );
  }
}
