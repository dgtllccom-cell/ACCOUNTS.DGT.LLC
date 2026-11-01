"use client";

/**
 * Reports Center - the centered, READ-ONLY document preview behind every register row's View button.
 *
 * Shows the official A4 document of the saved record (see lib/reports/center-document-html.ts) in a sandboxed frame above the current screen with a
 * subtle backdrop. The toolbar is exactly: Print | Download PDF | Email | Close - nothing here can edit, delete, transfer, confirm or approve.
 *   Print        the existing universal A4 print / PDF-preview system
 *   Download PDF the PDF of THIS document (rendered from the same html the preview shows)
 *   Email        a server-side e-mail with that PDF genuinely attached; it is reported as sent only when the mail server accepted it
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Mail, Printer, X } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { translateValue } from "@/lib/i18n/table-values";
import { printStore } from "@/lib/store/print-store";
import type { RecordDoc } from "@/lib/reports/center-record";
import { buildRecordDocumentHtml } from "@/lib/reports/center-document-html";

export type ViewTarget = { table: string; id: string; entryNo: string };

const PAGE_W = 794; // A4 @ 96dpi

function toBase64(buf: ArrayBuffer) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function ReportViewModal({ target, lang, onClose }: { target: ViewTarget; lang: string; onClose: () => void }) {
  const s = useErpScreen("rc", lang as never);
  const [doc, setDoc] = useState<RecordDoc | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "pdf" | "email">("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState("");
  const [mailResult, setMailResult] = useState<{ ok: boolean; text: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [boxW, setBoxW] = useState(PAGE_W);
  const narrow = boxW < 700;
  const [frameH, setFrameH] = useState(1123);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    apiGet<{ found: boolean; doc?: RecordDoc }>(`/api/erp/reports/record?table=${encodeURIComponent(target.table)}&id=${encodeURIComponent(target.id)}`)
      .then((r) => {
        if (cancelled) return;
        if (r?.found && r.doc) { setDoc(r.doc); setState("ready"); } else setState("missing");
      })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setState("error"); } });
    return () => { cancelled = true; };
  }, [target.table, target.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const html = useMemo(
    () => (doc ? buildRecordDocumentHtml({ doc, tr: (k, fb) => s.tGlobal(k, fb), lang, rtl: s.isRtl, generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "), word: (v) => translateValue(lang, String(v).replace(/_/g, " ")) }) : ""),
    [doc, lang, s]
  );

  // the A4 sheet is scaled to the available width (phones / tablets) - the document itself is never re-flowed
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => { const w = el.clientWidth - 16; setBoxW(w); setScale(w >= 700 ? Math.min(1, w / PAGE_W) : 1); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  const measure = useCallback(() => {
    const d = frameRef.current?.contentDocument;
    if (d) setFrameH(Math.max(400, d.documentElement.scrollHeight + 4));
  }, []);
  useEffect(() => { const t = window.setTimeout(measure, 150); return () => window.clearTimeout(t); }, [boxW, measure, html]);

  const title = doc ? `${s.tGlobal(doc.typeKey, doc.typeLabel)} — ${doc.entryNo}` : target.entryNo;
  const fileName = `${(doc?.entryNo || target.entryNo || "report").replace(/[^A-Za-z0-9._-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const makePdf = async () => {
    // the PDF is always a real A4 sheet: laid out in an off-screen frame of A4 width, whatever the size of this screen
    const host = document.createElement("iframe");
    host.setAttribute("sandbox", "allow-same-origin");
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:1200px;border:0;visibility:hidden`;
    document.body.appendChild(host);
    await new Promise<void>((resolve) => { host.onload = () => resolve(); host.srcdoc = html; });
    const body = host.contentDocument?.body;
    if (!body) { host.remove(); throw new Error("The document is not ready"); }
    const mod: any = await import("html2pdf.js");
    const html2pdf = mod.default || mod;
    return { worker: html2pdf()
      .set({ margin: 6, filename: fileName, image: { type: "jpeg", quality: 0.92 }, html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" }, pagebreak: { mode: ["css", "legacy"] }, jsPDF: { orientation: "portrait", unit: "mm", format: "a4", compress: true } })
      .from(body), cleanup: () => host.remove() };
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    try { const m = await makePdf(); try { await m.worker.save(); } finally { m.cleanup(); } } catch (e: any) { setMailResult({ ok: false, text: e?.message || "PDF failed" }); } finally { setBusy(""); }
  };

  const sendEmail = async () => {
    const list = to.split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) { setMailResult({ ok: false, text: s.t("email.need_to", "Enter at least one recipient email address.") }); return; }
    setBusy("email");
    setMailResult(null);
    try {
      const made = await makePdf();
      let blob: Blob;
      try { blob = await made.worker.outputPdf("blob"); } finally { made.cleanup(); }
      const contentBase64 = toBase64(await blob.arrayBuffer());
      const res = await fetch("/api/erp/reports/auto-email?action=send-now", {
        method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipients: list, reportName: title,
          htmlBody: `<p>${title.replace(/[<>&]/g, "")}</p><p>${s.t("email.body", "The report is attached as a PDF.")}</p>`,
          attachment: { filename: fileName, contentBase64 }
        })
      });
      const j = await res.json().catch(() => null);
      const failed = Array.isArray(j?.results) ? j.results.filter((r: any) => !r.success) : [];
      if (res.ok && j?.success && j?.attached && !failed.length) setMailResult({ ok: true, text: s.t("email.sent", "Sent with the PDF attached to {to}").replace("{to}", list.join(", ")) });
      else setMailResult({ ok: false, text: s.t("email.failed", "Not delivered: {reason}").replace("{reason}", failed[0]?.error || j?.error || `HTTP ${res.status}`) });
    } catch (e: any) {
      setMailResult({ ok: false, text: s.t("email.failed", "Not delivered: {reason}").replace("{reason}", e?.message || "error") });
    } finally { setBusy(""); }
  };

  const btn = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 p-2 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-label={title} data-testid="report-view-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div dir={s.dir} className="flex h-[94vh] w-[96vw] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:h-[92vh] md:w-[94vw]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-50" data-testid="rvm-title">{title}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.t("readonly", "Read-only document")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="rvm-toolbar">
            <button type="button" data-testid="rvm-print" disabled={state !== "ready"} onClick={() => printStore.openPrint(html, title, { lang })} className={cn(btn, "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100")}>
              <Printer className="h-3.5 w-3.5" aria-hidden />{s.t("print", "Print")}
            </button>
            <button type="button" data-testid="rvm-pdf" disabled={state !== "ready" || busy !== ""} onClick={() => void downloadPdf()} className={cn(btn, "border-blue-600 bg-blue-600 text-white hover:bg-blue-700")}>
              {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}{s.t("pdf", "Download PDF")}
            </button>
            <button type="button" data-testid="rvm-email" disabled={state !== "ready"} onClick={() => { setEmailOpen((v) => !v); setMailResult(null); }} className={cn(btn, "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700")}>
              <Mail className="h-3.5 w-3.5" aria-hidden />{s.t("email", "Email")}
            </button>
            <button type="button" data-testid="rvm-close" onClick={onClose} className={cn(btn, "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100")}>
              <X className="h-3.5 w-3.5" aria-hidden />{s.t("close", "Close")}
            </button>
          </div>
        </div>

        {emailOpen && state === "ready" ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30" data-testid="rvm-email-panel">
            <input data-testid="rvm-email-to" type="text" inputMode="email" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder={s.t("email.to_ph", "name@example.com, other@example.com")} className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900" />
            <button type="button" data-testid="rvm-email-send" disabled={busy !== ""} onClick={() => void sendEmail()} className={cn(btn, "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800")}>
              {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Mail className="h-3.5 w-3.5" aria-hidden />}{busy === "email" ? s.t("email.sending", "Sending…") : s.t("email.send", "Send with PDF attached")}
            </button>
            <span className="text-[11px] text-slate-600 dark:text-slate-300">{s.t("email.hint", "The report is attached as a PDF. Separate several addresses with a comma.")}</span>
          </div>
        ) : null}
        {mailResult ? (
          <div data-testid="rvm-mail-result" role="status" className={cn("border-b px-3 py-1.5 text-xs font-semibold", mailResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200")}>{mailResult.text}</div>
        ) : null}

        <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-slate-200/70 p-2 dark:bg-slate-800/60" data-testid="rvm-body">
          {state === "loading" ? <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{s.t("loading", "Loading…")}</div> : null}
          {state === "missing" ? <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-600" data-testid="rvm-missing">{s.t("record_missing", "This record is not available in your scope.")}</div> : null}
          {state === "error" ? <div className="flex h-full items-center justify-center text-sm font-semibold text-rose-700" data-testid="rvm-error">{error}</div> : null}
          {state === "ready" ? (
            <div className="mx-auto" style={narrow ? { width: boxW } : { width: PAGE_W * scale, height: frameH * scale }}>
              <iframe ref={frameRef} data-testid="rvm-frame" title={title} srcDoc={html} sandbox="allow-same-origin" onLoad={measure} className="block border-0 bg-white shadow-md" style={narrow ? { width: boxW, height: frameH } : { width: PAGE_W, height: frameH, transform: `scale(${scale})`, transformOrigin: "top left" }} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
