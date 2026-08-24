import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPost } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";

type PersonRow = {
  id: string;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  photo_url: string | null;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
};

/** Prefer the localized customer_name if present; fall back to first + last name. */
export function personFullName(row: { first_name?: string | null; last_name?: string | null; customer_name?: string | null }): string {
  if (row?.customer_name && row.customer_name.trim()) {
    return row.customer_name.trim();
  }
  const structured = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim();
  return structured || "";
}

function toOption(row: PersonRow, lang: string = "en"): SearchSelectOption {
  const rawName = personFullName(row);
  const name = transliterateProperNoun(rawName, lang as SupportedLanguage);
  const fatherRaw = (row as any).father_name || ((row as any).contact_person && (row as any).contact_person !== rawName ? (row as any).contact_person : null);
  const father = fatherRaw && !fatherRaw.startsWith("+") && isNaN(Number(fatherRaw)) ? transliterateProperNoun(fatherRaw, lang as SupportedLanguage) : null;
  const companyRaw = row.company_name && row.company_name !== rawName ? row.company_name : null;
  const company = companyRaw ? localizeTerm(companyRaw, lang as SupportedLanguage) : null;
  
  // Format clean name display with proper localization
  let extraBits: string[] = [];
  if (father) {
    const fatherPrefix = lang === "ur" ? "ولدیت:" : lang === "ar" ? "ابن:" : lang === "fa" ? "فرزند:" : lang === "ps" ? "د پلار نوم:" : "s/o:";
    extraBits.push(`${fatherPrefix} ${father}`);
  } else if (company) {
    extraBits.push(company);
  }
  
  const label = extraBits.length > 0 ? `${name} (${extraBits.join(" · ")})` : name;
  const keywords = [
    name, rawName, row.customer_name, row.first_name, row.last_name,
    father, fatherRaw, company, companyRaw
  ].filter(Boolean).join(" ");
  return { value: row.id, label, keywords };
}

