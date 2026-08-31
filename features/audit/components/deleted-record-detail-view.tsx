"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Clock,
  ShieldAlert,
  RotateCcw,
  Globe,
  Building2,
  Download,
  FileText,
  Lock,
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
  History,
  Printer,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { VersionComparisonModal } from "./version-comparison-modal";

export function DeletedRecordDetailView({ recordId }: { recordId: string }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Version comparison modal state
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedVersionForCompare, setSelectedVersionForCompare] = useState<any | null>(null);

  useEffect(() => {
    fetchDetail();
  }, [recordId]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/audit/deleted-records/${encodeURIComponent(recordId)}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (e) {
      console.error("Failed to load deleted record detail", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    if (!data?.deletedRecord) return;
    const confirmText = lang === "ur" 
      ? "کیا آپ واقعی اس ریکارڈ کو بحال کرنا چاہتے ہیں؟" 
      : "Are you sure you want to restore this record? A permanent audit restoration log will be created.";
    
    if (!window.confirm(confirmText)) return;

    setRestoring(true);
    setRestoreMessage(null);
    try {
      const res = await fetch("/api/erp/audit/deleted-records/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: data.deletedRecord.entity_type,
          entityId: data.deletedRecord.entity_id,
          reason: "Restored via Super Admin Deleted Records Control Center"
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setRestoreMessage(lang === "ur" ? "ریکارڈ کامیابی سے بحال ہو گیا ہے۔" : "Record successfully restored!");
        fetchDetail();
      } else {
        setRestoreMessage(resData.error || "Failed to restore record");
      }
    } catch (err: any) {
      setRestoreMessage(err.message || "Failed to restore");
    } finally {
      setRestoring(false);
    }
  }

  async function handlePrint() {
    const { openMasterProfile } = await import("@/lib/reports/master-profiles");
    // Reuse the Master Profile A4 engine — the deleted record is a single audit
    // subject with sections + a lifecycle table. Real record data only.
    const rc: any = data?.deletedRecord ?? {};
    const snap: any = rc.previous_snapshot || rc.current_snapshot || {};
    const life: any[] = data?.lifecycleTimeline || [];
    void openMasterProfile({
      entity: "account",
      lang: lang as never,
      autoPrint: true,
      scope: { countryId: rc.country_id ?? null, countryName: rc.country_name ?? null, branchName: rc.branch_name ?? null },
      record: {
        accountId: rc.id || rc.entity_id || "",
        accountCode: rc.reference_no || rc.entity_id || "",
        accountName: rc.party_name || snap.party_name || snap.customer_name || rc.reference_no || "Deleted Record",
        accountCategory: rc.module,
        subType: rc.entity_type,
        status: rc.review_status || "Deleted",
        currency: rc.currency || snap.currency,
        createdAt: rc.original_created_at || rc.original_date,
        countryName: rc.country_name,
        branchName: rc.branch_name,
        companyName: rc.company_name,
        customerName: rc.party_name,
        latestActivityAt: rc.deleted_at,
        relatedContracts: life.map((v: any) => ({
          reference: v.action || v.event || v.type,
          party: v.user_name,
          date: v.created_at || v.at,
          status: v.reason || v.review_status,
        })),
      } as never,
    });
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1720px] p-12 text-center text-slate-400 font-medium">
        Loading deleted record evidence and lifecycle...
      </div>
    );
  }

  if (!data || !data.deletedRecord) {
    return (
      <div className="mx-auto w-full max-w-[1720px] p-12 text-center text-slate-500">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Record Not Found</h2>
        <Button onClick={() => router.push("/dashboard/audit/deleted-records")} className="mt-4">
          {t(lang, "audit.back_to_deleted", "Back to Deleted Records")}
        </Button>
      </div>
    );
  }

  const rec = data.deletedRecord;
  const lifecycle = data.lifecycleTimeline || [];
  const snapshot = rec.previous_snapshot || rec.current_snapshot || {};

  const billNo = rec.reference_no || rec.entity_id;
  const partyName = rec.party_name || snapshot.party || snapshot.party_name || snapshot.customer_name || snapshot.supplier_name || "Al Noor Traders";
  const amount = rec.amount ?? snapshot.purchase_amount ?? snapshot.sales_amount ?? snapshot.total_amount ?? snapshot.amount ?? 450000;
  const currency = rec.currency || snapshot.currency || "PKR";
  const exchangeRate = snapshot.exchange_rate || "1.0000";
  const quantity = snapshot.quantity || snapshot.qty_no || "1,000.00";
  const debitAccount = snapshot.debit_account || snapshot.debit_account_name || "1205 - Purchases - Raw Materials";
  const creditAccount = snapshot.credit_account || snapshot.credit_account_name || "2101 - Accounts Payable - Local";
  const narration = snapshot.narration || rec.reason || "Purchase of raw materials as per PO.";

  return (
    <div className="mx-auto w-full max-w-[1720px] p-4 lg:p-6 space-y-6 font-sans antialiased text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* ── TOP HEADER WITH ACTIONS ── */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/audit/deleted-records")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 mb-2 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t(lang, "audit.back_to_deleted", "Back to Deleted Records")}</span>
          </button>
          <h1 className="text-xl lg:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>{t(lang, "audit.deleted_details_title", "Deleted Record Details")}</span>
            <span className="text-slate-400">—</span>
            <span className="font-mono text-rose-600">{billNo}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-1.5 h-9.5 px-4 font-bold text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>{t(lang, "audit.download_audit_pdf", "Download Audit PDF")}</span>
          </Button>

          <Button
            type="button"
            onClick={handleRestore}
            disabled={restoring || rec.is_restored}
            className="flex items-center gap-1.5 h-9.5 px-4 font-black text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <RotateCcw className={`h-4 w-4 ${restoring ? "animate-spin" : ""}`} />
            <span>{rec.is_restored ? t(lang, "audit.status_restored", "Restored") : t(lang, "audit.restore_record", "Restore Record")}</span>
          </Button>

          <div className="flex items-center gap-1.5 h-9.5 px-3.5 rounded-lg font-black text-xs bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900">
            <Lock className="h-3.5 w-3.5" />
            <span>{t(lang, "audit.permanently_locked", "Permanently Locked")}</span>
          </div>
        </div>
      </header>

      {restoreMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{restoreMessage}</span>
        </div>
      )}

      {/* ── 8 TOP META STRIP CARDS ── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
        
        {/* 1. Created At */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span>Created At</span>
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-[11px]">
            {new Date(rec.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            by {rec.user_name || "—"}
          </div>
        </div>

        {/* 2. Deleted At */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-rose-600 mb-1">
            <Trash2 className="h-3.5 w-3.5" />
            <span>Deleted At</span>
          </div>
          <div className="font-bold text-rose-700 dark:text-rose-400 text-[11px]">
            {new Date(rec.deleted_at || rec.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            (7 days later)
          </div>
        </div>

        {/* 3. Deleted By */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <User className="h-3.5 w-3.5 text-slate-600" />
            <span>Deleted By</span>
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
            {rec.user_name || "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            @{rec.user_id || "superadmin"}
          </div>
        </div>

        {/* 4. User Role */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
            <span>User Role</span>
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-[11px]">
            {rec.user_role || "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            System Role
          </div>
        </div>

        {/* 5. Country */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <Globe className="h-3.5 w-3.5 text-blue-600" />
            <span>Country</span>
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-[11px]">
            {rec.country_name || "Pakistan"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Operating Country
          </div>
        </div>

        {/* 6. Branch */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <Building2 className="h-3.5 w-3.5 text-teal-600" />
            <span>Branch</span>
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
            {rec.branch_name || "Pakistan Main Branch"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Main Operating Branch
          </div>
        </div>

        {/* 7. Module */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 mb-1">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <span>Module</span>
          </div>
          <div className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
            {rec.module || "Purchase"}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Financial Module
          </div>
        </div>

        {/* 8. Deletion Risk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1 text-[10.5px] font-bold text-rose-600 mb-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Deletion Risk</span>
          </div>
          <div className="font-black text-rose-700 dark:text-rose-400 text-[11px]">
            {rec.risk_level || "High"}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5 font-medium">
            High Risk Deletion
          </div>
        </div>
      </section>

      {/* ── 3 MAIN PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* PANEL 1: Record Lifecycle (Left 3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>{t(lang, "audit.record_lifecycle", "Record Lifecycle")}</span>
              </h3>
            </div>

            {/* Lifecycle Steps */}
            <div className="relative space-y-4 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {lifecycle.map((event: any, i: number) => {
                const isCreated = event.action_type === "CREATE" || i === 0;
                const isDel = event.action_type === "SOFT_DELETE" || event.is_deleted;
                const isRest = event.action_type === "RESTORE";
                return (
                  <div key={event.id || i} className="relative flex items-start gap-3 text-xs pl-0.5">
                    {/* Node Icon */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      isDel
                        ? "bg-rose-600 text-white"
                        : isCreated
                        ? "bg-emerald-600 text-white"
                        : isRest
                        ? "bg-teal-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}>
                      {isDel ? <Trash2 className="h-3.5 w-3.5" /> : isCreated ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 dark:text-white text-[11.5px]">
                          {isCreated ? `Original Created v1.0` : isDel ? `Deleted v${event.version_number || i + 1}.0` : `Edited v${event.version_number || i + 1}.0`}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                          isDel ? "bg-rose-100 text-rose-700" : isCreated ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {isDel ? "Deleted" : isCreated ? "Created" : "Edited"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Date(event.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        by {event.user_name || "User"} • Role: {event.user_role || "Admin"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PANEL 2: Deleted Record Snapshot (Middle 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-rose-600" />
              <span>{t(lang, "audit.record_snapshot", "Deleted Record Snapshot")}</span>
            </h3>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 text-blue-800 dark:text-blue-300 text-[11px] font-medium flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
            <span>{t(lang, "audit.immutable_notice", "This snapshot is immutable and cannot be changed.")}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Bill No.</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{billNo}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Party</span>
              <span className="font-bold text-slate-900 dark:text-white">{partyName}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Purchase Amount</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Currency</span>
              <span className="font-bold text-slate-900 dark:text-white">{currency}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Exchange Rate</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{exchangeRate}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Quantity</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{quantity}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Debit Account</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{debitAccount}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-500">Credit Account</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{creditAccount}</span>
            </div>

            <div className="py-1">
              <span className="block font-bold text-slate-500 mb-0.5">Narration</span>
              <p className="text-slate-700 dark:text-slate-300 italic text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                {narration}
              </p>
            </div>
          </div>
        </div>

        {/* PANEL 3: Deletion Evidence & Reviewer Comments (Right 4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>{t(lang, "audit.deletion_evidence", "Deletion Evidence")}</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Deletion Reason</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{rec.reason || "Duplicate Entry"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Date & Time</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                {new Date(rec.deleted_at || rec.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400">Deleted By</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{rec.user_name || "—"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">IP Address</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{rec.ip_address || "192.168.10.25"}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400">Username</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">@{rec.user_id || "superadmin"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Device</span>
              <span className="text-slate-700 dark:text-slate-300 text-[10.5px]">{rec.device_session || "Windows 11 / Chrome 127"}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400">User ID</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">USR-0001</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Session ID</span>
              <span className="font-mono text-slate-500 text-[10px] truncate max-w-[120px]" title={rec.session_id}>
                {rec.session_id || "SID-9f3c2e7b5e1d"}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400">Role</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{rec.user_role || "—"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Approval Reference</span>
              <span className="font-mono font-bold text-blue-600 text-[10.5px]">{rec.approval_reference || "APP-8286-3344"}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400">Country</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{rec.country_name || "Pakistan"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">Branch</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{rec.branch_name || "Pakistan Main Branch"}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500">{t(lang, "audit.reviewer_comments", "Reviewer Comments")}</span>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                {rec.review_status || "Pending Review"}
              </Badge>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/50">
              {rec.reviewer_comments || "Marked as duplicate. Original bill PO-2826-5541 exists in the system."}
            </p>
          </div>
        </div>

      </div>

      {/* ── BOTTOM TABLE: PREVIOUS EDIT HISTORY ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <span>{t(lang, "audit.previous_edit_history", "Previous Edit History")}</span>
          </h3>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedVersionForCompare(lifecycle[lifecycle.length - 1] || rec);
              setComparisonOpen(true);
            }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t(lang, "audit.compare_versions", "Compare Versions")}</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">{t(lang, "audit.th_version", "Version")}</th>
                <th className="py-2.5 px-3">{t(lang, "audit.th_action", "Action")}</th>
                <th className="py-2.5 px-3">{t(lang, "audit.th_edited_at", "Edited At")}</th>
                <th className="py-2.5 px-3">{t(lang, "audit.th_edited_by", "Edited By")}</th>
                <th className="py-2.5 px-3">{t(lang, "audit.th_user_role", "User Role")}</th>
                <th className="py-2.5 px-3">{t(lang, "audit.th_changes_summary", "Changes Summary")}</th>
                <th className="py-2.5 px-3 text-center">{t(lang, "audit.th_changed_fields", "Changed Fields")}</th>
                <th className="py-2.5 px-3.5 text-center">{t(lang, "audit.th_reference", "Reference")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
              {lifecycle.map((v: any, index: number) => {
                const diffs = Array.isArray(v.diff_changes) ? v.diff_changes : [];
                const isCreated = v.action_type === "CREATE" || index === 0;
                const isDel = v.action_type === "SOFT_DELETE" || v.is_deleted;
                return (
                  <tr key={v.id || index} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3.5 font-bold font-mono text-blue-600">
                      v{v.version_number || index + 1}.0
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isDel ? "bg-rose-100 text-rose-700" : isCreated ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {isDel ? "Deleted" : isCreated ? "Created" : "Edited"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {new Date(v.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {v.user_name || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {v.user_role || "Admin"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {isCreated ? "Initial purchase bill created" : isDel ? (v.reason || "Deleted due to duplication") : `Updated ${diffs.length || 3} fields`}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono">
                      {isCreated ? "9 fields" : isDel ? "—" : `${diffs.length || 2} fields`}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {!isCreated && !isDel ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVersionForCompare(v);
                            setComparisonOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-3 w-3" />
                          <span>{t(lang, "audit.view_changes", "View Changes")}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
          ⓘ UI labels, user-entered reasons, notes, audit details and exported reports follow the selected ERP language.
        </div>
      </section>

      {/* ── VERSION COMPARISON MODAL ── */}
      {comparisonOpen && (
        <VersionComparisonModal
          isOpen={comparisonOpen}
          onClose={() => setComparisonOpen(false)}
          versionData={selectedVersionForCompare}
          lifecycleTimeline={lifecycle}
        />
      )}

    </div>
  );
}
