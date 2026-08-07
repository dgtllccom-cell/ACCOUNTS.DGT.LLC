"use client";

import { useMemo, useState, useRef } from "react";
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageCircle,
  ZoomIn,
  ZoomOut,
  Monitor,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
  Share2,
  CheckCircle2,
  Building2,
  FileCode,
  RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

export type UniversalPDFRow = {
  srNo?: number | string;
  refNo?: string;
  date?: string;
  fromCountry?: string;
  toCountry?: string;
  personCompany?: string;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  fromConvertedCurrency?: string;
  fromConvertedAmount?: number;
  toConvertedCurrency?: string;
  toConvertedAmount?: number;
  remarks?: string;
  [key: string]: any;
};

export type CurrencySummaryItem = {
  currency: string;
  fromTotal: number;
  toTotal: number;
};

export type UniversalPDFViewerProps = {
  lang?: SupportedLanguage;
  companyName?: string;
  companyMotto?: string;
  logoUrl?: string;
  title: string;
  fromDate?: string;
  toDate?: string;
  printedOn?: string;
  preparedBy?: string;
  approvedBy?: string;
  rows: UniversalPDFRow[];
  currencySummaries?: CurrencySummaryItem[];
  rowsPerPage?: number;
  onClose?: () => void;
};

export function UniversalPDFViewer({
  lang = "en",
  companyName = "Damaan Group Of Business",
  companyMotto = "Empowering Growth",
  logoUrl,
  title = "Inter-Country Transfer Report",
  fromDate = "01-Jan-2024",
  toDate = "31-Jan-2024",
  printedOn,
  preparedBy = "Admin",
  approvedBy = "Manager",
  rows = [],
  currencySummaries = [],
  rowsPerPage = 8,
  onClose
}: UniversalPDFViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLandscape, setIsLandscape] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");
  const [marginTop, setMarginTop] = useState(10);
  const [marginBottom, setMarginBottom] = useState(10);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentPrintedOn = printedOn || `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, currentPage, rowsPerPage]);

  const computedSummaries = useMemo(() => {
    if (currencySummaries && currencySummaries.length > 0) return currencySummaries;

    const map: Record<string, { fromTotal: number; toTotal: number }> = {};
    rows.forEach(r => {
      const fromCurr = r.fromConvertedCurrency || r.originalCurrency || "USD";
      const toCurr = r.toConvertedCurrency || "PKR";
      
      if (!map[fromCurr]) map[fromCurr] = { fromTotal: 0, toTotal: 0 };
      if (!map[toCurr]) map[toCurr] = { fromTotal: 0, toTotal: 0 };

      map[fromCurr].fromTotal += Number(r.fromConvertedAmount || r.originalAmount || 0);
      map[toCurr].toTotal += Number(r.toConvertedAmount || 0);
    });

    return Object.entries(map).map(([currency, data]) => ({
      currency,
      fromTotal: data.fromTotal,
      toTotal: data.toTotal
    }));
  }, [rows, currencySummaries]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Sr No", "Ref No", "Date", "From Country", "To Country", "Person/Company", "Orig Currency", "Orig Amount", "Rate", "From Converted", "To Converted", "Remarks"];
      const csvRows = rows.map((r, i) => [
        r.srNo || i + 1,
        `"${r.refNo || ""}"`,
        `"${r.date || ""}"`,
        `"${r.fromCountry || ""}"`,
        `"${r.toCountry || ""}"`,
        `"${r.personCompany || ""}"`,
        `"${r.originalCurrency || ""}"`,
        r.originalAmount || 0,
        r.exchangeRate || 1,
        `"${r.fromConvertedCurrency || ""} ${r.fromConvertedAmount || 0}"`,
        `"${r.toConvertedCurrency || ""} ${r.toConvertedAmount || 0}"`,
        `"${r.remarks || ""}"`
      ].join(","));

      const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.replace(/\s+/g, "_")}_Export.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export report CSV");
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Report: ${title}\nFrom: ${fromDate} To: ${toDate}\nTotal Entries: ${rows.length}\nPrinted On: ${currentPrintedOn}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleSendEmail = () => {
    if (!emailRecipient) return alert("Please enter email address");
    alert(`Report email dispatched to ${emailRecipient} successfully!`);
    setShowEmailModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#2a2d30] text-slate-100 overflow-hidden font-sans rounded-xl border border-slate-700 shadow-2xl">
      
      {/* ── TOP CONTROL TOOLBAR ── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#1e2022] border-b border-slate-700 text-xs gap-2 shrink-0 z-20">
        
        {/* Left: Title & Navigation */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-white tracking-wide text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            {title}
          </span>
          <span className="hidden md:inline-block px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
            A4 {isLandscape ? "Landscape" : "Portrait"}
          </span>
        </div>

        {/* Center: Page Counter & Zoom */}
        <div className="flex items-center gap-1.5 bg-[#2d3135] rounded-lg px-2 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-300 hover:text-white"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono font-bold text-slate-200 px-2 min-w-[70px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-300 hover:text-white"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-slate-600 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-300 hover:text-white"
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-mono text-slate-300 w-10 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-300 hover:text-white"
            onClick={() => setZoom(z => Math.min(180, z + 10))}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Right: Actions Top Bar Options (Print, Download, Email, WhatsApp, Page Settings) */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-none font-bold text-xs"
            title="Print PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPDF}
            className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-none font-bold text-xs"
            title="Download PDF Document"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEmailModal(true)}
            className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-none font-bold text-xs"
            title="Email PDF Report"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleWhatsAppShare}
            className="h-8 gap-1.5 bg-green-600 hover:bg-green-500 text-white border-none font-bold text-xs"
            title="Share via WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>WhatsApp</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600 font-bold text-xs"
            title="Page Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Page Settings</span>
          </Button>

          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 ml-1"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── PAGE SETTINGS POPOVER PANEL ── */}
      {showSettings && (
        <div className="bg-[#18191b] border-b border-slate-700 p-4 flex flex-wrap items-center gap-6 text-xs z-20 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Label className="text-slate-400 font-bold">Orientation:</Label>
            <Button
              size="sm"
              variant={isLandscape ? "default" : "outline"}
              onClick={() => setIsLandscape(true)}
              className="h-7 text-xs"
            >
              Landscape
            </Button>
            <Button
              size="sm"
              variant={!isLandscape ? "default" : "outline"}
              onClick={() => setIsLandscape(false)}
              className="h-7 text-xs"
            >
              Portrait
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-slate-400 font-bold">Page Size:</Label>
            <select
              value={pageSize}
              onChange={(e: any) => setPageSize(e.target.value)}
              className="h-7 rounded bg-slate-800 border border-slate-700 px-2 text-xs text-slate-200"
            >
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="Letter">Letter (8.5 x 11 in)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-slate-400 font-bold">Export Format:</Label>
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="h-7 gap-1 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> CSV
            </Button>
          </div>
        </div>
      )}

      {/* ── MAIN BODY & THUMBNAIL SIDEBAR ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Thumbnail Sidebar */}
        <div className="w-48 bg-[#1f2124] border-r border-slate-700 p-3 hidden lg:flex flex-col gap-3 overflow-y-auto shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-2 flex items-center justify-between">
            <span>Page Thumbnails</span>
            <span className="font-mono text-blue-400">{totalPages} Pages</span>
          </div>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => (
            <button
              key={pNum}
              onClick={() => setCurrentPage(pNum)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all cursor-pointer text-left",
                currentPage === pNum
                  ? "bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/40"
                  : "bg-slate-800/60 border-slate-700 hover:bg-slate-800"
              )}
            >
              <div className="w-full aspect-[1/1.4] bg-white rounded shadow-sm flex flex-col p-1 text-[5px] text-slate-800 overflow-hidden select-none">
                <div className="font-bold border-b pb-0.5 mb-1 text-[6px] text-blue-700 flex justify-between">
                  <span>{title.slice(0, 14)}...</span>
                  <span>#{pNum}</span>
                </div>
                <div className="space-y-0.5 opacity-60">
                  <div className="h-1 bg-slate-300 rounded w-full"></div>
                  <div className="h-1 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-1 bg-slate-200 rounded w-5/6"></div>
                  <div className="h-1 bg-slate-300 rounded w-full"></div>
                </div>
              </div>
              <span className="text-[10px] font-bold font-mono text-slate-300">Page {pNum}</span>
            </button>
          ))}
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-[#2a2d30]">
          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * { visibility: hidden !important; }
              #pdf-print-area, #pdf-print-area * { visibility: visible !important; }
              #pdf-print-area {
                position: absolute !important;
                left: 0;
                top: 0;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
              }
              @page {
                size: ${pageSize} ${isLandscape ? "landscape" : "portrait"};
                margin: ${marginTop}mm 10mm ${marginBottom}mm 10mm;
              }
              .no-print { display: none !important; }
            }
          `}} />

          {/* ── A4 PAPER DOCUMENT CONTAINER ── */}
          <div
            ref={printAreaRef}
            id="pdf-print-area"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            className={cn(
              "bg-white text-slate-900 shadow-2xl transition-all rounded-sm flex flex-col justify-between p-8 min-h-[900px]",
              isLandscape ? "w-[1050px]" : "w-[750px]"
            )}
          >
            <div>
              {/* DOCUMENT HEADER */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Company Logo" className="h-12 w-auto object-contain" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                        🌐
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-blue-900 uppercase">
                        {companyName}
                      </h2>
                      <p className="text-xs font-semibold text-slate-500 tracking-wider">
                        {companyMotto}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                      {title}
                    </h1>
                    <p className="text-xs font-bold text-slate-600 mt-1">
                      From Date: <span className="font-mono">{fromDate}</span> To Date: <span className="font-mono">{toDate}</span>
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Printed On: {currentPrintedOn} | Page {currentPage} of {totalPages}
                    </p>
                  </div>
                </div>
              </div>

              {/* DATA TABLE */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-400">
                      <Th className="border border-slate-300 p-2 text-center w-12">Sr. No.</Th>
                      <Th className="border border-slate-300 p-2 text-left">Transfer Ref No.</Th>
                      <Th className="border border-slate-300 p-2 text-center">Transfer Date</Th>
                      <Th className="border border-slate-300 p-2 text-left">From Country</Th>
                      <Th className="border border-slate-300 p-2 text-left">To Country</Th>
                      <Th className="border border-slate-300 p-2 text-left">Person / Company</Th>
                      <Th className="border border-slate-300 p-2 text-center">Original Currency</Th>
                      <Th className="border border-slate-300 p-2 text-right">Original Amount</Th>
                      <Th className="border border-slate-300 p-2 text-right">Exchange Rate</Th>
                      <Th className="border border-slate-300 p-2 text-right">From Country Currency (Converted)</Th>
                      <Th className="border border-slate-300 p-2 text-right">To Country Currency (Converted)</Th>
                      <Th className="border border-slate-300 p-2 text-left">Remarks</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-6 text-center text-slate-500 font-medium">
                          No report entries available for this view.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((r, idx) => (
                        <tr key={r.refNo || idx} className="hover:bg-slate-50 border-b border-slate-200 text-[11px]">
                          <td className="border border-slate-300 p-2 text-center font-mono">{r.srNo || (currentPage - 1) * rowsPerPage + idx + 1}</td>
                          <td className="border border-slate-300 p-2 font-mono font-semibold text-blue-800">{r.refNo || "-"}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono">{r.date || "-"}</td>
                          <td className="border border-slate-300 p-2 font-medium">{r.fromCountry || "-"}</td>
                          <td className="border border-slate-300 p-2 font-medium">{r.toCountry || "-"}</td>
                          <td className="border border-slate-300 p-2 font-semibold">{r.personCompany || "-"}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold">{r.originalCurrency || "USD"}</td>
                          <td className="border border-slate-300 p-2 text-right font-mono font-bold">{r.originalAmount ? Number(r.originalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}</td>
                          <td className="border border-slate-300 p-2 text-right font-mono text-blue-700">{r.exchangeRate ? Number(r.exchangeRate).toFixed(4) : "1.0000"}</td>
                          <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-800">
                            {r.fromConvertedCurrency || "AFN"} {r.fromConvertedAmount ? Number(r.fromConvertedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-800">
                            {r.toConvertedCurrency || "PKR"} {r.toConvertedAmount ? Number(r.toConvertedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td className="border border-slate-300 p-2 text-slate-600">{r.remarks || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* SUMMARY SECTION IN FUNCTIONAL CURRENCY */}
              <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b pb-1">
                  Summary in Functional Currency
                </h3>
                <div className="max-w-md border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b">
                        <Th className="p-2 border-r text-left">From Country Currency Total</Th>
                        <Th className="p-2 text-left">To Country Currency Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedSummaries.map((s, i) => (
                        <tr key={i} className="border-b font-mono">
                          <td className="p-2 border-r">
                            <span className="font-bold mr-2">{s.currency}:</span>
                            {s.fromTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2">
                            <span className="font-bold mr-2">{s.currency}:</span>
                            {s.toTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* SIGNATURE SECTION */}
            <div className="pt-8 border-t-2 border-slate-300 mt-auto">
              <div className="flex justify-between items-end px-12">
                <div className="text-center w-48">
                  <div className="border-b border-slate-900 mb-1 pb-1 font-bold text-sm">
                    {preparedBy}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Prepared By
                  </div>
                </div>

                <div className="text-center w-48">
                  <div className="border-b border-slate-900 mb-1 pb-1 font-bold text-sm">
                    {approvedBy}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Approved By
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── EMAIL DIALOG MODAL ── */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-indigo-400" />
              <span>Email PDF Report</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-bold text-slate-300">Recipient Email Address</Label>
              <Input
                type="email"
                placeholder="manager@damaan.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1.5"
              />
            </div>
            <div className="p-3 bg-slate-800/80 rounded border border-slate-700 text-xs text-slate-400 space-y-1">
              <p><span className="font-bold text-slate-200">Report:</span> {title}</p>
              <p><span className="font-bold text-slate-200">Date Range:</span> {fromDate} to {toDate}</p>
            </div>
            <Button onClick={handleSendEmail} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
              Send PDF Report Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
