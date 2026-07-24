import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Find all purchase orders
  const { data: pos, error: poError } = await admin
    .from("purchase_orders")
    .select("id, purchase_order_no, country_id, country_branch_id, city_branch_id, form_data");

  if (poError) return NextResponse.json({ error: poError });

  try {
    const fixed = [];
    
    for (const po of pos) {
      let modifiedPo = false;
      // If PO lacks branch
      if (!po.city_branch_id) {
        const formData: any = po.form_data;
        const purchaseAccountNo = formData?.form?.purchaseAccountNo;
        if (purchaseAccountNo) {
          const { data: acc } = await admin
            .from("enterprise_accounts")
            .select("country_id, country_branch_id, city_branch_id")
            .eq("account_number", purchaseAccountNo)
            .single();
            
          if (acc && acc.city_branch_id) {
             po.country_id = acc.country_id;
             po.country_branch_id = acc.country_branch_id;
             po.city_branch_id = acc.city_branch_id;
             
             // Fix PO
             await admin.from("purchase_orders").update({
               country_id: acc.country_id,
               country_branch_id: acc.country_branch_id,
               city_branch_id: acc.city_branch_id
             }).eq("id", po.id);
             modifiedPo = true;
          }
        }
      }
      
      if (po.city_branch_id) {
        // Find corresponding roznamcha entries
        const formData: any = po.form_data;
        const systemBillNumber = formData?.form?.purchaseOrderNo || po.purchase_order_no;
        
        const { data: entries } = await admin
          .from("roznamcha_entries")
          .select("id, type, city_branch_id")
          .eq("journal_no", systemBillNumber);
          
        if (entries) {
          for (const entry of entries) {
            if (!entry.city_branch_id || entry.type === "super_admin") {
              await admin.from("roznamcha_entries").update({
                type: "branch",
                country_id: po.country_id,
                country_branch_id: po.country_branch_id,
                city_branch_id: po.city_branch_id
              }).eq("id", entry.id);
              
              fixed.push({ po: po.purchase_order_no, entryId: entry.id });
            }
          }
        }
      }
    }

    return NextResponse.json({ fixed, total: fixed.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
