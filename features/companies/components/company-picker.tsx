import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CompanyIncorporationForm } from "./company-incorporation-form";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type CompanyRow = {
  id: string;
  company_code?: string | null;
  name: string;
  legal_name: string | null;
  base_currency: string;
  owner_name?: string | null;
  owner_person_id?: string | null;
  manager_person_id?: string | null;
  business_type?: string | null;
  country_id?: string | null;
  state_province_id?: string | null;
  district_id?: string | null;
  city_id?: string | null;
  area_location_id?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  district_name?: string | null;
  city_name?: string | null;
  area_name?: string | null;
  zip_code?: string | null;
  address?: string | null;
  contacts?: Array<{ type?: string; value?: string; isPrimary?: boolean }>;
  registrations?: Array<{ type?: string; value?: string }>;
  owner_ids?: Array<{ type?: string; value?: string }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toOption(row: CompanyRow, lang: SupportedLanguage = "en"): SearchSelectOption {
  const name = localizeTerm(row.name, lang);
  const legalName = row.legal_name ? localizeTerm(row.legal_name, lang) : null;
  const ownerName = row.owner_name ? transliterateProperNoun(row.owner_name, lang) : null;
  const label = legalName ? `${name} (${legalName})` : name;
  const keywords = [name, row.name, legalName, row.legal_name, ownerName, row.owner_name, row.country_name, row.city_name, row.base_currency].filter(Boolean).join(" ");
  return { value: row.id, label, keywords };
}

function guessOriginalLanguage(): "en" | "ar" | "ur" | "fa" | "ps" {
  const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  if (lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps") return lang;
  return "en";
}

export function CompanyPicker({
  label,
  value,
  onValueChange,
  disabled,
  placeholder,
  createButtonPlacement = "below"
}: {
  label: string;
  value: string;
  onValueChange: (companyId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below";
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  async function loadList() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("limit", "50");
      const res = await apiGet<{ companies: CompanyRow[] }>(`/api/erp/companies?${qp.toString()}`);
      setCompanies(res.companies ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value) return;
    if (companies.some((c) => c.id === value)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ company: CompanyRow }>(`/api/erp/companies/${encodeURIComponent(value)}`);
        if (cancelled) return;
        if (res.company) {
          setCompanies((current) => {
            if (current.some((c) => c.id === res.company.id)) return current;
            return [...current, res.company];
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const options: SearchSelectOption[] = useMemo(() => companies.map((c) => toOption(c, lang)), [companies, lang]);
  const [viewCompany, setViewCompany] = useState<CompanyRow | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);

  // Find all companies owned by the same owner when viewing a company. FK-first
  // (owner_person_id, set by PersonPicker in company-incorporation-form.tsx since
  // Phase 1) — fuzzy owner_name matching is only a fallback for legacy companies
  // registered before that FK existed.
  const ownerCompanies = useMemo(() => {
    if (!viewCompany) return [];
    if (viewCompany.owner_person_id) {
      const matches = companies.filter((c) => c.owner_person_id === viewCompany.owner_person_id);
      return matches.length > 0 ? matches : [viewCompany];
    }
    if (!viewCompany.owner_name) return [viewCompany];
    const ownerNameNorm = viewCompany.owner_name.trim().toLowerCase();
    const matches = companies.filter(
      (c) => c.owner_name && c.owner_name.trim().toLowerCase() === ownerNameNorm
    );
    return matches.length > 0 ? matches : [viewCompany];
  }, [viewCompany, companies]);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "branch.search_company", "Search company"))}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel={t(lang, "purchase.card_new_company_btn", "New Company")}
        createButtonPlacement={createButtonPlacement}
        onCreateNew={async () => setOpenCreate(true)}
        viewTitle={t(lang, "creg.cp_view_company_owner_details", "View Company & Owner Details")}
        editTitle={t(lang, "creg.cp_edit_company_master", "Edit Company Master")}
        onViewOption={(companyId) => {
          const found = companies.find((c) => c.id === companyId);
          if (found) setViewCompany(found);
        }}
        onEditOption={(companyId) => {
          setEditCompanyId(companyId);
        }}
      />

      {/* View Detail Modal */}
      {viewCompany ? (
        <SimpleModal
          title={`${t(lang, "creg.cp_company_details_dash", "Company Details —")} ${localizeTerm(viewCompany.name, lang)}`}
          onClose={() => setViewCompany(null)}
          className="w-[96vw] max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          <div className="p-5 space-y-5 text-xs text-slate-800 dark:text-slate-200">
            {/* Header Badge */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-black tracking-wide">{localizeTerm(viewCompany.name, lang)}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{t(lang, "creg.cp_legal_name_colon", "Legal Name:")} {viewCompany.legal_name ? localizeTerm(viewCompany.legal_name, lang) : "—"}</p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                  {viewCompany.is_active ? t(lang, "hr.pp_active_master", "Active Master") : t(lang, "god.inactive", "Inactive")}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">{t(lang, "purchase.currency_colon_label", "Currency:")} <span className="font-bold text-slate-800 dark:text-white">{viewCompany.base_currency}</span></p>
              </div>
            </div>

            {/* Owner Details Card */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {t(lang, "creg.cp_owner_investor_master_details", "Owner / Investor Master Details")}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {t(lang, "creg.cp_total_registered_companies_colon", "Total Registered Companies:")} {ownerCompanies.length}
                </span>
              </div>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {viewCompany.owner_name || t(lang, "creg.cp_primary_proprietor_corporate_group", "Primary Proprietor / Corporate Group")}
              </p>
            </div>

            {/* Attached / Registered Companies by same Owner */}
            {ownerCompanies.length > 1 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {t(lang, "creg.cp_other_companies_owned_by", "Other Companies Owned by")} {viewCompany.owner_name} ({ownerCompanies.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ownerCompanies.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        c.id === viewCompany.id
                          ? "bg-blue-50 border-blue-400 dark:bg-blue-900/30"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400"
                      }`}
                    >
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.city_name || c.country_name || "UAE"} • {c.base_currency}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onValueChange(c.id);
                          setViewCompany(null);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                      >
                        {t(lang, "common.select", "Select")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "company_form.business_type_label", "Business Type")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.business_type || "Commercial Trading"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "creg.cp_country_city", "Country / City")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.country_name || "UAE"} {viewCompany.city_name ? `/ ${viewCompany.city_name}` : ""}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "bdash.base_currency", "Base Currency")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.base_currency}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "purchase.f_address", "Address")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.address || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "creg.cp_tax_registration_id", "Tax / Registration ID")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">
                  {viewCompany.registrations?.map(r => r.value).join(", ") || t(lang, "creg.cp_standard_registration", "Standard Registration")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "creg.primary_contact", "Primary Contact")}</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {viewCompany.contacts?.map(ct => ct.value).join(", ") || "-"}
                </span>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditCompanyId(viewCompany.id);
                  setViewCompany(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang, "hr.pp_edit_master", "Edit Master")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewCompany(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  {t(lang, "purchase.close_btn", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewCompany.id);
                    setViewCompany(null);
                  }}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {t(lang, "creg.cp_select_this_company", "Select This Company")}
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Master Modal */}
      {editCompanyId ? (
        <SimpleModal
          title={t(lang, "creg.cp_edit_company_dash_master", "Edit Company - Company Master")}
          onClose={() => setEditCompanyId(null)}
          className="w-[96vw] max-w-[1100px] h-[90vh] max-h-[90vh] rounded-2xl font-sans"
        >
          <CompanyIncorporationForm
            mode="embedded"
            onSave={(updatedCompany) => {
              loadList().catch(() => null);
              if (updatedCompany.id) {
                onValueChange(updatedCompany.id);
              }
              setEditCompanyId(null);
            }}
          />
        </SimpleModal>
      ) : null}

      {/* Create New Modal */}
      {openCreate ? (
        <SimpleModal
          title={t(lang, "creg.cp_new_company_dash_master", "New Company - Company Master")}
          onClose={() => setOpenCreate(false)}
          className="w-[96vw] max-w-[1100px] h-[90vh] max-h-[90vh] rounded-2xl font-sans"
        >
          <CompanyIncorporationForm
            mode="embedded"
            onSave={(newCompany) => {
              loadList().catch(() => null);
              if (newCompany.id) {
                onValueChange(newCompany.id);
              }
              setOpenCreate(false);
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}



