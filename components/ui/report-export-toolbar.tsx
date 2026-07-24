"use client";

import React from "react";
import { Button } from "./button";
import { Printer, Download, FileSpreadsheet } from "lucide-react";

export interface ReportExportToolbarProps {
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  className?: string;
}

export function ReportExportToolbar({
  onExportPdf,
  onExportExcel,
  onPrint,
  className
}: ReportExportToolbarProps) {
  
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className={`flex items-center gap-2 no-print ${className || ""}`}>
      {onExportPdf && (
        <Button variant="outline" size="sm" onClick={onExportPdf} className="h-8">
          <Download className="w-4 h-4 mr-2" />
          PDF
        </Button>
      )}
      {onExportExcel && (
        <Button variant="outline" size="sm" onClick={onExportExcel} className="h-8 text-emerald-600 hover:text-emerald-700">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Excel
        </Button>
      )}
      <Button variant="default" size="sm" onClick={handlePrint} className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
        <Printer className="w-4 h-4 mr-2" />
        Print
      </Button>
    </div>
  );
}
