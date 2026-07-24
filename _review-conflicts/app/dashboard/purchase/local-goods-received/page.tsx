import { LocalGoodsReceivedView } from "@/features/purchases/components/local-goods-received-view";
import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function LocalGoodsReceivedPage() {
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  const supabase = createSupabaseAdminClient();

  const [branchRes, cityRes] = await Promise.all([
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
      .order("name", { ascending: true })
  ]);

  const branches = branchRes.data || [];
  const cities = cityRes.data || [];

  return (
    <LocalGoodsReceivedView
      session={session}
      countryBranches={branches}
      cityBranches={cities}
    />
  );
}
