"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";

/**
 * Translation review queue (issue #36): saved names and text that have no APPROVED version in a language yet. A reviewer accepts
 * a suggestion or types the version; only what the reviewer confirms is stored (as their entry) and shown to viewers of that
 * language. The saved text itself is never changed. Machine renderings appear only as suggestions here.
 */

type ReviewItem = {
  id: string;
  recordTable: string;
  recordId: string;
  fieldName: string;
  originalText: string;
  originalLanguageCode: SupportedLanguage;
  kind: "name" | "text";
  status: string;
  approved: Partial<Record<SupportedLanguage, string>>;
  suggestions: Partial<Record<SupportedLanguage, string>>;
};

// each language by its own name — the same list the language switcher uses
const LANGS: Array<{ code: SupportedLanguage; label: string; dir: "ltr" | "rtl" }> = (["en", "ur", "ar", "fa", "ps"] as SupportedLanguage[]).map((code) => {
  const language = supportedLanguages.find((l) => l.code === code);
  return { code, label: language?.nativeName ?? code, dir: (language?.direction ?? "ltr") as "ltr" | "rtl" };
});
const LANG_LABEL = Object.fromEntries(LANGS.map((l) => [l.code, l.label])) as Record<SupportedLanguage, string>;

function humanize(identifier: string): string {
  return identifier.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
}

