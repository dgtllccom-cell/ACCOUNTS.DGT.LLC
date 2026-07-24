"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePrintStore } from "@/lib/store/print-store";
import { Button } from "@/components/ui/button";
import { X, Printer, Download, Mail, Share2, Menu, FileText, LayoutList } from "lucide-react";

export function PdfPreviewModal() {
  const { isOpen, htmlContent, title, closePrint } = usePrintStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [paperSize, setPaperSize] = useState("A4");
  const [pages, setPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleDownload = () => {
    // In a browser environment, standard print dialog with "Save to PDF" is the most robust 
    // way to download high-fidelity HTML-to-PDF without external heavy libraries.
    handlePrint();
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

  // Inject dynamic styles into the iframe for orientation and paper size
  const injectedHtml = `
    ${htmlContent}
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
    </style>
  `;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#1e293b] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <div className="h-14 bg-[#0f172a] border-b border-slate-700 flex items-center justify-between px-4">
        
        {/* Left: Brand & Menu */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white" onClick={closePrint}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 text-white font-semibold">
            <Menu className="w-5 h-5 text-slate-400" />
            <span className="hidden sm:inline">{title || "Accounts"}</span>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 sm:gap-4 bg-[#1e293b] p-1.5 rounded-lg border border-slate-700">
          <button 
            onClick={() => setOrientation(o => o === "portrait" ? "landscape" : "portrait")}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline capitalize">{orientation}</span>
          </button>
          
          <div className="text-xs font-medium text-slate-300 px-2 border-x border-slate-700">
            Page {currentPage} of {pages.length}
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-green-400 hover:bg-slate-800" onClick={handleShareWhatsApp} title="WhatsApp">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-blue-400 hover:bg-slate-800" onClick={handleShareEmail} title="Email">
            <Mail className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={handleDownload} title="Download PDF">
            <Download className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-900/20" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
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
          <div 
            className="bg-white shadow-2xl rounded-sm transition-all duration-300 ease-in-out relative"
            style={{
              width: orientation === "portrait" ? "210mm" : "297mm",
              minHeight: orientation === "portrait" ? "297mm" : "210mm",
              maxWidth: "100%",
            }}
          >
             <iframe
                ref={iframeRef}
                srcDoc={injectedHtml}
                className="w-full h-full absolute inset-0 border-none rounded-sm"
                title="PDF Preview"
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
