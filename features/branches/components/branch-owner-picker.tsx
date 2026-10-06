"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";

const ROLE_KEY_MAP: Record<string, string> = {
  "staff user": "role.staff_user",
  "super_admin": "role.super_admin",
  "country_admin": "role.country_admin",
  "Global": "common.global"
};

function localizeRoleDesc(role: string, lang: string): string {
  if (!role) return role;
  const key = ROLE_KEY_MAP[role];
  if (!key) return role;
  return t(lang as never, key as never, role);
}

type OwnerCustomerRow = {
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
};

type OwnerProfileRow = {
  userId: string;
  userCode: string;
  fullName: string;
  countryName: string;
  branchName: string;
  branchType: string;
  role: string;
};

function toOwnerOption(
  value: string,
  label: string,
  keywords?: string,
  rich?: { primaryText?: string; secondaryText?: string; code?: string; branch?: string; country?: string }
): SearchSelectOption {
  return { value, label, keywords, ...rich };
}

// Some bootstrap/demo profiles (dev seed users) carry non-UUID ids like "temp-super-admin"
// instead of a real profiles.id — those can't be stored in owner_profile_id (a real FK column),
// so they're excluded from the picker rather than letting a save silently fail downstream.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OwnerKind = "customer" | "profile";
export type ResolvedOwner = { kind: OwnerKind; id: string; name: string } | null;

