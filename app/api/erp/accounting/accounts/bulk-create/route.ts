import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/permissions/middleware";
import { auditApiAction } from "@/lib/api/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { countryId, branchId, accounts } = await request.json();

    // Authorize scope
    await authorizeApiScope(session, { countryId });

    const db = createApiSupabaseClient();

    // Create accounts in bulk
    const createdAccounts = [];
    for (const accountData of accounts) {
      const { data } = await db
        .from("accounts")
        .insert({
          country_id: countryId,
          city_branch_id: branchId,
          code: accountData.code,
          name: accountData.name,
          currency: accountData.currency || "USD",
          category: accountData.category || "Asset",
          status: "active",
          created_by: session.userId
        })
        .select()
        .single();

      if (data) {
        createdAccounts.push(data);
      }
    }

    // Audit
    await auditApiAction({
      action: "accounts.bulk_create",
      resourceId: countryId,
      userId: session.userId,
      details: {
        countryId,
        branchId,
        count: createdAccounts.length
      }
    });

    return NextResponse.json({
      ok: true,
      createdCount: createdAccounts.length,
      accounts: createdAccounts
    });
  } catch (error) {
    console.error("Bulk account creation error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bulk creation failed" },
      { status: 400 }
    );
  }
}
