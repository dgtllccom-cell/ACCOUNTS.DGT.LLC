import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LocalPurchaseView } from "@/features/purchases/components/local-purchase-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames, localizeRecordFields } from "@/lib/i18n/localize-records";

export const metadata = { title: "Purchase — Local Purchase" };


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

  // Localise Goods master DISPLAY text (name + each variation's size/brand/variety) into the
  // active language via the central resolver — the same path the /api/erp/goods route uses —
  // so the Local Purchase goods/brand/size/variety dropdowns never fall back to English.
  // Stored identity stays the FK id; goods_name here is only a display snapshot.
  let goodsList: any[] = goodsRes.data || [];
  try {
    const lang = await getRequestLanguage();
    if (goodsList.length > 0) {
      goodsList = await localizeRecordNames<any>(goodsList, "goods", "goods_name", lang);
      const variationRows = goodsList.flatMap((g: any) =>
        Array.isArray(g.variations)
          ? g.variations.map((v: any) => ({ id: v.id, size: v.size, brand: v.brand, variety: v.variety }))
          : [],
      );
      if (variationRows.length) {
        const locVars = await localizeRecordFields(
          variationRows,
          "goods_variations",
          ["size", "brand", "variety"],
          lang,
          { noPhrase: true },
        );
        const byId = new Map(locVars.map((v: any) => [v.id, v]));
        goodsList = goodsList.map((g: any) => ({
          ...g,
          variations: Array.isArray(g.variations)
            ? g.variations.map((v: any) => {
                const lv = byId.get(v.id) as any;
                return lv ? { ...v, size: lv.size ?? v.size, brand: lv.brand ?? v.brand, variety: lv.variety ?? v.variety } : v;
              })
            : g.variations,
        }));
      }
    }
  } catch {
    /* localisation is best-effort — never block the page on it */
  }
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
