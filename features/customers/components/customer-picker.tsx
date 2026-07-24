"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "./customer-form";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  original_language_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toOption(row: CustomerRow): SearchSelectOption {
  const label = row.company_name
    ? `${row.customer_name} (${row.company_name})`
    : row.customer_name;
  const keywords = [
    row.customer_name,
    row.company_name,
    row.contact_person,
    row.mobile,
    row.whatsapp,
    row.email
  ]
    .filter(Boolean)
    .join(" ");
  return { value: row.id, label, keywords };
}

function guessOriginalLanguage(): "en" | "ar" | "ur" | "fa" | "ps" {
  const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  if (lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps") return lang;
  return "en";
}

export function CustomerPicker({
  label,
  value,
  onValueChange,
  countryId,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onValueChange: (customerId: string) => void;
  countryId?: string | null;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  async function loadList() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (countryId) qp.set("countryId", countryId);
      qp.set("limit", "50");
      const res = await apiGet<{ customers: CustomerRow[] }>(`/api/erp/customers?${qp.toString()}`);
      setCustomers(res.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  useEffect(() => {
    if (!value) return;
    if (customers.some((c) => c.id === value)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ customer: CustomerRow }>(`/api/erp/customers/${encodeURIComponent(value)}`);
        if (cancelled) return;
        if (res.customer) {
          setCustomers((current) => {
            if (current.some((c) => c.id === res.customer.id)) return current;
            return [...current, res.customer];
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

  const options: SearchSelectOption[] = useMemo(() => customers.map(toOption), [customers]);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? "Loading..." : "Search customer")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel="+ New Customer"
        createButtonPlacement="both"
        onCreateNew={async () => {
          setOpenCreate(true);
        }}
      />

      {openCreate ? (
        <SimpleModal
          title="New Customer — Customer Master"
          onClose={() => setOpenCreate(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <CustomerForm
            lang={guessOriginalLanguage()}
            mode="embedded"
            onSave={(newCustomerId) => {
              loadList().catch(() => null);
              onValueChange(newCustomerId);
              setOpenCreate(false);
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}

