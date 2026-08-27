"use client";

import { useEffect, useState } from "react";
import { Upload, Download, Trash2, Loader2, FileText, Paperclip } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Truck Documents & Attachments — reuses the existing Storage-backed document
 * system (/api/erp/documents, entity_type = truck_<category>). Categories:
 * Photo, Registration Card, Insurance, Driver Documents, Vehicle Documents,
 * Other. Upload / list / download / delete, 20MB, pdf|image|xlsx|docx.
 */
const CATEGORIES: { key: string; labelKey: string; labelFallback: string }[] = [
  { key: "photo", labelKey: "ta.cat_photo", labelFallback: "Photo" },
  { key: "registration", labelKey: "ta.cat_registration", labelFallback: "Registration Card" },
  { key: "insurance", labelKey: "ta.cat_insurance", labelFallback: "Insurance Documents" },
  { key: "driver_docs", labelKey: "ta.cat_driver", labelFallback: "Driver Documents" },
  { key: "vehicle_docs", labelKey: "ta.cat_vehicle", labelFallback: "Vehicle / Goods Documents" },
  { key: "other", labelKey: "ta.cat_other", labelFallback: "Other Attachments" },
];

type Doc = { id: string; name: string; mimeType?: string; sizeBytes?: number };

/**
 * Reusable entity attachments over /api/erp/documents.
 * - truckId (legacy) OR entityId: the record the documents belong to.
 * - entityKey: prefix for the document category entity_type (default "truck").
 *   Loading forms pass entityKey="truck_loading" | "import_loading" | "transit_loading".
 */
export function TruckAttachments({ truckId, entityId, entityKey = "truck" }: { truckId?: string | null; entityId?: string | null; entityKey?: string }) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const recordId = entityId ?? truckId ?? null;
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!recordId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/erp/documents?entityType=${entityKey}_${category}&entityId=${recordId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to load documents");
      setDocs((json.data?.results ?? json.results ?? []) as Doc[]);
    } catch (e: any) { setError(e.message); setDocs([]); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [recordId, category]);

  async function upload(file: File) {
    if (!recordId) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", `${entityKey}_${category}`);
      fd.append("entityId", recordId);
      const res = await fetch("/api/erp/documents", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Upload failed");
      await load();
    } catch (e: any) { setError(e.message); } finally { setUploading(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      const res = await fetch(`/api/erp/documents/${id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || j?.error || "Delete failed"); }
      await load();
    } catch (e: any) { setError(e.message); }
  }

  if (!recordId) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">{tt("ta.save_first", "Save the record first to add documents & attachments.")}</div>;
  }

  return (
    <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-400"><Paperclip className="h-3.5 w-3.5" /> {tt("ta.documents", "Documents")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{tt(c.labelKey, c.labelFallback)}</option>)}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {tt("ta.upload", "Upload")}
          <input type="file" className="hidden" accept=".pdf,image/*,.xlsx,.docx" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
        </label>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="px-4 py-6 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">{tt("ta.empty", "No documents in this category yet.")}</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{d.name}</span></span>
                <span className="flex shrink-0 items-center gap-1">
                  <a href={`/api/erp/documents/download?id=${d.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Download"><Download className="h-4 w-4" /></a>
                  <button onClick={() => remove(d.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
