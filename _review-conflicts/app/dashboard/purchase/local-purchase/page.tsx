import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LocalPurchaseView } from "@/features/purchases/components/local-purchase-view";

export const dynamic = "force-dynamic";

export default async function LocalPurchasePage() {
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  const supabase = createSupabaseAdminClient();

  // Query database using Supabase client to match project conventions and ensure stability
  const [goodsRes, branchRes, cityRes, companyRes, countryRes] = await Promise.all([
    supabase
      .from("goods")
      .select("*, variations:goods_variations(*)")
      .is("deleted_at", null)
      .order("goods_name", { ascending: true }),
    supabase
      .from("country_branches")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("city_branches")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("countries")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true })
  ]);

  const goodsList = goodsRes.data || [];
  const branches = branchRes.data || [];
  const cities = cityRes.data || [];
  const companyList = companyRes.data || [];
  const countriesList = countryRes.data || [];

  return (
    <LocalPurchaseView
      session={session}
      goodsList={goodsList}
      countryBranches={branches}
      cityBranches={cities}
      companies={companyList}
      countries={countriesList}
    />
  );
}
