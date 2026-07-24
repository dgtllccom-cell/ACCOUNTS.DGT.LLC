import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const accountsData = [
  { no: "d/sc0000101", name: "NAJEEBULLAH IRAN ACOOUNTS", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000102", name: "Najeeb kamel", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000103", name: "MUZAMMIL AKHTAR", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000104", name: "NIAMA AGHA ASMAT AGHA BROTHERS", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000105", name: "Old accounts", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000106", name: "DUBAIOFFICE Expenses", bank: "No", company: "No", customer: "Yes" },
  { no: "d/sc0000107", name: "Ex dubai", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000108", name: "Abdul Razik fareed bism account s", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000109", name: "Dubai locker", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000110", name: "Lal Muhammad Chaman", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000111", name: "FAREEDULLAH PRESIDENT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000112", name: "DGTLLC VAT ACCOUNTS", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000113", name: "VIAIJ", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000114", name: "IE bank najeebullah personal", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000115", name: "FAB BANK / ASMATULLAH", bank: "Yes", company: "No", customer: "Yes" },
  { no: "d/sc0000116", name: "MAZ", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000117", name: "KUMAR CUSTOM CLEARING AGENT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000118", name: "KAMIL", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000119", name: "RAN PURCHASE/SALES", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000120", name: "ASMATULLAH/INVESTMANT", bank: "No", company: "No", customer: "Yes" },
  { no: "d/sc0000121", name: "RAHAT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000122", name: "MASHERQ BANK", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000123", name: "NAJEEBULLAH/QUETTA OFFICE", bank: "Yes", company: "Yes", customer: "Yes" },
  { no: "d/sc0000124", name: "PURCHASE&SALES", bank: "Yes", company: "Yes", customer: "Yes" },
  { no: "d/sc0000125", name: "Noor Muhammad", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000126", name: "IMRAN ALI", bank: "Yes", company: "Yes", customer: "Yes" },
  { no: "d/sc0000127", name: "ASIF SAAAB", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000128", name: "HABIB BANK AG ZURICH", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000129", name: "Mashreq Business Banking", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000130", name: "IE BANK ASMATULLAH PERSOAL", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000131", name: "NASEEBULLAH CHAMAN OFFICE", bank: "Yes", company: "Yes", customer: "Yes" },
  { no: "d/sc0000132", name: "Dubai office expenses", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000133", name: "TRAZTACCOUNTS AFG", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000134", name: "SANJAY BROKER INDIA", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000135", name: "FAREEDULLAH PRESIDENT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000136", name: "DGTLLC VAT ACCOUNTS", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000137", name: "VIAIJ", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000138", name: "IE bank najeebullah personal", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000139", name: "FAB BANK / ASMATULLAH", bank: "Yes", company: "No", customer: "Yes" },
  { no: "d/sc0000140", name: "MAZ", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000141", name: "KUMAR CUSTOM CLEARING AGENT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000142", name: "KAMIL", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000143", name: "RAN PURCHASE/SALES", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000144", name: "ASMATULLAH/INVESTMANT", bank: "No", company: "No", customer: "Yes" },
  { no: "d/sc0000145", name: "RAHAT", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000146", name: "MASHERQ BANK", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000147", name: "NAJEEBULLAH IRAN ACOOUNTS", bank: "No", company: "Yes", customer: "Yes" },
  { no: "d/sc0000148", name: "Najeeb kamel", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000149", name: "MUZAMMIL AKHTAR", bank: "No", company: "Yes", customer: "No" },
  { no: "d/sc0000150", name: "NIAMA AGHA ASMAT AGHA BROTHERS", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000151", name: "Old accounts", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000152", name: "DUBAIOFFICE Expenses", bank: "No", company: "No", customer: "Yes" },
  { no: "d/sc0000153", name: "Ex dubai", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000154", name: "Abdul Razik fareed bism account s", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000155", name: "Dubai locker", bank: "No", company: "No", customer: "No" },
  { no: "d/sc0000156", name: "Lal Muhammad Chaman", bank: "No", company: "No", customer: "No" }
];

import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient() as any;

    const results = [];

    // 3. Insert accounts
    for (const acc of accountsData) {
      const payload = {
        account_number: acc.no,
        name: acc.name,
        status: "active",
        kind: "other",
        currency: "AED", 
        is_bank_account: acc.bank === "Yes",
        is_system_account: false,
        country_id: session.countryId,
        country_branch_id: session.countryBranchId,
        city_branch_id: session.cityBranchId,
        branch_code: "UAE-1", // default to UAE-1 or derive from session
        created_by: session.userId,
        scope: session.scope
      };

      const { data: inserted, error } = await supabase
        .from("enterprise_accounts")
        .upsert(payload, { onConflict: "account_number" })
        .select("id")
        .single();

      if (error) {
        results.push({ no: acc.no, error: error.message });
      } else {
        results.push({ no: acc.no, success: true });
      }
    }

    return NextResponse.json({ message: "Import completed successfully", results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to import" });
  }
}
