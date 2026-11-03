import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";

export const dynamic = "force-dynamic";

export default async function LocalPurchaseTransferPaymentPage() {
  const session = await requireErpSession();
  const lang = await getRequestLanguage();

  const matchesBranchScope = (b: any) => {
    if (session.isSuperAdmin) return true;
    const countryId = String(b.country_id || b.countryId || "");
    const branchId = String(b.id || "");
    if (session.countryBranchIds.length > 0) return session.countryBranchIds.includes(branchId);
    if (session.countryIds.length > 0) return session.countryIds.includes(countryId);
    if (session.cityBranchIds.length > 0) return true;
    return false;
  };

  const matchesCityScope = (cb: any) => {
    if (session.isSuperAdmin) return true;
    const id = String(cb.id || "");
    const countryBranchId = String(cb.country_branch_id || "");
    if (session.cityBranchIds.length > 0) return session.cityBranchIds.includes(id);
    if (session.countryBranchIds.length > 0) return session.countryBranchIds.includes(countryBranchId);
    return true;
  };

  const viaPg = await withLocalPg(async (sql) => {
    const [goodsRows, branchRows, cityRows, companyRows, countryRows] = await Promise.all([
      sql`
        select id, name, hs_code, brand_name, size_details, origin, unit
        from public.goods
        where deleted_at is null and is_active = true
        order by name asc;
      `,
      sql`
        select b.id, b.name, b.code, b.country_id, c.name as country_name, c.iso_code as country_code
        from public.country_branches b
        left join public.countries c on c.id = b.country_id
        where b.deleted_at is null and b.is_active = true
        order by b.name asc;
      `,
      sql`
        select id, name, code, country_branch_id, country_id, operational_domain
        from public.city_branches
        where deleted_at is null
          and is_active = true
          and coalesce(operational_domain, 'business') <> 'shipping'
        order by name asc;
      `,
      sql`
        select id, name, country_id
        from public.companies
        where deleted_at is null and is_active = true
        order by name asc;
      `,
      sql`
        select id, name, iso_code
        from public.countries
        where deleted_at is null and is_active = true
        order by name asc;
      `,
    ]);

    const scopedBranches = branchRows.filter(matchesBranchScope);
    const scopedCities = cityRows.filter(matchesCityScope);
    const allowedCountryIds = new Set(scopedBranches.map((b: any) => String(b.country_id || "")));
    const finalBranches =
      session.cityBranchIds.length > 0 && !session.isSuperAdmin && session.countryBranchIds.length === 0
        ? scopedBranches.filter((b: any) =>
            scopedCities.some((cb: any) => String(cb.country_branch_id || "") === String(b.id || ""))
          )
        : scopedBranches;

    const scopedCountries = session.isSuperAdmin
      ? countryRows
      : countryRows.filter(
          (c: any) =>
            session.countryIds.includes(String(c.id)) || allowedCountryIds.has(String(c.id))
        );

    return {
      goodsList: goodsRows,
      countryBranches: finalBranches,
      cityBranches: scopedCities,
      companies: companyRows,
      countries: scopedCountries,
    };
  });

  if (viaPg) {
    const [localizedGoods, localizedBranches, localizedCities, localizedCompanies, localizedCountries] =
      await Promise.all([
        localizeRecordNames(viaPg.goodsList as any[], "goods", "name", lang),
        localizeRecordNames(viaPg.countryBranches as any[], "country_branches", "name", lang),
        localizeRecordNames(viaPg.cityBranches as any[], "city_branches", "name", lang),
        localizeRecordNames(viaPg.companies as any[], "companies", "name", lang),
        localizeRecordNames(viaPg.countries as any[], "countries", "name", lang),
      ]);

    return (
      <LocalPurchaseTransferPaymentView
        session={session}
        goodsList={localizedGoods}
        countryBranches={localizedBranches}
        cityBranches={localizedCities}
        companies={localizedCompanies}
        countries={localizedCountries}
      />
    );
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: goodsData }, { data: branchesData }, { data: cityData }, { data: compData }, { data: countryData }] =
    await Promise.all([
      (supabase as any).from("goods").select("id, name, hs_code, brand_name, size_details, origin, unit").is("deleted_at", null).eq("is_active", true).order("name"),
      (supabase as any).from("country_branches").select("id, name, code, country_id").is("deleted_at", null).eq("is_active", true).order("name"),
      (supabase as any).from("city_branches").select("id, name, code, country_branch_id, country_id, operational_domain").is("deleted_at", null).eq("is_active", true).neq("operational_domain", "shipping").order("name"),
      (supabase as any).from("companies").select("id, name, country_id").is("deleted_at", null).eq("is_active", true).order("name"),
      (supabase as any).from("countries").select("id, name, iso_code").is("deleted_at", null).eq("is_active", true).order("name"),
    ]);

  return (
    <LocalPurchaseTransferPaymentView
      session={session}
      goodsList={goodsData || []}
      countryBranches={(branchesData || []).filter(matchesBranchScope)}
      cityBranches={(cityData || []).filter(matchesCityScope)}
      companies={compData || []}
      countries={countryData || []}
    />
  );
}
