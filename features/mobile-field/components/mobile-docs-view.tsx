"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Upload, Download, Check, X, Image as ImageIcon } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileFieldShell } from "./mobile-field-shell";

type DocItem = {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string;
};

export function MobileDocsView({
  langProp,
  currentUserId,
}: {
  langProp?: SupportedLanguage;
  currentUserId: string;
}) {
  const s = useErpScreen("mfield", langProp);

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<"weighbridge" | "gatepass" | "bilty" | "seal" | "other">("weighbridge");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/documents?entityType=field_intake&entityId=${currentUserId}`);
      const json = await res.json();
      setDocs((json.data?.results ?? json.results ?? []) as DocItem[]);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      // Prefix file name with title if provided
      const customName = title.trim() ? `${title.trim()} - ${selectedFile.name}` : selectedFile.name;
      const renamedFile = new File([selectedFile], customName, { type: selectedFile.type });

      fd.append("file", renamedFile);
      fd.append("entityType", "field_intake");
      fd.append("entityId", currentUserId);

      const res = await fetch("/api/erp/documents", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Upload failed");

      setMsg({ tone: "ok", text: s.t("saved_ok", "Saved successfully") });
      setTitle("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadDocs();
    } catch (err: any) {
      setMsg({ tone: "err", text: err?.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <MobileFieldShell title={s.t("menu_docs", "Photo & Slip Intake")} langProp={langProp} showBack>
      {msg ? (
        <div
          className={`mb-3 flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
            msg.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Upload card */}
      <form
        onSubmit={handleUpload}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">
          {s.t("upload_slip", "Upload Slip / Photo")}
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {s.t("doc_type", "Slip / Document Type")}
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="weighbridge">{s.t("doc_type_weighbridge", "Weighbridge Slip (Kanta)")}</option>
              <option value="gatepass">{s.t("doc_type_gatepass", "Gate Pass")}</option>
              <option value="bilty">{s.t("doc_type_bilty", "Consignment Note (Bilty)")}</option>
              <option value="seal">{s.t("doc_type_seal", "Container Seal Photo")}</option>
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {s.t("doc_title", "Document Title")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Truck TL-8842 Tare Weight Slip"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            />
          </label>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSelectedFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-xs font-bold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
            >
              <Camera className="h-5 w-5 text-amber-600" />
              <span>
                {selectedFile
                  ? selectedFile.name
                  : s.t("choose_photo", "Take photo or choose file")}
              </span>
            </button>
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {uploading ? (
              <span>{s.t("saving", "Saving…")}</span>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>{s.t("upload_slip", "Upload Slip / Photo")}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Recent Uploads */}
      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {s.t("recent_docs", "Recent Uploads")}
        </h3>

        {loading ? (
          <p className="mt-4 text-center text-sm text-slate-400">{s.t("loading", "Loading…")}</p>
        ) : docs.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800">
            {s.t("no_records", "No inspections recorded yet")}
          </div>
        ) : (
          <ul className="mt-2 grid gap-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {d.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {d.createdAt ? String(d.createdAt).slice(0, 10) : ""}
                    </p>
                  </div>
                </div>

                <a
                  href={`/api/erp/documents/download?id=${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Download className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileFieldShell>
  );
}
