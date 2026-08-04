"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Play, Video, ShieldCheck, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export default function WalkthroughVideoPage() {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Header Banner ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-black uppercase tracking-wider mb-2">
            <Video className="h-4 w-4" />
            <span>Digital Dock ERP • System Walkthrough Video</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            System Walkthrough & Operating Guide / ویڈیو واک تھرو
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Interactive recording of ERP workflows, navigation, multi-language switching, master setup, Roznamcha, sales, purchases, and accounting reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/erp_qa_walkthrough.webp"
            download="Digital_Dock_ERP_Walkthrough.webp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 text-xs shadow-lg">
              <Download className="h-4 w-4" />
              Download Video File (18 MB)
            </Button>
          </a>
        </div>
      </div>

      {/* ── Main Video Player Card ── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-950">
        <CardHeader className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-400 fill-emerald-400" />
            <span>Live System Walkthrough Stream</span>
          </CardTitle>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            100% Production Ready
          </span>
        </CardHeader>
        <CardContent className="p-0 flex items-center justify-center min-h-[480px] bg-black">
          <div className="relative w-full overflow-hidden flex flex-col items-center">
            {/* Embedded WebP video stream */}
            <img
              src="/erp_qa_walkthrough.webp"
              alt="Digital Dock ERP Complete Interactive System Walkthrough Video"
              className="w-full max-h-[720px] object-contain bg-black"
              onError={(e) => {
                // Fallback to exports path if root fails
                (e.target as HTMLImageElement).src = "/exports/erp_qa_walkthrough.webp";
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Key Highlights & Feature Matrix ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span>Multi-Language & RTL Engine</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Demonstrates 5-language switcher (English, Urdu 🇵🇰, Pashto 🇦🇫, Arabic 🇦🇪, Persian 🇮🇷).
            </p>
            <p>
              Technical fields (Email, User ID, Passwords, URLs) remain in English while all business modules adapt to locale & RTL.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Roznamcha & Multi-Currency</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Daily cash entries, bank vouchers, Money Exchange (Buy/Sell rate formulas), and expense bills.
            </p>
            <p>
              Automatic Debit/Credit balancing and double-entry ledger postings.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span>Logistics & Master Setup</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Purchase Booking, Truck Loading, Clearing Agent forms, Commercial Invoices, and BL trade documents.
            </p>
            <p>
              100% database-driven master forms (Companies, Customers, Banks, Warehouses, Products, Employees).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
