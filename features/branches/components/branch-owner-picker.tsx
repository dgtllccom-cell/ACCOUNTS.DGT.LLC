"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

const ROLE_I18N: Record<string, Record<string, string>> = {
  "staff user": { ur: "اسٹاف یوزر", ar: "مستخدم موظف", ps: "د کارمندانو کارن", fa: "کاربر کارمند" },
  "super_admin": { ur: "سپر ایڈمن", ar: "مشرف عام", ps: "سوپر اډمین", fa: "سوپر ادمین" },
  "country_admin": { ur: "کنٹری ایڈمن", ar: "مشرف الدولة", ps: "د هیواد اډمین", fa: "ادمین کشور" },
  "Global": { ur: "گلوبل", ar: "عام", ps: "نړیوال", fa: "سراسری" }
};

function localizeRoleDesc(role: string, lang: string): string {
  if (!role || lang === "en") return role;
  const match = ROLE_I18N[role];
  if (match && match[lang]) return match[lang];
  return role;
}

type OwnerCustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address?: string | null;
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

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toOwnerOption(value: string, label: string, keywords?: string): SearchSelectOption {
  return { value, label, keywords };
}

function guessOriginalLanguage(): "en" | "ar" | "ur" | "fa" | "ps" {
  const lang = (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  if (lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps") return lang;
  return "en";
}

export function BranchOwnerPicker({
  value,
  onValueChange,
  disabled,
  placeholder,
  createButtonPlacement = "below"
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below";
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [openCreate, setOpenCreate] = useState(false);

  const defaultPlaceholder = lang === "ur" ? "مالک تلاش کریں" : lang === "ps" ? "مالک وپلټئ" : lang === "ar" ? "البحث عن المالك" : "Search owner";
  const defaultCreateLabel = lang === "ur" ? "+ نیا مالک" : lang === "ps" ? "+ نوی مالک" : lang === "ar" ? "+ مالك جديد" : "New Owner";
  const defaultOwnerLabel = lang === "ur" ? "مالک کا نام" : lang === "ps" ? "د مالک نوم" : lang === "ar" ? "اسم المالك" : "Owner Name";

  async function loadList() {
    setLoading(true);
    try {
      const [customersRes, usersRes] = await Promise.all([
        apiGet<{ customers: OwnerCustomerRow[] }>("/api/erp/customers?limit=50"),
        apiGet<{ rows: OwnerProfileRow[] }>("/api/erp/users/journal-report?limit=50")
      ]);

      const next: SearchSelectOption[] = [];
      for (const row of customersRes.customers ?? []) {
        const label = row.company_name ? `${row.customer_name} (${row.company_name})` : row.customer_name;
        next.push(
          toOwnerOption(
            row.customer_name,
            label,
            [row.customer_name, row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email].filter(Boolean).join(" ")
          )
        );
      }
      for (const row of usersRes.rows ?? []) {
        const localizedRole = localizeRoleDesc(row.role, lang);
        const localizedBranch = row.branchName === "Global" ? localizeRoleDesc("Global", lang) : row.branchName;
        const label = [row.fullName, localizedRole, localizedBranch].filter(Boolean).join(" · ");
        next.push(toOwnerOption(row.fullName, label, [row.userCode, row.fullName, row.countryName, row.branchName, row.role].join(" ")));
      }

      const unique = new Map<string, SearchSelectOption>();
      for (const item of next) {
        if (!unique.has(normalize(item.value))) unique.set(normalize(item.value), item);
      }
      setOptions(Array.from(unique.values()));
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
        placeholder={placeholder ?? (loading ? (lang === "ur" ? "لوڈ ہو رہا ہے..." : "Loading...") : defaultPlaceholder)}
        disabled={disabled || loading}
        options={finalOptions}
        onValueChange={onValueChange}
        createLabel={defaultCreateLabel}
        createButtonPlacement={createButtonPlacement}
        onCreateNew={async () => setOpenCreate(true)}
      />

      {openCreate ? (
        <SimpleModal
          title="New Owner — Customer Master"
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
                      customerName,
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
                      if (current.some((item) => normalize(item.value) === normalize(option.value))) return current;
                      return [option, ...current];
                    });
                    
                    // Trigger selection
                    onValueChange(label);
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
    </>
  );
}

