import { Metadata } from "next";
import { cookies } from "next/headers";
import { requireErpSession } from "@/lib/auth/session";
import { TruckRecreationWizard } from "@/features/clearing-agent/components/truck-recreation-wizard";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const metadata: Metadata = {
  title: "Clearing Truck Registration — Clearing Agent ERP",
  description: "Truck master, owner, transporter, driver and reporting — table-first with a live report summary.",
};

export default async function TruckRegistrationPage() {
  const session = await requireErpSession();
  const cookieStore = await cookies();
  const lang = (cookieStore.get("erp_lang")?.value ?? session.preferredLanguage ?? "en") as SupportedLanguage;

  const isSuperAdmin = Boolean(
    session.isSuperAdmin ||
    session.roles.includes("super_admin") ||
    session.roles.includes("business_super_admin") ||
    session.roles.includes("shipping_super_admin") ||
    session.isGlobalScope
  );
  const isCountryAdmin = !isSuperAdmin && (
    session.roles.includes("country_admin") ||
    session.roles.includes("country_user")
  );
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  let initialTrucks: any[] = [];
  try {
    const rawRows = await withLocalPg(async (sql) => {
      return sql`
        select t.id, t.country_id, t.country_branch_id, t.city_branch_id, t.super_admin_serial, t.country_serial,
               t.branch_serial, t.entry_serial, t.truck_serial, t.truck_number, t.truck_name, t.registration_number,
               t.registration_country_id, t.truck_type, t.make, t.model, t.manufacturing_year, t.color, t.fuel_type,
               t.chassis_number, t.engine_number, t.capacity, t.owner_name, t.owner_mobile, t.owner_person_id,
               t.transport_company, t.transport_company_id, t.transporter_person_id,
               t.driver_name, t.driver_mobile, t.driver_cnic_passport,
               t.driver_person_id, t.registration_expiry_date, t.insurance_expiry_date, t.driver_docs_expiry_date,
               t.base_state_province_id, t.base_district_id, t.base_city_id, t.status, t.notes, t.is_active,
               t.created_at, t.updated_at,
               t.owner_name_en, t.owner_name_ur, t.owner_name_ar, t.owner_name_fa, t.owner_name_ps,
               t.driver_name_en, t.driver_name_ur, t.driver_name_ar, t.driver_name_fa, t.driver_name_ps,
               t.transport_company_en, t.transport_company_ur, t.transport_company_ar, t.transport_company_fa, t.transport_company_ps,
               owner.customer_name as owner_display_name,
               driver.customer_name as driver_display_name,
               transporter.customer_name as transporter_display_name,
               company.name as company_display_name,
               coalesce(cb.name, crb.name) as branch_display_name,
               country.name as country_display_name
        from public.trucks t
        left join public.customers owner on owner.id = t.owner_person_id
        left join public.customers driver on driver.id = t.driver_person_id
        left join public.customers transporter on transporter.id = t.transporter_person_id
        left join public.companies company on company.id = t.transport_company_id
        left join public.city_branches cb on cb.id = t.city_branch_id
        left join public.country_branches crb on crb.id = t.country_branch_id
        left join public.countries country on country.id = t.country_id
        where t.deleted_at is null
        order by t.created_at desc
        limit 500
      `;
    });
    if (Array.isArray(rawRows)) {
      initialTrucks = await localizeJoinedNames<any>(rawRows, lang, [
        { idField: "owner_person_id", nameField: "owner_display_name", table: "customers", field: "customer_name" },
        { idField: "driver_person_id", nameField: "driver_display_name", table: "customers", field: "customer_name" },
        { idField: "transporter_person_id", nameField: "transporter_display_name", table: "customers", field: "customer_name" },
        { idField: "transport_company_id", nameField: "company_display_name", table: "companies", field: "name" },
        { idField: "city_branch_id", nameField: "branch_display_name", table: "city_branches", field: "name" },
        { idField: "country_branch_id", nameField: "branch_display_name", table: "country_branches", field: "name" },
        { idField: "country_id", nameField: "country_display_name", table: "countries", field: "name" }
      ]);
    }
  } catch {
    // fallback gracefully
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-2 sm:p-4 lg:p-6 dark:bg-slate-950/50">
      <div className="mx-auto w-full max-w-[1850px]">
        <TruckRecreationWizard
          initialTrucks={initialTrucks}
          lang={lang}
          userName={session.fullName || session.email || null}
          isSuperAdmin={isSuperAdmin}
          isCountryAdmin={isCountryAdmin}
          isBranchUser={isBranchUser}
          userCountryIds={session.countryIds || []}
          userBranchIds={session.cityBranchIds || []}
        />
      </div>
    </div>
  );
}
