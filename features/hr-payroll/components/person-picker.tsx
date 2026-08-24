"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet } from "@/lib/api/client";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

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

function toOption(row: PersonRow): SearchSelectOption {
  const name = personFullName(row);
  // Secondary identity line: company · phone — so the admin can tell people apart at a glance.
  const bits = [row.company_name, row.mobile || row.whatsapp].filter(Boolean).join(" · ");
  const label = bits ? `${name} — ${bits}` : name;
  const keywords = [
    name, row.customer_name, row.first_name, row.last_name,
    row.company_name, row.contact_person, row.mobile, row.whatsapp, row.email
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

  const options: SearchSelectOption[] = useMemo(() => people.map(toOption), [people]);
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
        onCreateNew={async () => {
          setOpenCreate(true);
        }}
      />

      {/* View Person Modal */}
      {viewPerson ? (
        <SimpleModal
          title={`${t(lang, "hr.pp_view_title", "Person / Account Details")} — ${viewPerson.customer_name}`}
          onClose={() => setViewPerson(null)}
          className="w-[96vw] max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="p-4 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
              <div>
                <h3 className="text-base font-black uppercase tracking-wide">{viewPerson.customer_name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">{t(lang, "hr.pp_company", "Company")}: {viewPerson.company_name || t(lang, "hr.pp_independent", "Independent Account")}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  {t(lang, "hr.pp_active_master", "Active Master")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_contact_person", "Contact Person")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewPerson.contact_person || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_mobile_phone", "Mobile Phone")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewPerson.mobile || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "sed.f_whatsapp", "WhatsApp")}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{viewPerson.whatsapp || viewPerson.mobile || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_email_address", "Email Address")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewPerson.email || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{t(lang, "hr.pp_address_location", "Address / Location")}</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewPerson.address || "-"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditPersonId(viewPerson.id);
                  setViewPerson(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                {t(lang, "hr.pp_edit_master", "Edit Master")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewPerson(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  {t(lang, "common.close", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(viewPerson.id);
                    setViewPerson(null);
                  }}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
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
