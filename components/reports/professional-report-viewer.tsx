"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { 
  Printer, Download, FileSpreadsheet, FileText, 
  Mail, MessageCircle, ZoomIn, ZoomOut, 
  Monitor, LayoutList, ChevronLeft, ChevronRight,
  MoreVertical, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/ui";
import { getLanguageDirection, type SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { fetchBranding, brandingName } from "@/lib/branding/client";

export type ReportColumn<T = any> = {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, rowIndex: number) => React.ReactNode;
};

export type ReportSummary = {
  totalDebit?: number;
  totalCredit?: number;
  openingBalance?: number;
  closingBalance?: number;
  totalTransactions?: number;
  [key: string]: any;
};

export type ProfessionalReportViewerProps<T = any> = {
  lang: SupportedLanguage;
  title: string;
  subtitle?: string;
  data: T[];
  columns: ReportColumn<T>[];
  summary?: ReportSummary;
  filters?: Record<string, string>;
  rowsPerPage?: number;
  onClose?: () => void;
  /** Dynamic branding — resolved from the record's country when omitted. */
  countryId?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
};

export function ProfessionalReportViewer<T>({
  lang,
  title,
  subtitle,
  data,
  columns,
  summary,
  filters,
  rowsPerPage = 25,
  onClose,
  countryId = null,
  companyName: companyNameProp = null,
  logoUrl: logoUrlProp = null
}: ProfessionalReportViewerProps<T>) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLandscape, setIsLandscape] = useState(true);

  // Resolve branding from the shared /api/erp/branding resolver (record country → session).
  // Props win when provided; otherwise fall back to the neutral product name (never a hard-coded tenant).
  const [brandName, setBrandName] = useState<string | null>(companyNameProp);
  const [brandLogo, setBrandLogo] = useState<string | null>(logoUrlProp);
  useEffect(() => {
    if (companyNameProp) { setBrandName(companyNameProp); setBrandLogo(logoUrlProp); return; }
    let alive = true;
    fetchBranding(countryId).then((b) => {
      if (!alive || !b) return;
      setBrandName(brandingName(b, lang) || null);
      if (b.logoUrl) setBrandLogo(b.logoUrl);
    });
    return () => { alive = false; };
  }, [countryId, companyNameProp, logoUrlProp, lang]);
  const headerName = brandName || t(lang, "pv.report_org_fallback", "Digital Dock ERP");
  const headerLogo = brandLogo || "/logo.png";

  const dir = getLanguageDirection(lang);
  const printRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  }, [data, currentPage, rowsPerPage]);

  const handleZoomIn = () => setZoom(z => Math.min(200, z + 10));
  const handleZoomOut = () => setZoom(z => Math.max(50, z - 10));
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      const headers = columns.map(c => `"${translateHeader(lang, c.header).replace(/"/g, '""')}"`);
      const csvRows = data.map((row: any, i) => {
        return columns.map(c => {
          let val = c.render ? c.render(row, i) : row[c.key];
          if (typeof val === 'object' && val !== null) {
            val = val.toString();
          }
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        }).join(",");
      });
      const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.replace(/\s+/g, "_")}_Export.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export CSV");
    }
  };

  const handleWhatsApp = () => {
    const text = `Report: ${title}\nTransactions: ${data.length}\nGenerated on: ${new Date().toLocaleString()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div dir={dir} className="flex flex-col h-full bg-[#323639] overflow-hidden rounded-md border shadow-lg font-sans">

      {/* TOOLBAR — wraps on narrow screens so PDF / Close are never clipped */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-1.5 sm:px-4 bg-[#202124] text-white border-b border-gray-700 shadow-sm z-10 shrink-0 overflow-x-auto">

        {/* Left: Title & Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <LayoutList className="w-5 h-5" />
          </Button>
          <div className={cn("font-medium text-sm hidden lg:block", dir === "rtl" ? "border-r border-gray-600 pr-3" : "border-l border-gray-600 pl-3")}>
            {title}
          </div>
        </div>

        {/* Center: View Controls (wraps to its own line on narrow screens) */}
        <div className="flex items-center gap-1 bg-[#323639] rounded-md px-1 py-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLandscape(!isLandscape)}
            className={cn("h-7 px-3 text-xs", isLandscape ? "bg-white/20 text-white" : "text-gray-400 hover:text-white")}
          >
            <Monitor className="w-3 h-3 me-2" />
            {t(lang, "pv.landscape", "Landscape")}
          </Button>
          <div className="hidden h-4 w-px bg-gray-600 mx-1 sm:block" />
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-7 w-7 text-gray-300 hover:text-white sm:inline-flex"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            {dir === "rtl" ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <span className="hidden text-xs text-gray-300 px-2 min-w-[80px] text-center sm:inline">
            {t(lang, "pv.page_of", "Page {page} of {total}").replace("{page}", String(currentPage)).replace("{total}", String(totalPages))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-7 w-7 text-gray-300 hover:text-white sm:inline-flex"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            {dir === "rtl" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Right: Actions — PDF + Close always visible; secondary icons collapse under sm */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={handleWhatsApp} title={t(lang, "pv.whatsapp_tooltip", "Share on WhatsApp")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t(lang, "pv.email_tooltip", "Email")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <Mail className="w-4 h-4" />
          </Button>
          <div className="hidden h-5 w-px bg-gray-600 mx-1 sm:block" />
          <Button variant="ghost" size="icon" onClick={handleExportCSV} title={t(lang, "pv.download_csv", "Download CSV")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <FileText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExportCSV} title={t(lang, "pv.download_excel", "Download Excel")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePrint} title={t(lang, "pv.print_download_pdf", "Print / Download PDF")} className="text-gray-300 hover:text-white hover:bg-white/10">
            <Printer className="w-4 h-4" />
          </Button>
          <div className="hidden h-5 w-px bg-gray-600 mx-1 sm:block" />
          <Button variant="ghost" size="icon" onClick={handleZoomOut} title={t(lang, "pv.zoom_out", "Zoom Out")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} title={t(lang, "pv.zoom_in", "Zoom In")} className="hidden text-gray-300 hover:text-white hover:bg-white/10 sm:inline-flex">
            <ZoomIn className="w-4 h-4" />
          </Button>
          {onClose && (
            <>
              <div className="h-5 w-px bg-gray-600 mx-1" />
              <Button variant="ghost" size="icon" onClick={onClose} title={t(lang, "pv.close_preview", "Close Print Preview")} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                <X className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* VIEWER AREA */}
      <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar relative">
        <style dangerouslySetInnerHTML={{__html:`
          @media print {
            body * { visibility: hidden !important; }
            #print-area, #print-area * { visibility: visible !important; }
            #print-area { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
            @page { size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }
            .no-print { display: none !important; }
          }
        `}} />
        
        <div 
          className="mx-auto transition-transform origin-top flex flex-col gap-6"
          style={{ transform: `scale(${zoom / 100})`, width: isLandscape ? '297mm' : '210mm' }}
        >
          <div id="print-area" className="flex flex-col gap-8 pb-10" ref={printRef}>
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
              const start = pageIndex * rowsPerPage;
              const rows = data.slice(start, start + rowsPerPage);
              const isLastPage = pageIndex === totalPages - 1;
              
              return (
                <div
                  key={pageIndex}
                  dir={dir}
                  className="bg-white shadow-xl relative print:shadow-none print:border-none print:mb-0 mb-4 mx-auto overflow-hidden text-black print:page-break-after-always"
                  style={{
                    width: isLandscape ? '297mm' : '210mm',
                    minHeight: isLandscape ? '210mm' : '297mm',
                    padding: '15mm'
                  }}
                >
                  {/* WATERMARK */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 select-none z-0">
                    <img src={headerLogo} alt="" className="w-1/2 object-contain grayscale" />
                  </div>

                  {/* CONTENT (z-10 relative to stay above watermark) */}
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4 border-b border-gray-300 pb-4">
                      <div className="flex items-center gap-3">
                        <img src={headerLogo} alt={t(lang, "pv.logo_alt", "Logo")} className="w-12 h-12 object-contain" />
                        <div>
                          <h2 className="text-xl font-bold uppercase tracking-wide text-gray-800">{headerName}</h2>
                          <p className="text-sm text-gray-500 uppercase font-semibold">{title}</p>
                          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                        </div>
                      </div>
                      <div className={cn("text-[10px] text-gray-500 flex flex-col gap-0.5", dir === "rtl" ? "text-left" : "text-right")}>
                        {filters && Object.entries(filters).map(([k, v]) => v ? <div key={k}>{translateHeader(lang, k)}: <span className="font-semibold text-gray-700">{v}</span></div> : null)}
                        <div className="mt-1">{t(lang, "pv.date_label", "Date")}: {new Date().toLocaleString()}</div>
                        <div>{t(lang, "pv.page_of", "Page {page} of {total}").replace("{page}", String(pageIndex + 1)).replace("{total}", String(totalPages))}</div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1">
                      <table className="w-full text-left border-collapse text-[10px] leading-snug">
                        <thead>
                          <tr className="border-y-2 border-gray-800 bg-gray-50">
                            {columns.map((c) => (
                              <Th key={c.key} className={cn("py-2 px-1.5 font-bold text-gray-800", c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={{ width: c.width }}>
                                {translateHeader(lang, c.header)}
                              </Th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              {columns.map(c => (
                                <td key={c.key} className={cn("py-1.5 px-1.5 align-top break-words max-w-xs", c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                                  {c.render ? c.render(row, start + rIdx) : row[c.key as keyof T] as React.ReactNode}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Section (Only on last page) */}
                    {isLastPage && summary && Object.keys(summary).length > 0 && (
                      <div className="mt-6 border-t-2 border-gray-800 pt-4 pb-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-sm">
                          {Object.entries(summary).map(([k, v]) => {
                            if (v === undefined || v === null) return null;
                            const humanized = k
                              .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                              .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
                              .replace(/^./, str => str.toUpperCase());
                            const label = translateHeader(lang, humanized);
                            return (
                              <div key={k} className="flex flex-col border rounded px-3 py-2 bg-gray-50 shadow-sm">
                                <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
                                <span className="font-bold text-gray-900 mt-1">
                                  {typeof v === 'number' ? new Intl.NumberFormat().format(v) : v}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-6 pt-3 text-center text-[9px] text-gray-400 border-t border-gray-100 uppercase tracking-widest">
                      {t(lang, "pv.footer_note", "This is a computer-generated report. Please verify before official use.")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
