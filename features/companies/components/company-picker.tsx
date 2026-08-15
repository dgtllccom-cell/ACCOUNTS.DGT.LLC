"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CompanyIncorporationForm } from "./company-incorporation-form";

export type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  base_currency: string;
  owner_name?: string | null;
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

function toOption(row: CompanyRow): SearchSelectOption {
  const label = row.legal_name ? `${row.name} (${row.legal_name})` : row.name;
  const keywords = [row.name, row.legal_name, row.owner_name, row.country_name, row.city_name, row.base_currency].filter(Boolean).join(" ");
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

  const options: SearchSelectOption[] = useMemo(() => companies.map(toOption), [companies]);
  const [viewCompany, setViewCompany] = useState<CompanyRow | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);

  // Find all companies owned by the same owner when viewing a company
  const ownerCompanies = useMemo(() => {
    if (!viewCompany || !viewCompany.owner_name) return [viewCompany].filter(Boolean) as CompanyRow[];
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
        placeholder={placeholder ?? (loading ? "Loading..." : "Search company")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel="New Company"
        createButtonPlacement={createButtonPlacement}
        onCreateNew={async () => setOpenCreate(true)}
        viewTitle="View Company & Owner Details"
        editTitle="Edit Company Master"
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
          title={`Company Details — ${viewCompany.name}`}
          onClose={() => setViewCompany(null)}
          className="w-[96vw] max-w-[850px] max-h-[85vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="p-4 space-y-5 text-xs text-slate-800 dark:text-slate-200">
            {/* Header Badge */}
            <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-xl">
              <div>
                <h3 className="text-base font-black uppercase tracking-wide">{viewCompany.name}</h3>
                <p className="text-xs text-slate-300 font-medium">Legal Name: {viewCompany.legal_name || "-"}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  {viewCompany.is_active ? "Active Master" : "Inactive"}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Currency: <span className="font-bold text-white">{viewCompany.base_currency}</span></p>
              </div>
            </div>

            {/* Owner Details Card */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Owner / Investor Master Details
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  Total Registered Companies: {ownerCompanies.length}
                </span>
              </div>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {viewCompany.owner_name || "Primary Proprietor / Corporate Group"}
              </p>
            </div>

            {/* Attached / Registered Companies by same Owner */}
            {ownerCompanies.length > 1 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Other Companies Owned by {viewCompany.owner_name} ({ownerCompanies.length})
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
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Business Type</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.business_type || "Commercial Trading"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Country / City</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.country_name || "UAE"} {viewCompany.city_name ? `/ ${viewCompany.city_name}` : ""}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Base Currency</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.base_currency}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Address</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewCompany.address || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Tax / Registration ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">
                  {viewCompany.registrations?.map(r => r.value).join(", ") || "Standard Registration"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Primary Contact</span>
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
                Edit Master
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewCompany(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewCompany.id);
                    setViewCompany(null);
                  }}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  Select This Company
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Master Modal */}
      {editCompanyId ? (
        <SimpleModal
          title="Edit Company - Company Master"
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
          title="New Company - Company Master"
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