function guessOriginalLanguage(): "en" | "ar" | "ur" | "fa" | "ps" {
  const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  if (lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps") return lang;
  return "en";
}

export function BranchOwnerPicker({
  value,
  onValueChange,
  onOwnerResolved,
  disabled,
  placeholder,
  createButtonPlacement = "below"
}: {
  value: string;
  onValueChange: (value: string) => void;
  onOwnerResolved?: (owner: ResolvedOwner) => void;
  disabled?: boolean;
  placeholder?: string;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below";
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [ownerKindById, setOwnerKindById] = useState<Map<string, OwnerKind>>(new Map());
  const [customerRowById, setCustomerRowById] = useState<Map<string, OwnerCustomerRow>>(new Map());
  const [viewOwner, setViewOwner] = useState<OwnerCustomerRow | null>(null);
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const defaultPlaceholder = t(lang as never, "bop.search_owner" as never, "Search owner");
  const defaultCreateLabel = t(lang as never, "bop.new_owner" as never, "New Owner");
  const defaultOwnerLabel = t(lang as never, "bop.owner_name" as never, "Owner Name");

  async function loadList() {
    setLoading(true);
    try {
      const [customersRes, usersRes] = await Promise.all([
        apiGet<{ customers: OwnerCustomerRow[] }>("/api/erp/customers?limit=50"),
        apiGet<{ rows: OwnerProfileRow[] }>("/api/erp/users/journal-report?limit=50")
      ]);

      const next: SearchSelectOption[] = [];
      const kindById = new Map<string, OwnerKind>();
      const customerRows = new Map<string, OwnerCustomerRow>();
      for (const row of customersRes.customers ?? []) {
        const label = row.company_name ? `${row.customer_name} (${row.company_name})` : row.customer_name;
        next.push(
          toOwnerOption(
            row.id,
            label,
            [row.customer_name, row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email].filter(Boolean).join(" "),
            {
              primaryText: row.customer_name,
              secondaryText: row.company_name || undefined,
              code: row.person_code || undefined,
              branch: row.city_name || undefined,
              country: row.country_name || undefined
            }
          )
        );
        kindById.set(row.id, "customer");
        customerRows.set(row.id, row);
      }
      for (const row of usersRes.rows ?? []) {
        if (!UUID_RE.test(row.userId)) continue;
        const localizedRole = localizeRoleDesc(row.role, lang);
        const localizedBranch = row.branchName === "Global" ? localizeRoleDesc("Global", lang) : row.branchName;
        const label = [row.fullName, localizedRole, localizedBranch].filter(Boolean).join(" · ");
        next.push(
          toOwnerOption(
            row.userId,
            label,
            [row.userCode, row.fullName, row.countryName, row.branchName, row.role].join(" "),
            {
              primaryText: row.fullName,
              secondaryText: localizedRole || undefined,
              code: row.userCode || undefined,
              branch: row.branchName === "Global" ? undefined : row.branchName || undefined,
              country: row.countryName || undefined
            }
          )
        );
        kindById.set(row.userId, "profile");
      }

      const unique = new Map<string, SearchSelectOption>();
      for (const item of next) {
        if (!unique.has(item.value)) unique.set(item.value, item);
      }
      setOptions(Array.from(unique.values()));
      setOwnerKindById(kindById);
      setCustomerRowById(customerRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const finalOptions = useMemo(() => {
    if (value && !options.some((opt) => opt.value === value)) {
      return [...options, { value, label: value }];
    }
    return options;
  }, [options, value]);

  return (
    <>
      <SearchSelect
        label={defaultOwnerLabel}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang as never, "common.loading" as never, "Loading...") : defaultPlaceholder)}
        disabled={disabled || loading}
        options={finalOptions}
        richList
        viewTitle={t(lang as never, "common.view" as never, "View Details")}
        editTitle={t(lang as never, "common.edit" as never, "Edit")}
        printTitle={t(lang as never, "common.print" as never, "Print")}
        onViewOption={(id) => {
          const kind = ownerKindById.get(id);
          if (kind !== "customer") return;
          const row = customerRowById.get(id);
          if (row) setViewOwner(row);
        }}
        onEditOption={(id) => {
          const kind = ownerKindById.get(id);
          if (kind !== "customer") return;
          setEditOwnerId(id);
        }}
        onPrintOption={(id) => {
          const kind = ownerKindById.get(id);
          if (kind !== "customer") return;
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
          if (!onOwnerResolved) return;
          if (!id) {
            onOwnerResolved(null);
            return;
          }
          const kind = ownerKindById.get(id) ?? null;
          const label = options.find((opt) => opt.value === id)?.label ?? id;
          onOwnerResolved(kind ? { kind, id, name: label } : null);
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
                  // Wait a brief moment for database commit consistency
                  await new Promise((resolve) => setTimeout(resolve, 150));

                  // 1. Fetch list of customers to see if we find it
                  const customersRes = await apiGet<{ customers: OwnerCustomerRow[] }>("/api/erp/customers?limit=250");
                  const found = customersRes.customers?.find((c) => c.id === newCustomerId);

                  let label = "";
                  let rawCustomer: any = null;

                  if (found) {
                    rawCustomer = found;
                    const customerName = found.customer_name || (found as any).customerName;
                    const companyName = found.company_name || (found as any).companyName;
                    label = companyName ? `${customerName} (${companyName})` : customerName;
                  } else {
                    // Fallback to fetch single customer
                    const res = await apiGet<{ customer: OwnerCustomerRow }>(`/api/erp/customers/${encodeURIComponent(newCustomerId)}`);
                    if (res.customer) {
                      rawCustomer = res.customer;
                      const customerName = res.customer.customer_name || (res.customer as any).customerName;
                      const companyName = res.customer.company_name || (res.customer as any).companyName;
                      label = companyName ? `${customerName} (${companyName})` : customerName;
                    }
                  }

                  if (label && rawCustomer) {
                    const customerName = rawCustomer.customer_name || rawCustomer.customerName || "";
                    const companyName = rawCustomer.company_name || rawCustomer.companyName || "";
                    const option = toOwnerOption(
                      newCustomerId,
                      label,
                      [
                        customerName,
                        companyName,
                        rawCustomer.contact_person || rawCustomer.contactPerson,
                        rawCustomer.mobile,
                        rawCustomer.whatsapp,
                        rawCustomer.email
                      ]
                        .filter(Boolean)
                        .join(" ")
                    );

                    // Add new option immediately to local state
                    setOptions((current) => {
                      if (current.some((item) => item.value === newCustomerId)) return current;
                      return [option, ...current];
                    });
                    setOwnerKindById((current) => {
                      const next = new Map(current);
                      next.set(newCustomerId, "customer");
                      return next;
                    });

                    // Trigger selection
                    onValueChange(newCustomerId);
                    onOwnerResolved?.({ kind: "customer", id: newCustomerId, name: label });
                  }

                  // Reload full list to ensure data is synced
                  await loadList();
                } catch (err) {
                  console.error("Error loading new owner customer details:", err);
                  // Reload list as ultimate fallback
                  loadList().catch(() => null);
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
              await loadList();
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}

