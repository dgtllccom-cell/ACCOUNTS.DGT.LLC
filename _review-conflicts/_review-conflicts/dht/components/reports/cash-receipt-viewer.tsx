"use client";

import React, { useRef, useState } from "react";
import { Download, Printer, Scissors, Mail, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { numberToWords } from "@/lib/utils/number-to-words";

export type CashReceiptData = {
  receiptNo: string;
  date: string;
  accountNo: string;
  accountName: string;
  paidBy: string; // If empty, will show blank line
  amount: number;
  currency: string;
  narration: string;
  mobileNumber: string; // If empty, will show blank line
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  type: "payment" | "receipt";
};

type CashReceiptViewerProps = {
  data: CashReceiptData;
  onClose: () => void;
};

export function CashReceiptViewer({ data, onClose }: CashReceiptViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const amountInWords = numberToWords(data.amount);
  const title = data.type === "payment" ? "CASH PAYMENT RECEIPT" : "CASH RECEIPT";

  const renderReceiptHalf = (copyType: "OFFICE COPY" | "CUSTOMER COPY") => (
    <div className="flex flex-col h-full bg-white text-slate-900 p-8 pt-6 relative" style={{ boxSizing: "border-box" }}>
      {/* Header Row */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm w-24">Account No.</span>
            <span>:</span>
            <span className="border-b border-black w-48 font-mono text-sm px-2 pb-0.5">{data.accountNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm w-24">Account Name</span>
            <span>:</span>
            <span className="border-b border-black w-48 text-sm px-2 pb-0.5">{data.accountName}</span>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-[#0b1f3c] text-white px-6 py-2 rounded-sm font-black text-xl uppercase tracking-wider h-fit">
            {title}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-[#0b1f3c] text-white px-4 py-1.5 rounded-sm font-bold text-sm mb-4">
            {copyType}
          </div>
        </div>
      </div>

      {/* Company Info & Receipt Metadata */}
      <div className="flex justify-between items-start mb-8 pl-10">
        <div className="space-y-1">
          <h2 className="text-[#0b1f3c] text-2xl font-black mb-2 tracking-tight">{data.companyName}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-800">
            <div className="w-5 h-5 rounded-full bg-[#0b1f3c] flex items-center justify-center text-white">📍</div>
            <span>{data.companyAddress}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-800">
            <div className="w-5 h-5 rounded-full bg-[#0b1f3c] flex items-center justify-center text-white">📞</div>
            <span>{data.companyPhone}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-800">
            <div className="w-5 h-5 rounded-full bg-[#0b1f3c] flex items-center justify-center text-white">✉️</div>
            <span>{data.companyEmail}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-800">
            <div className="w-5 h-5 rounded-full bg-[#0b1f3c] flex items-center justify-center text-white">🌐</div>
            <span>{data.companyWebsite}</span>
          </div>
        </div>

        <div className="flex flex-col space-y-4 pt-4 pr-10">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm w-16">Date:</span>
            <span className="border-b border-black w-48 text-sm px-2 pb-0.5">{data.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm w-16">Receipt #:</span>
            <span className="border-b border-black w-48 text-sm font-mono px-2 pb-0.5">{data.receiptNo}</span>
          </div>
        </div>
      </div>

      {/* Payment Info Title */}
      <div className="flex justify-center mb-6">
        <div className="bg-[#0b1f3c] text-white px-6 py-1.5 rounded-sm font-bold text-sm">
          PAYMENT INFORMATION
        </div>
      </div>

      {/* Main Body */}
      <div className="flex justify-between items-start mb-10 pl-4 gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex items-end gap-2">
            <span className="font-bold text-sm w-28 shrink-0">Paid By:</span>
            <span className="border-b border-black flex-1 text-sm pb-1 px-2">{data.paidBy}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-bold text-sm w-28 shrink-0">Amount Paid:</span>
            <span className="border-b border-black flex-1 text-sm pb-1 px-2">{amountInWords}</span>
            <span className="font-bold text-sm shrink-0">{data.currency}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-bold text-sm w-28 shrink-0">For Payment Of:</span>
            <span className="border-b border-black flex-1 text-sm pb-1 px-2">{data.narration}</span>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <span className="font-bold text-sm w-28 shrink-0">Mobile Number:</span>
            <span className="border-b border-black w-64 text-sm pb-1 px-2">{data.mobileNumber}</span>
          </div>
        </div>

        <div className="w-72 h-32 border border-[#0b1f3c] rounded flex items-center px-4 bg-slate-50 shrink-0 mt-2">
          <span className="font-black text-xl mr-2">Amount:</span>
          <span className="font-black text-2xl mr-1">{data.currency === "USD" ? "$" : data.currency}</span>
          <span className="border-b border-black flex-1 text-right text-xl font-mono pb-1 font-bold">
            {data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="flex justify-between items-end mt-auto pb-4 px-4">
        <div className="flex items-end gap-2 w-1/3">
          <span className="font-bold text-sm shrink-0">Received By:</span>
          <span className="border-b border-black flex-1"></span>
        </div>
        <div className="flex items-end gap-2 w-1/3">
          <span className="font-bold text-sm shrink-0">Authorized Signature:</span>
          <span className="border-b border-black flex-1"></span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-500/80 backdrop-blur-sm">
      {/* Print Overlay Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .no-print { display: none !important; }
        }
      ` }} />

      {/* Toolbar */}
      <div className="no-print border-b bg-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-14">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-slate-800">Print Cash Receipt</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-500">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center no-print">
        {/* A4 Container */}
        <div 
          className="print-area bg-white shadow-xl flex flex-col mx-auto"
          style={{ width: "210mm", height: "297mm" }}
          ref={contentRef}
        >
          {/* Top Half: Office Copy */}
          <div className="h-[50%] border-b-2 border-dashed border-slate-300 relative">
            {renderReceiptHalf("OFFICE COPY")}
            {/* Scissor Icon on the dashed line */}
            <div className="absolute -bottom-[10px] left-0 text-slate-400 bg-white pr-2">
              <Scissors className="h-5 w-5" />
            </div>
          </div>
          
          {/* Bottom Half: Customer Copy */}
          <div className="h-[50%]">
            {renderReceiptHalf("CUSTOMER COPY")}
          </div>
        </div>
      </div>
    </div>
  );
}
