import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // 1. Find all roznamcha entries where city_branch_id is null OR type is super_admin
    const { data: entries, error: entriesError } = await admin
      .from("roznamcha_entries")
      .select("id, journal_no, voucher_no, type, city_branch_id, country_id")
      .is("city_branch_id", null);

    if (entriesError) throw entriesError;

    const fixed = [];
    const errors = [];

    for (const entry of entries) {
      // Find the corresponding PO by journal_no
      const { data: po } = await admin
        .from("purchase_orders")
        .select("id, purchase_order_no, country_id, country_branch_id, city_branch_id, form_data")
        .eq("purchase_order_no", entry.journal_no)
        .limit(1)
        .maybeSingle();

      let targetCountryId = po?.country_id;
      let targetCountryBranchId = po?.country_branch_id;
      let targetCityBranchId = po?.city_branch_id;

      // If PO doesn't have it, try to get from purchaseAccountNo in form_data
      if (!targetCityBranchId && po?.form_data?.form?.purchaseAccountNo) {
        const { data: acc } = await admin
          .from("enterprise_accounts")
          .select("country_id, country_branch_id, city_branch_id")
          .eq("account_number", po.form_data.form.purchaseAccountNo)
          .limit(1)
          .maybeSingle();
        
        if (acc?.city_branch_id) {
          targetCountryId = acc.country_id;
          targetCountryBranchId = acc.country_branch_id;
          targetCityBranchId = acc.city_branch_id;

          // Also update the PO while we're at it
          await admin.from("purchase_orders").update({
            country_id: targetCountryId,
            country_branch_id: targetCountryBranchId,
            city_branch_id: targetCityBranchId
          }).eq("id", po.id);
        }
      }

      // If we STILL don't have it, let's try to find the account from roznamcha_lines
      if (!targetCityBranchId) {
        const { data: lines } = await admin
          .from("roznamcha_lines")
          .select("account_number, ledgers(city_branch_id, country_branch_id, country_id)")
          .eq("roznamcha_id", entry.id)
          .not("account_number", "is", null);
        
        for (const line of lines || []) {
          if (line.ledgers?.city_branch_id) {
            targetCountryId = line.ledgers.country_id;
            targetCountryBranchId = line.ledgers.country_branch_id;
            targetCityBranchId = line.ledgers.city_branch_id;
            break;
          }
          if (line.account_number) {
            const { data: acc2 } = await admin
              .from("enterprise_accounts")
              .select("country_id, country_branch_id, city_branch_id")
              .eq("account_number", line.account_number)
              .limit(1)
              .maybeSingle();
            if (acc2?.city_branch_id) {
              targetCountryId = acc2.country_id;
              targetCountryBranchId = acc2.country_branch_id;
              targetCityBranchId = acc2.city_branch_id;
              break;
            }
          }
        }
      }

      // If we finally found a city_branch_id, update the roznamcha entry!
      if (targetCityBranchId) {
        const { error: updateError } = await admin.from("roznamcha_entries").update({
          type: "branch",
          country_id: targetCountryId,
          country_branch_id: targetCountryBranchId,
          city_branch_id: targetCityBranchId
        }).eq("id", entry.id);

        if (updateError) {
          errors.push({ entryId: entry.id, error: updateError.message });
        } else {
          fixed.push({ entryId: entry.id, journalNo: entry.journal_no, newBranch: targetCityBranchId });
        }
      } else {
        errors.push({ entryId: entry.id, error: "Could not find branch info for this entry" });
      }
    }

    // Also fix any entries that HAVE a city_branch_id but are marked as "super_admin"
    const { data: superAdminEntries } = await admin
      .from("roznamcha_entries")
      .select("id, city_branch_id")
      .eq("type", "super_admin")
      .not("city_branch_id", "is", null);

    for (const saEntry of superAdminEntries || []) {
      await admin.from("roznamcha_entries").update({ type: "branch" }).eq("id", saEntry.id);
      fixed.push({ entryId: saEntry.id, journalNo: "Updated type to branch" });
    }

    return NextResponse.json({ success: true, fixedCount: fixed.length, fixed, errors }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 200 });
  }
}
