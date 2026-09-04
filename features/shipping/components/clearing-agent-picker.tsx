"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { apiGet, apiPost } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { localizeTerm } from "@/lib/i18n/transliteration";

export type ClearingAgentRow = {
  id: string;
  code: string | null;
  clearing_agent_code: string | null;
  name: string;
  person_id: string | null;
  company_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
};

function toOption(row: ClearingAgentRow, lang: string): SearchSelectOption {
  const name = localizeTerm(row.name, lang);
  const codeDisplay = row.clearing_agent_code || row.code;
  const label = codeDisplay ? `${name} (${codeDisplay})` : name;
  const keywords = [name, row.name, row.clearing_agent_code, row.code, row.contact_person, row.email].filter(Boolean).join(" ");
  return { value: row.id, label, keywords };
}

export function ClearingAgentPicker({
  label,
  value,
  onValueChange,
  disabled,
  placeholder
}: {
  label?: string;
  value: string;
  onValueChange: (clearingAgentId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ClearingAgentRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [ownerType, setOwnerType] = useState<"none" | "person" | "company">("none");
  const [newPersonId, setNewPersonId] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");

  async function loadList() {
    setLoading(true);
    try {
      const res = await apiGet<{ clearingAgents: ClearingAgentRow[] }>(`/api/erp/clearing-agents?limit=200&lang=${encodeURIComponent(lang)}`);
      setRows(res.clearingAgents ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const options = useMemo(() => rows.map((r) => toOption(r, lang)), [rows, lang]);

  async function createClearingAgent(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await apiPost<{ clearingAgentId: string }>("/api/erp/clearing-agents", {
        name: name.trim(),
        personId: ownerType === "person" ? newPersonId || null : null,
        companyId: ownerType === "company" ? newCompanyId || null : null,
        originalLanguage: lang
      });
      await loadList();
      onValueChange(res.clearingAgentId);
      setOpenCreate(false);
      setNewName("");
      setOwnerType("none");
      setNewPersonId("");
      setNewCompanyId("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SearchSelect
        label={label ?? t(lang, "cla.picker_label", "Clearing Agent")}
        value={value}
        placeholder={placeholder ?? (loading ? t(lang, "common.loading", "Loading...") : t(lang, "cla.search_placeholder", "Search clearing agent by name or code..."))}
        disabled={disabled || loading}
        options={options}
        onValueChange={onValueChange}
        createLabel={t(lang, "cla.new_clearing_agent", "New Clearing Agent")}
        createButtonPlacement="both"
        onCreateWithSearch={createClearingAgent}
        onCreateNew={async () => setOpenCreate(true)}
      />

      {openCreate ? (
        <SimpleModal
          title={t(lang, "cla.new_clearing_agent", "New Clearing Agent")}
          onClose={() => setOpenCreate(false)}
          className="w-[96vw] max-w-md rounded-2xl font-sans"
        >
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t(lang, "cla.name_label", "Clearing Agent Name")} *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t(lang, "cla.name_placeholder", "e.g. DGT Clearing Services")} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t(lang, "cla.agent_kind_label", "Agent Type")}</Label>
              <div className="flex gap-2">
                {(["none", "person", "company"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setOwnerType(opt)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      ownerType === opt ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt === "none" && t(lang, "cla.kind_standalone", "Standalone")}
                    {opt === "person" && t(lang, "cla.kind_individual", "Individual")}
                    {opt === "company" && t(lang, "cla.kind_firm", "Firm")}
                  </button>
                ))}
              </div>
              {ownerType === "person" && (
                <PersonPicker
                  label={t(lang, "cla.link_person_label", "Link to Person")}
                  value={newPersonId}
                  onValueChange={setNewPersonId}
                  lang={lang}
                />
              )}
              {ownerType === "company" && (
                <CompanyPicker
                  label={t(lang, "cla.link_company_label", "Link to Company")}
                  value={newCompanyId}
                  onValueChange={setNewCompanyId}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button type="button" disabled={!newName.trim() || loading} onClick={() => createClearingAgent(newName)}>
                {t(lang, "common.save", "Save")}
              </Button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}
