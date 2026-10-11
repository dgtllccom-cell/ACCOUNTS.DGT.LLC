import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Purchase — Local Purchase Transfer & Loading" };

export const dynamic = "force-dynamic";

export default async function LocalPurchaseTransferPaymentPage() {
  const session = await requireErpSession();

  const branchesData = await withLocalPg(async (sql) => {
    const branches = await sql`
      select * from public.country_branches
      where deleted_at is null and status = 'active'
      order by name asc
    `;
    const cities = await sql`
      select * from public.city_branches
      where deleted_at is null and status = 'active'
      order by name asc
    `;
    return { branches, cities };
  });

  let branches: any[] = (branchesData?.branches as any[]) || [];
  let cities: any[] = (branchesData?.cities as any[]) || [];

  if (!branchesData) {
    const supabase = createSupabaseAdminClient();
    const [bRes, cRes] = await Promise.all([
      supabase.from("country_branches").select("*").eq("status", "active").is("deleted_at", null).order("name", { ascending: true }),
      supabase.from("city_branches").select("*").eq("status", "active").is("deleted_at", null).order("name", { ascending: true }),
    ]);
    branches = (bRes.data as any[]) || [];
    cities = (cRes.data as any[]) || [];
  }

  return (
    <LocalPurchaseTransferPaymentView
      session={session}
      countryBranches={branches}
      cityBranches={cities}
    />
  );
}

