import { Suspense } from "react";
import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames, localizeRecordFields } from "@/lib/i18n/localize-records";
import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";

export const metadata = { title: "Purchase — Local Purchase Payment Transfer" };

export const dynamic = "force-dynamic";

export default async function LocalPurchaseTransferPaymentPage() {
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  const matchesBranchScope = (b: any) => {
    if (session.isSuperAdmin) return true;
    const countryId = String(b.country_id || b.countryId || "");
    const branchId = String(b.id || "");
    if (session.countryBranchIds?.length > 0) return session.countryBranchIds.includes(branchId);
    if (session.countryIds?.length > 0) return session.countryIds.includes(countryId);
    if (session.cityBranchIds?.length > 0) return true;
    return false;
  };

  const matchesCityScope = (cb: any) => {
    if (session.isSuperAdmin) return true;
    const id = String(cb.id || "");
    const countryBranchId = String(cb.country_branch_id || "");
    if (session.cityBranchIds?.length > 0) return session.cityBranchIds.includes(id);
    if (session.countryBranchIds?.length > 0) return session.countryBranchIds.includes(countryBranchId);
    return true;
  };

  let goodsList: any[] = [];
  let branches: any[] = [];
  let cities: any[] = [];
  let companyList: any[] = [];
  let countriesList: any[] = [];

  try {
    const supabase = createSupabaseAdminClient();
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
        .order("name", { ascending: true }),
    ]);

    goodsList = goodsRes.data || [];
    const allBranches = (branchRes.data || []).filter(matchesBranchScope);
    const allCities = (cityRes.data || [])
      .filter((cb: any) => String(cb.operational_domain || "business") !== "shipping")
      .filter(matchesCityScope);
    const allCountries = countryRes.data || [];
    const countryById = new Map(allCountries.map((c: any) => [String(c.id), c]));

    const enrichedBranches = allBranches.map((b: any) => {
      const c = countryById.get(String(b.country_id || ""));
      return {
        ...b,
        country_name: b.country_name || c?.name || null,
        country_code: b.country_code || c?.iso_code || null,
      };
    });

    branches =
      session.cityBranchIds?.length > 0 && !session.isSuperAdmin && (session.countryBranchIds?.length ?? 0) === 0
        ? enrichedBranches.filter((b: any) =>
            allCities.some((cb: any) => String(cb.country_branch_id || "") === String(b.id || ""))
          )
        : enrichedBranches;

    cities = allCities;
    companyList = companyRes.data || [];

    const allowedCountryIds = new Set(branches.map((b: any) => String(b.country_id || "")));
    countriesList = session.isSuperAdmin
      ? allCountries
      : allCountries.filter(
          (c: any) =>
            session.countryIds?.includes(String(c.id)) || allowedCountryIds.has(String(c.id))
        );

    const lang = await getRequestLanguage();
    if (goodsList.length > 0) {
      goodsList = await localizeRecordNames<any>(goodsList, "goods", "goods_name", lang);
      const variationRows = goodsList.flatMap((g: any) =>
        Array.isArray(g.variations)
          ? g.variations.map((v: any) => ({ id: v.id, size: v.size, brand: v.brand, variety: v.variety }))
          : []
      );
      if (variationRows.length) {
        const locVars = await localizeRecordFields(
          variationRows,
          "goods_variations",
          ["size", "brand", "variety"],
          lang,
          { noPhrase: true }
        );
        const byId = new Map(locVars.map((v: any) => [v.id, v]));
        goodsList = goodsList.map((g: any) => ({
          ...g,
          variations: Array.isArray(g.variations)
            ? g.variations.map((v: any) => {
                const lv = byId.get(v.id) as any;
                return lv
                  ? { ...v, size: lv.size ?? v.size, brand: lv.brand ?? v.brand, variety: lv.variety ?? v.variety }
                  : v;
              })
            : g.variations,
        }));
      }
    }
    if (branches.length > 0) {
      branches = await localizeRecordNames<any>(branches, "country_branches", "name", lang);
    }
    if (cities.length > 0) {
      cities = await localizeRecordNames<any>(cities, "city_branches", "name", lang);
    }
    if (companyList.length > 0) {
      companyList = await localizeRecordNames<any>(companyList, "companies", "name", lang);
    }
    if (countriesList.length > 0) {
      countriesList = await localizeRecordNames<any>(countriesList, "countries", "name", lang);
    }
  } catch (err) {
    console.error("[LocalPurchaseTransferPaymentPage] fallback load warning:", err);
  }

  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Loading Local Purchase Payment Transfer...</div>}>
      <LocalPurchaseTransferPaymentView
        session={session}
        goodsList={goodsList}
        countryBranches={branches}
        cityBranches={cities}
        companies={companyList}
        countries={countriesList}
      />
    </Suspense>
  );
}
