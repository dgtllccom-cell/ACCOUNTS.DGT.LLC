import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "./customer-form";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
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
  country?: string | null;
  state?: string | null;
  city?: string | null;
  father_name?: string | null;
  business_type?: string | null;
  created_at: string;
  updated_at: string;
};

function toOption(row: CustomerRow, lang: SupportedLanguage = "en"): SearchSelectOption {
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
  const lang = useActiveLanguage() as SupportedLanguage;
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<CustomerRow | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("limit", "500");
      const res = await apiGet<{ customers: CustomerRow[] }>(`/api/erp/customers?${qp.toString()}`);
      let list = res.customers ?? [];
      if (countryId && list.length > 0) {
        // Sort country-matching customers first
        list = [...list].sort((a, b) => {
          const aMatch = a.country_id === countryId ? 1 : 0;
          const bMatch = b.country_id === countryId ? 1 : 0;
          return bMatch - aMatch;
        });
      }
      setCustomers(list);
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
          className="w-[96vw] max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          {(() => {
            let parsedData: any = null;
            let genuineRemarks = "";
            if (viewCustomer.notes) {
              const str = viewCustomer.notes.trim();
              if (str.startsWith("{") && str.endsWith("}")) {
                try {
                  parsedData = JSON.parse(str);
                  genuineRemarks = parsedData?.remarks || parsedData?.notes || "";
                } catch {
                  genuineRemarks = str;
                }
              } else {
                genuineRemarks = str;
              }
            }

            const docNumber = parsedData?.documents?.[0]?.number || parsedData?.nationalId || parsedData?.taxNumber;
            const docType = parsedData?.documents?.[0]?.type || "ID / Document";
            const busType = parsedData?.companyBusinessType || parsedData?.businessType || viewCustomer.business_type;
            const fatherName = parsedData?.fatherName || viewCustomer.father_name;
            const stateProv = parsedData?.stateProvince || viewCustomer.state;
            const cityName = parsedData?.city || viewCustomer.city;

            return (
              <div className="p-6 space-y-5 text-xs text-slate-800 dark:text-slate-200">
                {/* Header Banner */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-slate-900 border border-blue-100 dark:border-blue-900/50 p-4 sm:p-5 rounded-2xl">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 text-base">
                      {viewCustomer.customer_name ? viewCustomer.customer_name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                          {transliterateProperNoun(viewCustomer.customer_name, lang)}
                        </h3>
                        {fatherName ? (
                          <span className="text-xs text-slate-500 font-medium">
                            s/o {transliterateProperNoun(fatherName, lang)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {t(lang, "purchase.card_company_colon", "Company:")} <span className="font-bold text-blue-700 dark:text-blue-300">{viewCustomer.company_name ? localizeTerm(viewCustomer.company_name, lang) : t(lang, "hr.pp_independent", "Independent Account")}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100/80 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
                      {viewCustomer.is_active !== false ? t(lang, "cusm.cp_active_customer", "Active Customer") : t(lang, "god.inactive", "Inactive")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{t(lang, "cusm.cp_lang_colon", "Lang:")} <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{viewCustomer.original_language_code || "en"}</span></span>
                  </div>
                </div>

                {/* Structured Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {/* Card 1: Contact Information */}
                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950 shadow-2xs space-y-3">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider block border-b pb-1.5 border-slate-100 dark:border-slate-800">
                      {t(lang, "acct.contact_details_title", "Contact Channels")}
                    </span>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "hr.pp_mobile_phone", "Mobile Phone")}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-white text-xs" dir="ltr">{viewCustomer.mobile || "—"}</span>
                          {viewCustomer.mobile && (
                            <a href={`tel:${viewCustomer.mobile.replace(/[^0-9+]/g, "")}`} className="text-[10px] text-blue-600 hover:underline font-bold">{t(lang, "common.call", "Call")}</a>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "purchase.dd_whatsapp", "WhatsApp")}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs" dir="ltr">{viewCustomer.whatsapp || viewCustomer.mobile || "—"}</span>
                          {(viewCustomer.whatsapp || viewCustomer.mobile) && (
                            <a href={`https://wa.me/${String(viewCustomer.whatsapp || viewCustomer.mobile).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline font-bold">{t(lang, "common.chat", "Chat")}</a>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "hr.pp_email_address", "Email Address")}</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs break-all" dir="ltr">{viewCustomer.email || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Identity & Location */}
                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950 shadow-2xs space-y-3">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block border-b pb-1.5 border-slate-100 dark:border-slate-800">
                      {t(lang, "acct.location_identity_title", "Location & Identity")}
                    </span>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "hr.f_country", "Country & State")}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {viewCustomer.country ? localizeTerm(viewCustomer.country, lang) : "—"}{stateProv ? ` • ${localizeTerm(stateProv, lang)}` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "hr.f_city", "City")}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{cityName ? localizeTerm(cityName, lang) : "—"}</span>
                      </div>
                      {docNumber && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{docType}</span>
                          <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">{docNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Business & Registration */}
                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950 shadow-2xs space-y-3">
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block border-b pb-1.5 border-slate-100 dark:border-slate-800">
                      {t(lang, "acct.business_reg_title", "Registration & Account")}
                    </span>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "acct.contact_person_label", "Contact Person")}</span>
                        <span className="font-bold text-slate-800 dark:text-white text-xs">{viewCustomer.contact_person ? transliterateProperNoun(viewCustomer.contact_person, lang) : "—"}</span>
                      </div>
                      {busType && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "acct.business_type_label", "Business Nature")}</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300 text-xs">{localizeTerm(busType, lang)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{t(lang, "acct.created_on", "Created On")}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{new Date(viewCustomer.created_at || Date.now()).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Full Width Address */}
                  <div className="sm:col-span-2 md:col-span-3 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50/60 dark:bg-slate-900/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">{t(lang, "hr.pp_address_location", "Registered Address / Location")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-relaxed">{viewCustomer.address ? localizeTerm(viewCustomer.address, lang) : "—"}</span>
                  </div>
                </div>

                {/* Genuine Remarks Box (Clean Text Only) */}
                {genuineRemarks ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <span className="font-black uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400 block">{t(lang, "cusm.cp_notes_instructions_colon", "Notes / Instructions:")}</span>
                    <p className="font-medium leading-relaxed">{genuineRemarks}</p>
                  </div>
                ) : null}

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditCustomerId(viewCustomer.id);
                      setViewCustomer(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    {t(lang, "hr.pp_edit_master", "Edit Master")}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewCustomer(null)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                    >
                      {t(lang, "purchase.close_btn", "Close")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onValueChange(viewCustomer.id);
                        setViewCustomer(null);
                      }}
                      className="px-6 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm cursor-pointer"
                    >
                      {t(lang, "cusm.cp_select_this_customer", "Select This Customer")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
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
