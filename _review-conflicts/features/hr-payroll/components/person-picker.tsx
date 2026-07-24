"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";

type PersonRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
};

function toOption(row: PersonRow): SearchSelectOption {
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

export function PersonPicker({
  label,
  value,
  onValueChange,
  countryId,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onValueChange: (personId: string) => void;
  countryId?: string | null;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  async function loadList() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (countryId) qp.set("countryId", countryId);
      qp.set("limit", "50");
      const res = await apiGet<{ customers: PersonRow[] }>(`/api/erp/customers?${qp.toString()}`);
      setPeople(res.customers ?? []);
    } catch (e) {
      console.error(e);
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
    if (people.some((p) => p.id === value)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ customer: PersonRow }>(`/api/erp/customers/${encodeURIComponent(value)}`);
        if (cancelled) return;
        if (res.customer) {
          setPeople((current) => {
            if (current.some((p) => p.id === res.customer.id)) return current;
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

  const options: SearchSelectOption[] = useMemo(() => people.map(toOption), [people]);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? "Loading..." : "Search employee / person name")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel="+ Add New Person Master"
        createButtonPlacement="both"
        onCreateNew={async () => {
          setOpenCreate(true);
        }}
      />

      {openCreate ? (
        <SimpleModal
          title="New Person Registry — Customer Master"
          onClose={() => setOpenCreate(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <CustomerForm
            lang="en"
            mode="embedded"
            onSave={(newPersonId) => {
              loadList().catch(() => null);
              onValueChange(newPersonId);
              setOpenCreate(false);
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}
