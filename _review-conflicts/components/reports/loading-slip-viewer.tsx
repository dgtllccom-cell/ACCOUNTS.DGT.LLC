"use client";
import React, { useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LoadingSlipData = {
  // Header
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  
  // Invoice Info
  invoiceNo: string;
  invoiceDate: string;
  referenceNo: string;
  referenceDate: string;
  
  // Parties
  exporterName: string;
  exporterAddress: string;
  consigneeName: string;
  consigneeAddress: string;
  notifyParty: string;
  
  // Shipment Info
  originCountry: string;
  destinationCountry: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  containerNo: string;
  vesselFlightNo: string;
  
  // Items
  items: Array<{
    srNo: number;
    description: string;
    hsCode: string;
    rate: number;
    quantity: number;
    units: string;
    amount: number;
    netWeight?: number;
    grossWeight?: number;
  }>;
  
  // Summary
  totalQuantity: number;
  totalNetWeight: number;
  totalGrossWeight: number;
  totalAmount: number;
  currency: string;
  amountInWords: string;
  
  // Footer
  remarks: string;
};

type LoadingSlipViewerProps = {
  data: LoadingSlipData;
  onClose: () => void;
};

export function LoadingSlipViewer({ data, onClose }: LoadingSlipViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-500/80 backdrop-blur-sm">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      ` }} />

      {/* Toolbar */}
      <div className="no-print border-b bg-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-14">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-slate-800">Print Loading Slip</h2>
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
          className="print-area bg-white shadow-xl flex flex-col mx-auto text-sm border-2 border-black"
          style={{ width: "210mm", minHeight: "297mm", padding: "0" }}
        >
          {/* Top Title */}
          <div className="flex justify-between items-start border-b-2 border-black p-4">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-[#0b1f3c] text-white flex items-center justify-center font-bold rounded">
                LOGO
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 uppercase">{data.companyName}</h1>
                <p className="text-xs text-slate-700 w-64">{data.companyAddress}</p>
              </div>
            </div>
            <div className="text-right pt-2">
              <h2 className="text-2xl font-black uppercase tracking-widest text-[#0b1f3c]">Commercial Invoice</h2>
            </div>
          </div>

          <table className="w-full h-full flex-1 border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="border-b-2 border-black">
              <tr>
                <td colSpan={10} className="p-0 border-b-2 border-black">
                  <div className="grid grid-cols-2">
                    {/* Left Side Parties */}
                    <div className="border-r-2 border-black">
                      <div className="border-b-2 border-black p-2 min-h-[90px]">
                        <div className="font-bold text-xs uppercase mb-1">Exporter / Shipper</div>
                        <div className="font-semibold">{data.exporterName}</div>
                        <div className="text-xs">{data.exporterAddress}</div>
                      </div>
                      <div className="border-b-2 border-black p-2 min-h-[90px]">
                        <div className="font-bold text-xs uppercase mb-1">Consignee</div>
                        <div className="font-semibold">{data.consigneeName}</div>
                        <div className="text-xs">{data.consigneeAddress}</div>
                      </div>
                      <div className="p-2 min-h-[70px]">
                        <div className="font-bold text-xs uppercase mb-1">Notify Party</div>
                        <div className="font-semibold">{data.notifyParty || "SAME AS CONSIGNEE"}</div>
                      </div>
                    </div>

                    {/* Right Side Info */}
                    <div>
                      <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="border-r-2 border-black p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Invoice No.</div>
                          <div className="font-semibold">{data.invoiceNo}</div>
                        </div>
                        <div className="p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Date</div>
                          <div className="font-semibold">{data.invoiceDate}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="border-r-2 border-black p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Reference No.</div>
                          <div className="font-semibold">{data.referenceNo}</div>
                        </div>
                        <div className="p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Ref Date</div>
                          <div className="font-semibold">{data.referenceDate}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="border-r-2 border-black p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Country of Origin</div>
                          <div className="font-semibold">{data.originCountry}</div>
                        </div>
                        <div className="p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Country of Destination</div>
                          <div className="font-semibold">{data.destinationCountry}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="border-r-2 border-black p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Port of Loading</div>
                          <div className="font-semibold">{data.portOfLoading}</div>
                        </div>
                        <div className="p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Port of Discharge</div>
                          <div className="font-semibold">{data.portOfDischarge}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2">
                        <div className="border-r-2 border-black p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Final Destination</div>
                          <div className="font-semibold">{data.finalDestination}</div>
                        </div>
                        <div className="p-2 min-h-[45px]">
                          <div className="font-bold text-xs uppercase">Container / Flight No.</div>
                          <div className="font-semibold">{data.containerNo} {data.vesselFlightNo ? `/ ${data.vesselFlightNo}` : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
              {/* Table Headers */}
              <tr className="bg-slate-50 text-xs font-bold uppercase text-center">
                <th className="border-r-2 border-black p-2 w-10">Sr.</th>
                <th className="border-r-2 border-black p-2 w-[25%] text-left">Description of Goods</th>
                <th className="border-r-2 border-black p-2 w-20">HS Code</th>
                <th className="border-r-2 border-black p-2 w-20">Rate</th>
                <th className="border-r-2 border-black p-2 w-20">Qty</th>
                <th className="border-r-2 border-black p-2 w-16">Unit</th>
                <th className="border-r-2 border-black p-2 w-20">Net Wt</th>
                <th className="border-r-2 border-black p-2 w-20">Gross Wt</th>
                <th className="p-2 w-24">Amount</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="text-center align-top h-auto">
                  <td className="border-r-2 border-black p-2">{item.srNo}</td>
                  <td className="border-r-2 border-black p-2 text-left font-semibold">{item.description}</td>
                  <td className="border-r-2 border-black p-2">{item.hsCode}</td>
                  <td className="border-r-2 border-black p-2">{item.rate.toLocaleString()}</td>
                  <td className="border-r-2 border-black p-2">{item.quantity}</td>
                  <td className="border-r-2 border-black p-2">{item.units}</td>
                  <td className="border-r-2 border-black p-2">{item.netWeight ? item.netWeight.toLocaleString() : "-"}</td>
                  <td className="border-r-2 border-black p-2">{item.grossWeight ? item.grossWeight.toLocaleString() : "-"}</td>
                  <td className="p-2 font-semibold">
                    {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Filler row to push footer down if items are few */}
              <tr className="h-full">
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td></td>
              </tr>
            </tbody>

            {/* Table Footer */}
            <tfoot className="border-t-2 border-black font-semibold text-sm">
              <tr className="bg-slate-50 text-center">
                <td colSpan={4} className="border-r-2 border-black p-2 text-right">TOTAL</td>
                <td className="border-r-2 border-black p-2">{data.totalQuantity}</td>
                <td className="border-r-2 border-black p-2"></td>
                <td className="border-r-2 border-black p-2">{data.totalNetWeight ? data.totalNetWeight.toLocaleString() : "-"}</td>
                <td className="border-r-2 border-black p-2">{data.totalGrossWeight ? data.totalGrossWeight.toLocaleString() : "-"}</td>
                <td className="p-2">{data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan={9} className="border-t-2 border-black p-0">
                  <div className="flex">
                    <div className="w-2/3 border-r-2 border-black p-3 space-y-4">
                      <div>
                        <span className="font-bold text-xs uppercase">Amount in Words:</span>
                        <div className="font-semibold mt-1">
                          {data.amountInWords} {data.currency} ONLY
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-xs uppercase">Remarks / Declaration:</span>
                        <div className="text-xs mt-1">
                          {data.remarks || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
                        </div>
                      </div>
                    </div>
                    <div className="w-1/3 p-3 flex flex-col justify-between">
                      <div className="font-bold text-xs uppercase text-right">For {data.companyName}</div>
                      <div className="mt-16 text-right font-bold text-xs border-t border-black w-48 ml-auto pt-1">
                        Authorized Signatory
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