export function PersonPicker({
  label,
  value,
  onValueChange,
  countryId,
  disabled,
  placeholder,
  lang: langProp
}: {
  label: string;
  value: string;
  onValueChange: (personId: string) => void;
  countryId?: string | null;
  disabled?: boolean;
  placeholder?: string;
  lang?: SupportedLanguage;
}) {
  const activeLang = useActiveLanguage();
  const lang = (langProp && langProp !== "en") ? langProp : activeLang;
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (countryId) qp.set("countryId", countryId);
      qp.set("limit", "100");
      // Resolve customer_name/company_name into the active language server-side
      qp.set("lang", lang);
      const res = await apiGet<{ customers: PersonRow[] }>(`/api/erp/customers?${qp.toString()}`);
      setPeople(res.customers ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickCreatePerson(name: string) {
    if (!name || !name.trim()) return;
    setLoading(true);
    try {
      const trimmed = name.trim();
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0] || trimmed;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

      const res = await apiPost<{ customer?: PersonRow; id?: string }>("/api/erp/customers", {
        customerName: trimmed,
        firstName,
        lastName,
        countryId: countryId || undefined,
        originalLanguage: lang
      });

      const newId = res?.customer?.id || (res as any)?.id;
      if (newId) {
        const createdRow: PersonRow = res?.customer || {
          id: newId,
          customer_name: trimmed,
          first_name: firstName,
          last_name: lastName,
          gender: null,
          photo_url: null,
          company_name: null,
          contact_person: null,
          mobile: null,
          whatsapp: null,
          email: null,
          address: null
        };
        setPeople((current) => [createdRow, ...current.filter((p) => p.id !== newId)]);
        onValueChange(newId);
      } else {
        await loadList();
      }
    } catch (err) {
      console.error("Failed to auto-create person master:", err);
      setOpenCreate(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, lang]);

  useEffect(() => {
    if (!value) return;
    if (people.some((p) => p.id === value)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ customer: PersonRow }>(`/api/erp/customers/${encodeURIComponent(value)}?lang=${encodeURIComponent(lang)}`);
        if (cancelled) return;
        if (res.customer) {
          setPeople((current) => {
            if (current.some((p) => p.id === res.customer.id)) return current;
            return [res.customer, ...current];
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
  }, [value, lang]);

  const options: SearchSelectOption[] = useMemo(() => people.map((p) => toOption(p, lang)), [people, lang]);
  const [viewPerson, setViewPerson] = useState<PersonRow | null>(null);

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "hr.pp_search_placeholder", "Search employee / person name"))}
        searchPlaceholder={t(lang, "common.search", "Search...")}
        emptyLabel={t(lang, "hr.pp_no_matches", "No matches found.")}
        viewTitle={t(lang, "common.view", "View Details")}
        editTitle={t(lang, "common.edit", "Edit")}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        onViewOption={(personId) => {
          const found = people.find((p) => p.id === personId);
          if (found) setViewPerson(found);
        }}
        onEditOption={(personId) => setEditPersonId(personId)}
        createLabel={t(lang, "hr.pp_add_new_person_master", "Add New Person Master")}
        createButtonPlacement="both"
        onCreateWithSearch={handleQuickCreatePerson}
        onCreateNew={async () => {
          setOpenCreate(true);
        }}
      />

      {/* View Person Modal */}
      {viewPerson ? (
        <SimpleModal
          title={`${t(lang, "hr.pp_view_title", "Person / Account Details")} — ${transliterateProperNoun(viewPerson.customer_name, lang)}`}
          onClose={() => setViewPerson(null)}
          className="w-[96vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl font-sans shadow-2xl"
        >
          <div className="p-5 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-black tracking-wide text-slate-900 dark:text-white">
                  {transliterateProperNoun(viewPerson.customer_name, lang)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t(lang, "hr.pp_company", "Company")}: <span className="font-bold text-slate-700 dark:text-slate-300">{viewPerson.company_name ? localizeTerm(viewPerson.company_name, lang) : t(lang, "hr.pp_independent", "Independent Account")}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                  {t(lang, "hr.pp_active_master", "Active Master")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_contact_person", "Contact Person")}</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">{viewPerson.contact_person ? transliterateProperNoun(viewPerson.contact_person, lang) : "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_mobile_phone", "Mobile Phone")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white text-sm" dir="ltr">{viewPerson.mobile || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "sed.f_whatsapp", "WhatsApp")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">{viewPerson.whatsapp || viewPerson.mobile || "—"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_email_address", "Email Address")}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs" dir="ltr">{viewPerson.email || "—"}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_address_location", "Address / Location")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">{viewPerson.address ? localizeTerm(viewPerson.address, lang) : "—"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditPersonId(viewPerson.id);
                  setViewPerson(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang, "hr.pp_edit_master", "Edit Master")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewPerson(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  {t(lang, "common.close", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewPerson.id);
                    setViewPerson(null);
                  }}
                  className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {t(lang, "hr.pp_select_this_person", "Select This Person")}
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {openCreate ? (
        <SimpleModal
          title={t(lang, "hr.pp_new_person_registry", "New Person Registry — Customer Master")}
          onClose={() => setOpenCreate(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <CustomerForm
            lang={lang}
            mode="embedded"
            onClose={() => setOpenCreate(false)}
            onSave={async (newPersonId) => {
              setOpenCreate(false);
              try {
                const res = await apiGet<{ customer: PersonRow }>(`/api/erp/customers/${encodeURIComponent(newPersonId)}?lang=${encodeURIComponent(lang)}`);
                if (res.customer) {
                  setPeople((current) => [res.customer, ...current.filter((p) => p.id !== newPersonId)]);
                }
              } catch {}
              onValueChange(newPersonId);
              void loadList();
            }}
          />
        </SimpleModal>
      ) : null}

      {editPersonId ? (
        <SimpleModal
          title={t(lang, "hr.pp_edit_person_registry", "Edit Person Registry — Customer Master")}
          onClose={() => setEditPersonId(null)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <CustomerForm
            lang={lang}
            mode="embedded"
            initialCustomerId={editPersonId}
            onClose={() => setEditPersonId(null)}
            onSave={async (savedId) => {
              setEditPersonId(null);
              try {
                const res = await apiGet<{ customer: PersonRow }>(`/api/erp/customers/${encodeURIComponent(savedId)}?lang=${encodeURIComponent(lang)}`);
                if (res.customer) {
                  setPeople((current) => [res.customer, ...current.filter((p) => p.id !== savedId)]);
                }
              } catch {}
              onValueChange(savedId);
              void loadList();
            }}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}
