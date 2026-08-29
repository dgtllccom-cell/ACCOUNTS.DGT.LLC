"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePrintStore } from "@/lib/store/print-store";
import { Button } from "@/components/ui/button";
import { X, Printer, Download, Mail, Share2, Menu, FileText, LayoutList } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

const DOC_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" }, { code: "ur", label: "اردو" }, { code: "ps", label: "پښتو" },
  { code: "fa", label: "فارسی" }, { code: "ar", label: "العربية" },
];

export function PdfPreviewModal() {
  const { isOpen, htmlContent, title, rebuild, lang: docLang, closePrint, updateHtml } = usePrintStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [previewLang, setPreviewLang] = useState<string>(docLang || "en");

  useEffect(() => { setPreviewLang(docLang || "en"); }, [docLang, isOpen]);

  // When the document exposes a rebuild fn, the language / orientation selectors
  // re-render the document from source instead of only restyling.
  const applyRebuild = (nextLang: string, nextOrientation: "portrait" | "landscape") => {
    if (!rebuild) return;
    try {
      const html = rebuild({ lang: nextLang, orientation: nextOrientation });
      updateHtml(html, nextLang);
    } catch { /* keep current preview on failure */ }
  };
  const [paperSize, setPaperSize] = useState("A4");
  const [pages, setPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  useEffect(() => {
    if (isOpen && htmlContent) {
      // Estimate pages (very rough estimate based on sheet class if used, or just default to 1)
      const sheetCount = (htmlContent.match(/class="sheet"/g) || []).length;
      setPages(Array.from({ length: Math.max(1, sheetCount) }, (_, i) => i + 1));
      setCurrentPage(1);
    }
  }, [isOpen, htmlContent]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownloadPdf = () => {
    handlePrint();
  };

  const handleDownloadHtml = () => {
    const safeName = (title || "ERP-Report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "erp-report";
    const filename = `${safeName}-${new Date().toISOString().slice(0, 10)}.html`;
    // injectedHtml is the report body the iframe already renders (report builder output,
    // already in the selected language + RTL/LTR + scope-filtered) plus @page sizing.
    // No session/cookie/token data is present in it.
    const blob = new Blob([injectedHtml || htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        const win = iframeRef.current.contentWindow as any;
        if (typeof win.downloadCsv === "function") {
          win.downloadCsv();
          return;
        }
      } catch (e) {
        console.warn("Direct iframe downloadCsv failed", e);
      }
    }
    // Fallback: extract table rows to CSV
    try {
      const doc = iframeRef.current?.contentDocument;
      const table = doc?.querySelector("table.data-table");
      if (table) {
        const rows = Array.from(table.querySelectorAll("tr"));
        const csv = rows
          .map((row) =>
            Array.from(row.children)
              .map((cell) => `"${(cell.textContent || "").trim().replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(title || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn("Fallback CSV extraction failed", e);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Please find the attached document: ${title}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`Please find the document attached or printed via our system.\n\nBest Regards`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  // Inject dynamic styles into the iframe for orientation and paper size.
  // The report HTML ships its own screen toolbar (.no-print-toolbar) for the
  // standalone popup-window fallback; inside this modal it duplicates the
  // toolbar above, so hide it here.
  //
  // Report builders historically embed `<script>…window.print()…</script>`
  // (gated on an `autoPrint` flag) for the legacy popup-window path. Inside this
  // preview iframe that script fires an *immediate* native print dialog on load,
  // bypassing the preview and freezing the renderer. Strip any auto-print
  // script — the user drives Print / Save-as-PDF from the toolbar above.
  const sanitizedHtml = (htmlContent || "").replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    (block) => (/window\.print\s*\(|__ERP_A4_AUTOPRINT__/.test(block) ? "" : block)
  );

  const injectedHtml = `
    ${sanitizedHtml}
    <style>
      @page {
        size: ${paperSize} ${orientation} !important;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
      @media screen {
        .no-print-toolbar { display: none !important; }
        .wrap, body { padding-top: 0 !important; }
      }
    </style>
  `;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="fixed inset-0 z-[9999] flex flex-col bg-[#1e293b] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <div className="h-14 bg-[#0f172a] border-b border-slate-700 flex items-center justify-between px-4">

        {/* Left: Brand & Menu */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white" onClick={closePrint} title={tt("common.close", "Close")}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 text-white font-semibold">
            <Menu className="w-5 h-5 text-slate-400" />
            <span className="hidden sm:inline">{title || tt("pdfprev.doc_title_fallback", "Document")}</span>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 sm:gap-4 bg-[#1e293b] p-1.5 rounded-lg border border-slate-700">
          <button
            onClick={() => {
              const next = orientation === "portrait" ? "landscape" : "portrait";
              setOrientation(next);
              applyRebuild(previewLang, next);
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{orientation === "portrait" ? tt("pdfprev.portrait", "Portrait") : tt("pdfprev.landscape", "Landscape")}</span>
          </button>

          {rebuild && (
            <select
              value={previewLang}
              onChange={(e) => { setPreviewLang(e.target.value); applyRebuild(e.target.value, orientation); }}
              className="bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded outline-none border-none cursor-pointer"
              title={tt("pdfprev.document_language", "Document Language")}
            >
              {DOC_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          )}

          <div className="text-xs font-medium text-slate-300 px-2 border-x border-slate-700">
            {tt("pdfprev.page_of", "Page {current} of {total}").replace("{current}", String(currentPage)).replace("{total}", String(pages.length))}
          </div>

          <select 
            value={paperSize} 
            onChange={(e) => setPaperSize(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded outline-none border-none cursor-pointer"
          >
            <option value="A4">A4 (8.27 × 11.69 in)</option>
            <option value="Legal">Legal (8.5 × 14 in)</option>
            <option value="Letter">Letter (8.5 × 11 in)</option>
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-green-400 hover:bg-slate-800 gap-1 text-xs" onClick={handleShareWhatsApp} title={tt("pdfprev.share_whatsapp", "Share via WhatsApp")}>
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">WhatsApp</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-blue-400 hover:bg-slate-800 gap-1 text-xs" onClick={handleShareEmail} title={tt("pdfprev.email_document", "Email Document")}>
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{tt("pdfprev.email", "Email")}</span>
          </Button>

          {/* Download Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white gap-1 text-xs font-semibold"
              onClick={() => setDownloadMenuOpen((v) => !v)}
              title={tt("pdfprev.download_options", "Download Options")}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{tt("common.download", "Download")}</span>
            </Button>
            {downloadMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a] p-1.5 shadow-2xl animate-in fade-in zoom-in-95"
                onMouseLeave={() => setDownloadMenuOpen(false)}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left transition-colors"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    handleDownloadPdf();
                  }}
                >
                  <FileText className="h-4 w-4 text-rose-400" />
                  <div>
                    <div className="text-white font-bold">{tt("pdfprev.save_pdf", "Save as PDF")}</div>
                    <div className="text-[10px] text-slate-400">{tt("pdfprev.save_pdf_desc", "Standard print-ready PDF file")}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left transition-colors"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    handleDownloadHtml();
                  }}
                >
                  <Download className="h-4 w-4 text-blue-400" />
                  <div>
                    <div className="text-white font-bold">{tt("pdfprev.download_html_report", "Download HTML Report")}</div>
                    <div className="text-[10px] text-slate-400">{tt("pdfprev.download_html_desc", "Offline interactive report file")}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left transition-colors"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    handleDownloadCsv();
                  }}
                >
                  <Share2 className="h-4 w-4 text-emerald-400" />
                  <div>
                    <div className="text-white font-bold">{tt("pdfprev.export_excel_csv", "Export Excel / CSV")}</div>
                    <div className="text-[10px] text-slate-400">{tt("pdfprev.export_csv_desc", "Raw spreadsheet table data")}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 font-bold text-xs shadow-lg shadow-blue-900/20" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span>{tt("common.print", "Print")}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Thumbnails */}
        <div className="w-48 bg-[#0f172a] border-r border-slate-700 flex flex-col hidden md:flex overflow-y-auto custom-scrollbar">
          <div className="p-4 flex flex-col gap-4">
            {pages.map((pageNum) => (
              <div 
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`flex flex-col items-center gap-2 cursor-pointer group`}
              >
                <div className={`w-28 h-40 bg-white rounded shadow-sm relative overflow-hidden transition-all duration-200 ${currentPage === pageNum ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f172a]" : "opacity-70 group-hover:opacity-100"}`}> 
                  {/* Thumbnail Placeholder - we use an icon to represent the page for performance */}
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-300">
                    <FileText className="w-8 h-8" />
                  </div>
                  {/* Faux Watermark for aesthetic */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-5">
                    <span className="text-black font-bold text-xs rotate-[-45deg]">DGT LLC</span>
                  </div>
                </div>
                <span className={`text-xs font-medium ${currentPage === pageNum ? "text-blue-400" : "text-slate-400"}`}> 
                  {pageNum}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 bg-[#1e293b] p-4 sm:p-8 overflow-auto flex justify-center custom-scrollbar">
          {/* 
            FIX: Previously the parent div only had `minHeight` with the iframe using
            `absolute inset-0 h-full`. Per CSS spec, absolutely-positioned children
            cannot resolve percentage heights from min-height — only from an explicit
            height. This caused the iframe to collapse to 0px and appear blank.
            Solution: remove absolute positioning; give the iframe an explicit height.
          */}
          <div 
            className="shadow-2xl rounded-sm transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              width: orientation === "portrait" ? "210mm" : "297mm",
              maxWidth: "100%",
            }}
          >
             <iframe
                ref={iframeRef}
                srcDoc={injectedHtml}
                className="w-full border-none block"
                style={{ height: orientation === "portrait" ? "297mm" : "210mm" }}
                title={tt("pdfprev.preview_title", "PDF Preview")}
             />
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}} />
    </div>
  );
}
