import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: any[] = [];
  try {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch countries, country branches, city branches
    const { data: countries, error: cErr } = await supabase.from("countries").select("id, name, iso2");
    const { data: countryBranches, error: cbErr } = await supabase.from("country_branches").select("id, country_id, name, code");
    const { data: cityBranches, error: citErr } = await supabase.from("city_branches").select("id, country_id, country_branch_id, name, code");

    let seededAccountsCount = 0;
    let seededOrdersCount = 0;

    const makeAccNo = (prefix: string, i: number) => `${prefix}-${String(5000 + Math.floor(Math.random() * 9000)).padStart(5, "0")}`;

    // Test insert single account
    const testAcc = {
      account_number: makeAccNo("UAE-ALRAS", 1),
      name: `Al Ras Dry Fruit Traders ${Date.now()}`,
      code: "PA-1001",
      kind: "liability",
      currency: "AED",
      scope: "city",
      status: "active"
    };

    const { data: insData, error: insErr } = await supabase.from("enterprise_accounts").insert(testAcc).select("id");
    if (insErr) {
      errors.push({ type: "enterprise_accounts", err: insErr });
    } else {
      seededAccountsCount += (insData?.length || 1);
    }

    // Test insert purchase booking order
    const testOrder = {
      purchase_booking_order_number: `PB-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
      manual_bill_number: "INV-UAE-901",
      country_name: "United Arab Emirates",
      branch_name: "AL_RAS",
      supplier_name: "Al Ras Dry Fruit Traders LLC",
      product_name: "Almond Kernels USA Extra No. 1",
      quantity: 1200,
      unit: "BAGS",
      purchase_amount: 323400,
      final_amount: 1187686,
      currency: "USD",
      final_currency: "AED",
      status: "Posted",
      booking_date: "2026-07-20"
    };

    const { data: ordData, error: ordErr } = await supabase.from("purchase_booking_orders").insert(testOrder).select("id");
    if (ordErr) {
      errors.push({ type: "purchase_booking_orders", err: ordErr });
    } else {
      seededOrdersCount += (ordData?.length || 1);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: {
        countriesCount: countries?.length || 0,
        countryBranchesCount: countryBranches?.length || 0,
        cityBranchesCount: cityBranches?.length || 0,
        cErr,
        cbErr,
        citErr
      },
      metrics: {
        accountsCreatedOrUpdated: seededAccountsCount,
        purchaseOrdersSeeded: seededOrdersCount
      },
      errors
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
