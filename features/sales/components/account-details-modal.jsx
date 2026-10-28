"use client";
import React, { useState } from "react";
import {
  X,
  Building2,
  Landmark,
  User,
  CreditCard,
  Globe2,
  MapPin,
  Phone,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrencyFlag } from "./sales-booking-upper-cards";

export function AccountDetailsModal({
  isOpen,
  onClose,
  account = null,
  accountType = "customer", // "sales" | "customer" | "purchase"
  lang = "en"
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !account) return null;

  const isSales = accountType === "sales";
  const title = account.accountName || account.name || (isSales ? "Sales Account" : "Customer Account");
  const code = account.accountCode || account.code || account.account_number || "—";
  const branch = account.cityBranchName || account.branchName || account.branch || "Main Branch";
  const company = account.companyName || account.company || (isSales ? "Global Trading LLC" : "Al Noor Imports");
  const currency = account.ledgerCurrency || account.currency || account.salesCurrency || "AED";
  const currentBalance = Number(account.currentBalance ?? account.current_balance ?? 0);
  const openingBalance = Number(account.openingBalance ?? account.opening_balance ?? 0);
  const kind = account.kind || account.businessName || (isSales ? "Income / Revenue" : "Asset / Accounts Receivable");
  const manualRef = account.manualReferenceNumber || account.manualReference || "—";
  const phone = account.mobile || account.phone || "—";
  const whatsapp = account.whatsapp || "—";
  const address = account.address || account.companyAddress || (isSales ? "Office 101, Business Bay, Dubai, UAE" : "Warehouse 5, Jebel Ali, Dubai, UAE");
  const license = account.licenseNo || (isSales ? "TRN1234567890" : "TRN0987654321");
  const trn = account.gstTrn || (isSales ? "100123456789003" : "100987654321003");

  const handleCopyCode = () => {
    if (!code || code === "—") return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className={`p-4 sm:p-5 text-white ${isSales ? "bg-gradient-to-r from-emerald-600 to-teal-700" : "bg-gradient-to-r from-amber-600 to-orange-700"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                {isSales ? <ArrowUpRight className="w-6 h-6 text-white" /> : <ArrowDownLeft className="w-6 h-6 text-white" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                    {isSales ? "Sales Account (CR)" : "Customer / Party Account (DR)"}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" />
                    Verified & Active
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-white mt-0.5">
                  {title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Account Code Pill */}
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/20">
            <span className="text-xs text-white/80 font-medium">Account Code:</span>
            <span className="font-mono font-black text-sm bg-black/25 px-2.5 py-0.5 rounded-md text-white border border-white/20 flex items-center gap-2">
              {code}
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-white/70 hover:text-white transition-colors"
                title="Copy Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Currency</span>
              <div className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                <span>{getCurrencyFlag(currency)}</span>
                <span>{currency}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Current Balance</span>
              <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {currency} {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Opening Balance</span>
              <div className="text-sm font-black font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                {currency} {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Manual Ref / A/C</span>
              <div className="text-sm font-black font-mono text-slate-700 dark:text-slate-300 truncate mt-0.5">
                {manualRef}
              </div>
            </div>
          </div>

          {/* Section 1: Classification & Branch */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Organization & Classification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Company Name:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Branch:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Account Kind:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{kind}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Country / Region:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">United Arab Emirates</span>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Tax Information */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Contact & Tax Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Phone / Mobile:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">WhatsApp:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{whatsapp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Trade License:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{license}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">GST / TRN No:</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{trn}</span>
              </div>
              <div className="sm:col-span-2 flex items-start gap-1">
                <span className="text-slate-400 font-medium shrink-0">Address:</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <a
            href={`/dashboard/accounting/ledger?q=${encodeURIComponent(code)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Full Ledger
          </a>

          <Button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 h-8 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