export function TranslationReviewQueue() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [needLang, setNeedLang] = useState<SupportedLanguage>("en");
  const [moduleFilter, setModuleFilter] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [modules, setModules] = useState<Array<{ table: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [editing, setEditing] = useState<ReviewItem | null>(null);
  const [draft, setDraft] = useState<Partial<Record<SupportedLanguage, string>>>({});

  const tableLabel = (table: string) => translateHeader(lang, humanize(table));
  const fieldLabel = (field: string) => translateHeader(lang, humanize(field.split(".").pop() || field));

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ review: "true", needLang, limit: "300" });
      if (moduleFilter) params.set("module", moduleFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/erp/translations/management?${params.toString()}`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload?.error?.message || tt("trm.err_load", "Failed to load local translations"));
      setItems(payload.data.items || []);
      setTotal(payload.data.total || 0);
      if (!moduleFilter) setModules(payload.data.modules || []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : tt("trm.err_load", "Failed to load local translations"), error: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [needLang, moduleFilter]);

  async function approve(item: ReviewItem, translations: Partial<Record<SupportedLanguage, string>>) {
    setBusyId(item.id);
    setMessage(null);
    try {
      const res = await fetch("/api/erp/translations/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: true, recordTable: item.recordTable, recordId: item.recordId, fieldName: item.fieldName, translations })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload?.error?.message || tt("trm.err_save", "Failed to save translation"));
      const paired = Number(payload.data?.pairedRecords || 0) > 0;
      setMessage({ text: `${tt("trm.rv_approved_ok", "Approved — viewers in that language now see it.")}${paired ? ` ${tt("trm.rv_paired", "Also applied to the linked account / ledger.")}` : ""}`, error: false });
      setEditing(null);
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : tt("trm.err_save", "Failed to save translation"), error: true });
    } finally {
      setBusyId(null);
    }
  }

  function openEditor(item: ReviewItem) {
    setEditing(item);
    setDraft({ ...item.approved });
  }

  const draftHasValue = useMemo(
    () => editing ? LANGS.some(({ code }) => code !== editing.originalLanguageCode && (draft[code] ?? "").trim() && (draft[code] ?? "").trim() !== editing.originalText) : false,
    [draft, editing]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {tt("trm.rv_intro", "Saved names and text that do not have an approved translation yet. The saved text never changes; what you approve here is shown to viewers of that language.")}
      </p>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm font-semibold">
            {tt("trm.rv_need_lang", "Needs an approved version in")}
            <select value={needLang} onChange={(e) => setNeedLang(e.target.value as SupportedLanguage)} className="h-10 rounded-md border bg-background px-3 text-sm" data-testid="review-need-lang">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm" data-testid="review-module">
            <option value="">{tt("trm.mod_all", "All Modules")}</option>
            {modules.map((m) => <option key={m.table} value={m.table}>{tableLabel(m.table)} ({m.count})</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tt("trm.search_ph", "Search translation key, English, Urdu, Pashto, Farsi or Arabic text...")} className="ps-9" data-testid="review-search" />
          </div>
          <Button type="submit" variant="secondary" className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> {tt("common.filter", "Filter")}</Button>
        </form>
        <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-400" data-testid="review-total">
          {tt("trm.rv_total", "{count} waiting").replace("{count}", String(total))}
        </p>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.error ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`} data-testid="review-message">
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="erp-table-wrap">
          <table className="w-full text-start text-sm" data-testid="review-table">
            <thead className="border-b bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{tt("trm.rv_col_record", "Record / field")}</th>
                <th className="p-3 text-start">{tt("trm.rv_col_saved", "Saved text")}</th>
                <th className="p-3 text-start">{tt("trm.rv_col_suggestion", "Suggestion (not approved)")}</th>
                <th className="p-3 text-end">{tt("trm.rv_col_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{tt("trm.loading", "Loading local translations from database...")}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{tt("trm.rv_empty", "Nothing waiting — every saved value has an approved version in this language.")}</td></tr>
              ) : items.map((item) => {
                const suggestion = item.suggestions[needLang] || "";
                return (
                  <tr key={item.id} className="hover:bg-muted/30" data-testid="review-row" data-record-id={item.recordId} data-field={item.fieldName}>
                    <td className="p-3 align-top">
                      <span className="block text-xs font-semibold text-primary">{tableLabel(item.recordTable)}</span>
                      <span className="block text-xs text-muted-foreground">{fieldLabel(item.fieldName)}</span>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${item.kind === "name" ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {item.kind === "name" ? tt("trm.rv_kind_name", "Name") : tt("trm.rv_kind_text", "Text")}
                      </span>
                    </td>
                    <td className="p-3 align-top">
                      <bdi dir="auto" className="block font-medium" data-testid="review-saved">{item.originalText}</bdi>
                      <span className="text-[10px] text-muted-foreground">{tt("trm.rv_saved_in", "Saved in {lang}").replace("{lang}", LANG_LABEL[item.originalLanguageCode] || item.originalLanguageCode)}</span>
                    </td>
                    <td className="p-3 align-top">
                      {suggestion ? <bdi dir="auto" className="italic text-muted-foreground" data-testid="review-suggestion">{suggestion}</bdi> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-end align-top">
                      <div className="flex justify-end gap-2">
                        {suggestion && (
                          <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => void approve(item, { [needLang]: suggestion })} data-testid="review-accept">
                            <CheckCircle2 className="me-1 h-3.5 w-3.5" />{tt("trm.rv_accept", "Accept")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditor(item)} data-testid="review-edit">{tt("trm.rv_review", "Review")}</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={tt("trm.rv_dialog_title", "Approve translation")}>
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-950">
            <header className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-black">{tt("trm.rv_dialog_title", "Approve translation")}</h2>
                <p className="text-xs text-slate-500">{tt("trm.rv_dialog_desc", "Type or accept the version for each language you can confirm. Languages left empty keep showing the saved text.")}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label={t(lang, "common.close", "Close")}><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-3 overflow-auto p-4">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{tableLabel(editing.recordTable)} · {fieldLabel(editing.fieldName)}</div>
                <bdi dir="auto" className="block text-base font-bold" data-testid="review-dialog-saved">{editing.originalText}</bdi>
                <span className="text-[10px] text-muted-foreground">{tt("trm.rv_saved_in", "Saved in {lang}").replace("{lang}", LANG_LABEL[editing.originalLanguageCode] || editing.originalLanguageCode)}</span>
              </div>
              {LANGS.filter((l) => l.code !== editing.originalLanguageCode).map((l) => {
                const suggestion = editing.suggestions[l.code];
                return (
                  <label key={l.code} className="block text-xs font-bold">
                    {l.label}
                    <Input dir={l.dir} value={draft[l.code] ?? ""} placeholder={suggestion || ""} onChange={(e) => setDraft((current) => ({ ...current, [l.code]: e.target.value }))} className="mt-1" data-testid={`review-input-${l.code}`} />
                    {suggestion && !(draft[l.code] ?? "").trim() && (
                      <button type="button" className="mt-1 text-[11px] font-semibold text-primary underline" onClick={() => setDraft((current) => ({ ...current, [l.code]: suggestion }))}>
                        {tt("trm.rv_use_suggestion", "Use suggestion")}: <bdi dir="auto">{suggestion}</bdi>
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
            <footer className="flex items-center justify-end gap-3 border-t p-4">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{tt("common.cancel", "Cancel")}</Button>
              <Button type="button" disabled={!draftHasValue || busyId === editing.id} onClick={() => void approve(editing, draft)} data-testid="review-approve">
                {busyId === editing.id ? tt("trm.saving", "Saving...") : tt("trm.rv_approve", "Approve")}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
