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

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? "Loading..." : "Search company")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel="+ New Company"
        createButtonPlacement={createButtonPlacement}
        onCreateNew={async () => setOpenCreate(true)}
      />

      {openCreate ? (
        <SimpleModal
          title="New Company - Company Master"
          onClose={() => setOpenCreate(false)}
          className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto"
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



