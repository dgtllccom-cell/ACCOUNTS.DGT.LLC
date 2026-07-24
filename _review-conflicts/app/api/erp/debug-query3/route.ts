import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdminClient() as any;

    const countryId = "7b757efe-7aea-4e9e-9cc4-34b2e842958f";
    const countryBranchId = "a7a7f280-825b-4fdd-8205-78e224a17100";
    const cityBranchId = "ea9bcd98-3a85-463c-89f2-0561f13208b0";

    const posToFix = ["PUR-000001", "PUR-000002", "PO-1783159959182", "PO-1783158738589", "PO-1783157656657", "PO-1783157457676", "PO-1783158989469", "PO-1783161544004", "PO-1783162509487"];

    let fixed = [];
    for (const po of posToFix) {
      const { data: currentPo } = await admin
        .from('purchase_orders')
        .select('form_data, city_branch_id')
        .eq('purchase_order_no', po)
        .single();

      if (currentPo && !currentPo.city_branch_id) {
        const formData = currentPo.form_data || {};
        if (!formData.form) formData.form = {};
        
        formData.form.countryId = countryId;
        formData.form.countryBranchId = countryBranchId;
        formData.form.cityBranchId = cityBranchId;
        formData.form.branchName = "QU/NAJEEB (Fixed)";

        await admin
          .from('purchase_orders')
          .update({
            country_id: countryId,
            country_branch_id: countryBranchId,
            city_branch_id: cityBranchId,
            form_data: formData
          })
          .eq('purchase_order_no', po);
        
        fixed.push(po);
      }
    }

    return NextResponse.json({ fixed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
