"use client";

import { useEffect, useMemo, useState } from "react";
import { Languages, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type TranslationRow = {
  id: string;
  field_name: string;
  original_text: string;
  original_language_code: SupportedLanguage;
  english_text: string | null;
  urdu_text: string | null;
  arabic_text: string | null;
  persian_text: string | null;
  pashto_text: string | null;
  translation_status: "complete" | "pending" | string;
};

type EditableRow = TranslationRow & { values: Record<SupportedLanguage, string> };
const languages: Array<{ code: SupportedLanguage; label: string; dir: "ltr" | "rtl" }> = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ur", label: "اردو", dir: "rtl" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "fa", label: "فارسی", dir: "rtl" },
  { code: "ps", label: "پښتو", dir: "rtl" }
];

function editable(row: TranslationRow): EditableRow {
  return {
    ...row,
    values: {
      en: row.english_text || (row.original_language_code === "en" ? row.original_text : ""),
      ur: row.urdu_text || (row.original_language_code === "ur" ? row.original_text : ""),
      ar: row.arabic_text || (row.original_language_code === "ar" ? row.original_text : ""),
      fa: row.persian_text || (row.original_language_code === "fa" ? row.original_text : ""),
      ps: row.pashto_text || (row.original_language_code === "ps" ? row.original_text : "")
    }
  };
}

export function RecordTranslationCorrectionDialog({
  recordTable,
  recordId,
  onSaved
}: {
  recordTable: "purchase_orders" | "sales_orders" | "roznamcha_entries";
  recordId: string;
  onSaved?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const endpoint = `/api/erp/translations/corrections/${recordTable}/${recordId}`;
  const invalidCopies = useMemo(() => rows.flatMap((row) => languages
    .filter(({ code }) => code !== row.original_language_code && row.values[code].trim()
      && row.values[code].trim().localeCompare(row.original_text.trim(), undefined, { sensitivity: "base" }) === 0)
    .map(({ code }) => `${row.field_name}.${code}`)), [rows]);

  async function load(clearMessage = true) {
    setLoading(true);
    if (clearMessage) setMessage("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || "Translations could not be loaded.");
      setRows((payload.data?.fields || []).map(editable));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Translations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) void load(); }, [open, endpoint]);

  async function save() {
    if (invalidCopies.length) {
      setMessage(`Unchanged source text is not a verified translation: ${invalidCopies.join(", ")}`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: rows.map((row) => ({ fieldName: row.field_name, translations: row.values })) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || "Translations could not be saved.");
      setMessage(payload.data?.status === "complete" ? "All five translations are verified." : "Saved. Missing translations remain pending.");
      await load(false);
      await onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Translations could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-8 gap-1.5 text-[10px] font-bold uppercase">
      <Languages className="h-3.5 w-3.5" /> Correct translations
    </Button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Record translation corrections">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-950">
        <header className="flex items-center justify-between border-b p-4">
          <div><h2 className="font-black">Five-language record corrections</h2><p className="text-xs text-slate-500">Original source text is preserved. Empty values remain pending.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-auto p-4">
          {loading ? <div className="flex items-center gap-2 p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading translations…</div> :
            rows.length === 0 ? <p className="p-8 text-sm text-slate-500">No enrolled translatable fields were found for this record.</p> :
            <div className="space-y-4">{rows.map((row, rowIndex) => <section key={row.field_name} className="rounded-lg border p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><div className="font-mono text-xs font-bold">{row.field_name}</div><div className="text-xs text-slate-500">Original ({row.original_language_code}): {row.original_text}</div></div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${row.translation_status === "complete" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.translation_status}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-5">{languages.map((language) => {
                const isOriginal = language.code === row.original_language_code;
                const copied = !isOriginal && row.values[language.code].trim() && row.values[language.code].trim().localeCompare(row.original_text.trim(), undefined, { sensitivity: "base" }) === 0;
                return <label key={language.code} className="text-xs font-bold">{language.label}{isOriginal ? " · source" : ""}
                  <textarea dir={language.dir} value={row.values[language.code]} disabled={isOriginal} onChange={(event) => setRows((current) => current.map((item, index) => index === rowIndex ? { ...item, values: { ...item.values, [language.code]: event.target.value } } : item))} className={`mt-1 min-h-24 w-full rounded-md border bg-white p-2 text-sm font-normal dark:bg-slate-900 ${copied ? "border-red-500" : "border-slate-300 dark:border-slate-700"}`} />
                  {copied && <span className="text-[10px] text-red-600">Copied source is not verified.</span>}
                </label>;
              })}</div>
            </section>)}</div>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t p-4">
          <p className={`text-xs ${invalidCopies.length ? "text-red-600" : "text-slate-500"}`}>{message || (invalidCopies.length ? `${invalidCopies.length} copied target value(s) must be corrected.` : "Only authorized users within the record scope can save.")}</p>
          <Button type="button" onClick={() => void save()} disabled={saving || loading || rows.length === 0 || invalidCopies.length > 0}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save corrections"}</Button>
        </footer>
      </div>
    </div>}
  </>;
}
