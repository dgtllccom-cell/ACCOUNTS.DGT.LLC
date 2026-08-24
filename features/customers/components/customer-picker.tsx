import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "./customer-form";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";

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

function toOption(row: CustomerRow, lang: string = "en"): SearchSelectOption {
  const customerName = transliterateProperNoun(row.customer_name, lang);
  const companyName = row.company_name ? localizeTerm(row.company_name, lang) : null;
  const label = companyName
    ? `${customerName} (${companyName})`
    : customerName;
  const keywords = [
    customerName,
    row.customer_name,
    companyName,
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
  const lang = useActiveLanguage();
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

  const options: SearchSelectOption[] = useMemo(() => customers.map((c) => toOption(c, lang)), [customers, lang]);
  const [viewCustomer, setViewCustomer] = useState<CustomerRow | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "cusm.cp_search_customer", "Search customer"))}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel={t(lang, "cusm.new_customer", "New Customer")}
        createButtonPlacement="both"
        onCreateNew={async () => {
          setOpenCreate(true);
        }}
        viewTitle={t(lang, "cusm.cp_view_customer_account_details", "View Customer & Account Details")}
        editTitle={t(lang, "cusm.cp_edit_customer_master", "Edit Customer Master")}
        onViewOption={(customerId) => {
          const found = customers.find((c) => c.id === customerId);
          if (found) setViewCustomer(found);
        }}
        onEditOption={(customerId) => {
          setEditCustomerId(customerId);
        }}
      />

      {/* View Customer Modal */}
      {viewCustomer ? (
        <SimpleModal
          title={`${t(lang, "cusm.cp_customer_details_dash", "Customer Details —")} ${transliterateProperNoun(viewCustomer.customer_name, lang)}`}
          onClose={() => setViewCustomer(null)}
          className="w-[96vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          <div className="p-5 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-black tracking-wide text-slate-900 dark:text-white">
                  {transliterateProperNoun(viewCustomer.customer_name, lang)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t(lang, "purchase.card_company_colon", "Company:")} <span className="font-bold text-slate-700 dark:text-slate-300">{viewCustomer.company_name ? localizeTerm(viewCustomer.company_name, lang) : t(lang, "hr.pp_independent", "Independent Account")}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                  {viewCustomer.is_active !== false ? t(lang, "cusm.cp_active_customer", "Active Customer") : t(lang, "god.inactive", "Inactive")}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">{t(lang, "cusm.cp_lang_colon", "Lang:")} <span className="font-bold text-slate-800 dark:text-white font-mono uppercase">{viewCustomer.original_language_code || "en"}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_contact_person", "Contact Person")}</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{viewCustomer.contact_person ? transliterateProperNoun(viewCustomer.contact_person, lang) : "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_mobile_phone", "Mobile Phone")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm" dir="ltr">{viewCustomer.mobile || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "purchase.dd_whatsapp", "WhatsApp")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">{viewCustomer.whatsapp || viewCustomer.mobile || "—"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_email_address", "Email Address")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs" dir="ltr">{viewCustomer.email || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "acct.created_on", "Created On")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{new Date(viewCustomer.created_at || Date.now()).toLocaleDateString("en-GB")}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_address_location", "Address / Location")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">{viewCustomer.address ? localizeTerm(viewCustomer.address, lang) : "—"}</span>
              </div>
            </div>

            {viewCustomer.notes && (
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                <span className="font-black block uppercase text-[9px] text-amber-600">{t(lang, "cusm.cp_notes_instructions_colon", "Notes / Instructions:")}</span>
                {viewCustomer.notes}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditCustomerId(viewCustomer.id);
                  setViewCustomer(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang, "hr.pp_edit_master", "Edit Master")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewCustomer(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  {t(lang, "purchase.close_btn", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewCustomer.id);
                    setViewCustomer(null);
                  }}
                  className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {t(lang, "cusm.cp_select_this_customer", "Select This Customer")}
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Customer Modal */}
      {editCustomerId ? (
        <SimpleModal
          title={t(lang, "cusm.cp_edit_customer_dash_master", "Edit Customer — Customer Master")}
          onClose={() => setEditCustomerId(null)}
          className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] rounded-2xl overflow-y-auto font-sans"
        >
          <CustomerForm
            lang={guessOriginalLanguage()}
            mode="embedded"
            initialCustomerId={editCustomerId}
            onSave={(updatedCustomerId) => {
              loadList().catch(() => null);
              onValueChange(updatedCustomerId);
              setEditCustomerId(null);
            }}
          />
        </SimpleModal>
      ) : null}

      {/* Create Customer Modal */}
      {openCreate ? (
        <SimpleModal
          title={t(lang, "cusm.cp_new_customer_dash_master", "New Customer — Customer Master")}
          onClose={() => setOpenCreate(false)}
          className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] rounded-2xl overflow-y-auto font-sans"
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

