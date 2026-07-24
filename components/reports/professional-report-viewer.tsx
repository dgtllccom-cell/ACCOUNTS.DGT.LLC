"use client";

import { useMemo, useState, useRef } from "react";
import { 
  Printer, Download, FileSpreadsheet, FileText, 
  Mail, MessageCircle, ZoomIn, ZoomOut, 
  Monitor, LayoutList, ChevronLeft, ChevronRight,
  MoreVertical, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

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
  onClose
}: ProfessionalReportViewerProps<T>) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLandscape, setIsLandscape] = useState(true);
  
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
      const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`);
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
    <div className="flex flex-col h-full bg-[#323639] overflow-hidden rounded-md border shadow-lg font-sans">
      
      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#202124] text-white border-b border-gray-700 shadow-sm z-10 shrink-0">
        
        {/* Left: Title & Menu */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10">
            <LayoutList className="w-5 h-5" />
          </Button>
          <div className="font-medium text-sm hidden md:block border-l border-gray-600 pl-3">
            {title}
          </div>
        </div>

        {/* Center: View Controls */}
        <div className="flex items-center gap-1 bg-[#323639] rounded-md px-1 py-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsLandscape(!isLandscape)}
            className={cn("h-7 px-3 text-xs", isLandscape ? "bg-white/20 text-white" : "text-gray-400 hover:text-white")}
          >
            <Monitor className="w-3 h-3 mr-2" />
            Landscape
          </Button>
          <div className="h-4 w-px bg-gray-600 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-gray-300 hover:text-white"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-300 px-2 min-w-[80px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-gray-300 hover:text-white"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleWhatsApp} title="Share on WhatsApp" className="text-gray-300 hover:text-white hover:bg-white/10">
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Email" className="text-gray-300 hover:text-white hover:bg-white/10">
            <Mail className="w-4 h-4" />
          </Button>
          <div className="h-5 w-px bg-gray-600 mx-1" />
          <Button variant="ghost" size="icon" onClick={handleExportCSV} title="Download CSV" className="text-gray-300 hover:text-white hover:bg-white/10">
            <FileText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExportCSV} title="Download Excel" className="text-gray-300 hover:text-white hover:bg-white/10">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePrint} title="Download PDF / Print" className="text-gray-300 hover:text-white hover:bg-white/10">
            <Printer className="w-4 h-4" />
          </Button>
          <div className="h-5 w-px bg-gray-600 mx-1" />
          <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out" className="text-gray-300 hover:text-white hover:bg-white/10">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In" className="text-gray-300 hover:text-white hover:bg-white/10">
            <ZoomIn className="w-4 h-4" />
          </Button>
          {onClose && (
            <>
              <div className="h-5 w-px bg-gray-600 mx-1" />
              <Button variant="ghost" size="icon" onClick={onClose} title="Close Print Preview" className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
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
                  className="bg-white shadow-xl relative print:shadow-none print:border-none print:mb-0 mb-4 mx-auto overflow-hidden text-black print:page-break-after-always"
                  style={{ 
                    width: isLandscape ? '297mm' : '210mm', 
                    minHeight: isLandscape ? '210mm' : '297mm',
                    padding: '15mm'
                  }}
                >
                  {/* WATERMARK */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 select-none z-0">
                    <img src="/logo.png" alt="" className="w-1/2 object-contain grayscale" />
                  </div>

                  {/* CONTENT (z-10 relative to stay above watermark) */}
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4 border-b border-gray-300 pb-4">
                      <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
                        <div>
                          <h2 className="text-xl font-bold uppercase tracking-wide text-gray-800">Damaan General Trading LLC</h2>
                          <p className="text-sm text-gray-500 uppercase font-semibold">{title}</p>
                          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-gray-500 flex flex-col gap-0.5">
                        {filters && Object.entries(filters).map(([k, v]) => v ? <div key={k}>{k}: <span className="font-semibold text-gray-700">{v}</span></div> : null)}
                        <div className="mt-1">Date: {new Date().toLocaleString()}</div>
                        <div>Page: {pageIndex + 1} of {totalPages}</div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1">
                      <table className="w-full text-left border-collapse text-[10px] leading-snug">
                        <thead>
                          <tr className="border-y-2 border-gray-800 bg-gray-50">
                            {columns.map((c) => (
                              <th key={c.key} className={cn("py-2 px-1.5 font-bold text-gray-800", c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={{ width: c.width }}>
                                {c.header}
                              </th>
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
                            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
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
                      This is a computer-generated print. Errors are expected.
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
