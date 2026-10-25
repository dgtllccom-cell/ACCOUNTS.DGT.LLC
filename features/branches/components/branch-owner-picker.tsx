"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";

export type OwnerCustomerRow = {
  id: string;
  customer_name: string;
  person_code?: string | null;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address?: string | null;
  country_name?: string | null;
  city_name?: string | null;
  country_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type OwnerKind = "customer" | "profile";
export type ResolvedOwner = {
  kind: OwnerKind;
  id: string;
  name: string;
  customer?: OwnerCustomerRow | null;
} | null;

function toOwnerOption(
  row: OwnerCustomerRow,
  isCompanyOwner: boolean = false,
  lang: string = "en"
): SearchSelectOption {
  const customerName = row.customer_name;
  const companyName = row.company_name;
  const label = companyName ? `${customerName} (${companyName})` : customerName;

  let secondaryText: string | undefined = companyName || undefined;
  if (isCompanyOwner) {
    const ownerBadge = t(lang as never, "bop.company_owner" as never, "Company Owner");
    secondaryText = companyName ? `★ ${ownerBadge} • ${companyName}` : `★ ${ownerBadge}`;
  } else if (row.mobile || row.whatsapp) {
    secondaryText = [companyName, row.mobile || row.whatsapp].filter(Boolean).join(" • ");
  }

  const keywords = [
    row.customer_name,
    row.first_name,
    row.last_name,
    row.person_code,
    row.mobile,
    row.whatsapp,
    row.email,
    row.company_name,
    row.contact_person,
    row.address,
    row.city_name,
    row.country_name,
    isCompanyOwner ? "company owner linked owner" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    value: row.id,
    label,
    keywords,
    primaryText: row.customer_name,
    secondaryText,
    code: row.person_code || undefined,
    branch: row.city_name || undefined,
    country: row.country_name || undefined
  };
}

function guessOriginalLanguage(): "en" | "ar" | "ur" | "fa" | "ps" {
  const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  if (lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps") return lang;
  return "en";
}

export function BranchOwnerPicker({
  value,
  onValueChange,
  onOwnerResolved,
  onCustomerSelected,
  companyId,
  countryId,
  disabled,
  placeholder,
  createButtonPlacement = "below"
}: {
  value: string;
  onValueChange: (value: string) => void;
  onOwnerResolved?: (owner: ResolvedOwner, customer?: OwnerCustomerRow | null) => void;
  onCustomerSelected?: (customer: OwnerCustomerRow | null) => void;
  companyId?: string;
  countryId?: string;
  disabled?: boolean;
  placeholder?: string;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below" | "inside";
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [customerRowById, setCustomerRowById] = useState<Map<string, OwnerCustomerRow>>(new Map());
  const [companyOwnerId, setCompanyOwnerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [viewOwner, setViewOwner] = useState<OwnerCustomerRow | null>(null);
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const defaultPlaceholder = t(lang as never, "bop.search_owner" as never, "Search owner");
  const defaultCreateLabel = t(lang as never, "bop.new_owner" as never, "New Owner");
  const defaultOwnerLabel = t(lang as never, "bop.owner_name" as never, "Owner Name");

  // 1. Initial list of customers (up to 100)
  async function loadInitialList() {
    setLoading(true);
    try {
      const url = `/api/erp/customers?limit=100${countryId ? `&countryId=${encodeURIComponent(countryId)}` : ""}`;
      const res = await apiGet<{ customers: OwnerCustomerRow[] }>(url);
      setCustomerRowById((prev) => {
        const next = new Map(prev);
        for (const row of res.customers ?? []) {
          next.set(row.id, row);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load customer list for owner picker:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, countryId]);

  // 2. When companyId changes, fetch the company to discover the linked owner_person_id
  useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setCompanyOwnerId(null);
      return;
    }
    (async () => {
      try {
        const res = await apiGet<{ company: { owner_person_id?: string | null; owner_name?: string | null } }>(
          `/api/erp/companies/${encodeURIComponent(companyId)}`
        );
        if (cancelled) return;
        const ownerPersonId = res.company?.owner_person_id || null;
        setCompanyOwnerId(ownerPersonId);

        if (ownerPersonId) {
          // If customer record not already loaded, fetch it directly
          if (!customerRowById.has(ownerPersonId)) {
            try {
              const custRes = await apiGet<{ customer: OwnerCustomerRow }>(
                `/api/erp/customers/${encodeURIComponent(ownerPersonId)}`
              );
              if (!cancelled && custRes.customer) {
                setCustomerRowById((prev) => {
                  const next = new Map(prev);
                  next.set(custRes.customer.id, custRes.customer);
                  return next;
                });
              }
            } catch {
              // Ignore single customer load error
            }
          }
        }
      } catch {
        if (!cancelled) setCompanyOwnerId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // 3. Debounced server-side search when user types in SearchSelect
  useEffect(() => {
    let cancelled = false;
    const q = searchTerm.trim();
    if (!q) return;

    const timer = setTimeout(async () => {
      try {
        const url = `/api/erp/customers?q=${encodeURIComponent(q)}&limit=100${
          countryId ? `&countryId=${encodeURIComponent(countryId)}` : ""
        }`;
        const res = await apiGet<{ customers: OwnerCustomerRow[] }>(url);
        if (cancelled || !res.customers) return;

        setCustomerRowById((prev) => {
          const next = new Map(prev);
          for (const row of res.customers) {
            next.set(row.id, row);
          }
          return next;
        });
      } catch {
        // Ignore search error
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, countryId]);

  // 4. If a value is provided and not yet in customerRowById, fetch it
  useEffect(() => {
    let cancelled = false;
    if (!value) return;

    if (customerRowById.has(value)) {
      const row = customerRowById.get(value)!;
      onOwnerResolved?.(
        { kind: "customer", id: row.id, name: row.customer_name, customer: row },
        row
      );
      onCustomerSelected?.(row);
      return;
    }

    (async () => {
      try {
        const res = await apiGet<{ customer: OwnerCustomerRow }>(
          `/api/erp/customers/${encodeURIComponent(value)}`
        );
        if (cancelled || !res.customer) return;
        const row = res.customer;
        setCustomerRowById((prev) => {
          const next = new Map(prev);
          next.set(row.id, row);
          return next;
        });
        onOwnerResolved?.(
          { kind: "customer", id: row.id, name: row.customer_name, customer: row },
          row
        );
        onCustomerSelected?.(row);
      } catch {
        // Value might be a non-UUID or deleted record
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, customerRowById.has(value)]);

  // 5. Build options with Company Linked Owner prioritized at the top
  const options = useMemo(() => {
    const list: SearchSelectOption[] = [];
    const seen = new Set<string>();

    // 1. Company Linked Owner at the very top
    if (companyOwnerId && customerRowById.has(companyOwnerId)) {
      const row = customerRowById.get(companyOwnerId)!;
      list.push(toOwnerOption(row, true, lang));
      seen.add(row.id);
    }

    // 2. Selected value if loaded and not already added
    if (value && customerRowById.has(value) && !seen.has(value)) {
      const row = customerRowById.get(value)!;
      list.push(toOwnerOption(row, row.id === companyOwnerId, lang));
      seen.add(row.id);
    }

    // 3. All other eligible Person / Customer master records
    for (const [id, row] of customerRowById.entries()) {
      if (!seen.has(id)) {
        list.push(toOwnerOption(row, false, lang));
        seen.add(id);
      }
    }

    // 4. Fallback if value exists but row not yet fetched
    if (value && !seen.has(value)) {
      list.push({ value, label: value });
    }

    return list;
  }, [customerRowById, companyOwnerId, value, lang]);

  return (
    <>
      <SearchSelect
        label={defaultOwnerLabel}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang as never, "common.loading" as never, "Loading...") : defaultPlaceholder)}
        disabled={disabled || loading}
        options={options}
        richList
        onSearchValueChange={setSearchTerm}
        viewTitle={t(lang as never, "common.view" as never, "View Details")}
        editTitle={t(lang as never, "common.edit" as never, "Edit")}
        printTitle={t(lang as never, "common.print" as never, "Print")}
        onViewOption={(id) => {
          const row = customerRowById.get(id);
          if (row) setViewOwner(row);
        }}
        onEditOption={(id) => {
          setEditOwnerId(id);
        }}
        onPrintOption={(id) => {
          const row = customerRowById.get(id);
          if (!row) return;
          openMasterProfileReportWindow({
            lang,
            title: t(lang as never, "hr.pp_print_title" as never, "Person / Customer Master"),
            subtitle: t(lang as never, "hr.pp_print_subtitle" as never, "Person Master Profile"),
            name: row.customer_name,
            status: t(lang as never, "god.active" as never, "Active"),
            meta: [
              { label: t(lang as never, "hr.pp_code" as never, "Person Code"), value: row.person_code || "-" },
              { label: t(lang as never, "roz.owner_customer" as never, "Owner / Customer"), value: row.customer_name },
              { label: t(lang as never, "common.country" as never, "Country"), value: row.country_name || "-" },
              { label: t(lang as never, "company_form.section_location" as never, "Location"), value: row.city_name || "-" }
            ],
            sections: [
              {
                title: t(lang as never, "hr.pp_section_details" as never, "Details"),
                rows: [
                  { label: t(lang as never, "hr.pp_company" as never, "Company"), value: row.company_name || "-" },
                  { label: t(lang as never, "roz.cef_mobile_ph" as never, "Mobile / Ph"), value: row.mobile || "-" },
                  { label: t(lang as never, "purchase.dd_whatsapp" as never, "WhatsApp"), value: row.whatsapp || "-" },
                  { label: t(lang as never, "purchase.dd_email" as never, "Email"), value: row.email || "-" },
                  { label: t(lang as never, "company_form.section_location" as never, "Address"), value: row.address || "-" }
                ]
              }
            ]
          });
        }}
        onValueChange={(id) => {
          onValueChange(id);
          if (!id) {
            onOwnerResolved?.(null, null);
            onCustomerSelected?.(null);
            return;
          }
          const row = customerRowById.get(id) || null;
          const label = row
            ? row.company_name
              ? `${row.customer_name} (${row.company_name})`
              : row.customer_name
            : id;
          onOwnerResolved?.({ kind: "customer", id, name: label, customer: row }, row);
          onCustomerSelected?.(row);
        }}
        createLabel={defaultCreateLabel}
        createButtonPlacement={createButtonPlacement}
        onCreateNew={async () => setOpenCreate(true)}
      />

      {openCreate ? (
        <SimpleModal
          title={t(lang as never, "bop.new_owner_modal_title" as never, "New Owner — Customer Master")}
          onClose={() => setOpenCreate(false)}
          className="w-[96vw] max-w-[1100px] h-[90vh] max-h-[90vh] rounded-2xl font-sans"
        >
          <CustomerForm
            lang={guessOriginalLanguage()}
            mode="embedded"
            onSave={(newCustomerId) => {
              (async () => {
                try {
                  await new Promise((resolve) => setTimeout(resolve, 150));
                  const res = await apiGet<{ customer: OwnerCustomerRow }>(
                    `/api/erp/customers/${encodeURIComponent(newCustomerId)}`
                  );
                  if (res.customer) {
                    const row = res.customer;
                    setCustomerRowById((prev) => {
                      const next = new Map(prev);
                      next.set(row.id, row);
                      return next;
                    });
                    const label = row.company_name ? `${row.customer_name} (${row.company_name})` : row.customer_name;
                    onValueChange(newCustomerId);
                    onOwnerResolved?.({ kind: "customer", id: newCustomerId, name: label, customer: row }, row);
                    onCustomerSelected?.(row);
                  }
                  await loadInitialList();
                } catch (err) {
                  console.error("Error loading new owner customer details:", err);
                  loadInitialList().catch(() => null);
                } finally {
                  setOpenCreate(false);
                }
              })();
            }}
          />
        </SimpleModal>
      ) : null}

      {viewOwner ? (
        <SimpleModal
          title={`${t(lang as never, "hr.pp_view_title" as never, "Person / Account Details")} — ${viewOwner.customer_name}`}
          onClose={() => setViewOwner(null)}
          className="w-[96vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          <div className="p-5 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-black tracking-wide text-slate-900 dark:text-white">{viewOwner.customer_name}</h3>
                {viewOwner.person_code ? (
                  <p className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5">{viewOwner.person_code}</p>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t(lang as never, "hr.pp_company" as never, "Company")}: <span className="font-bold text-slate-700 dark:text-slate-300">{viewOwner.company_name || t(lang as never, "hr.pp_independent" as never, "Independent Account")}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang as never, "hr.pp_mobile_phone" as never, "Mobile Phone")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm" dir="ltr">{viewOwner.mobile || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang as never, "sed.f_whatsapp" as never, "WhatsApp")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">{viewOwner.whatsapp || viewOwner.mobile || "—"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang as never, "hr.pp_email_address" as never, "Email Address")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs" dir="ltr">{viewOwner.email || "—"}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang as never, "hr.pp_address_location" as never, "Address / Location")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">{viewOwner.address || "—"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditOwnerId(viewOwner.id);
                  setViewOwner(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang as never, "hr.pp_edit_master" as never, "Edit Master")}
              </button>
              <button
                type="button"
                onClick={() => setViewOwner(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
              >
                {t(lang as never, "common.close" as never, "Close")}
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {editOwnerId ? (
        <SimpleModal
          title={t(lang as never, "hr.pp_edit_person_registry" as never, "Edit Person Registry — Customer Master")}
          onClose={() => setEditOwnerId(null)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <CustomerForm
            lang={guessOriginalLanguage()}
            mode="embedded"
            initialCustomerId={editOwnerId}
            onClose={() => setEditOwnerId(null)}
            onSave={async (savedId) => {
              setEditOwnerId(null);
              onValueChange(savedId);
              try {
                const res = await apiGet<{ customer: OwnerCustomerRow }>(
                  `/api/erp/customers/${encodeURIComponent(savedId)}`
                );
                if (res.customer) {
                  const row = res.customer;
                  setCustomerRowById((prev) => {
                    const next = new Map(prev);
                    next.set(row.id, row);
                    return next;
                  });
                  const label = row.company_name ? `${row.customer_name} (${row.company_name})` : row.customer_name;
                  onOwnerResolved?.({ kind: "customer", id: savedId, name: label, customer: row }, row);
                  onCustomerSelected?.(row);
                }
              } catch {
                // Ignore
              }
              await loadInitialList();
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}
