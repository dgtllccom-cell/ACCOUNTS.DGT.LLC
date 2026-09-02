"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Truck,
  FileCheck2,
  Printer,
  Save,
  Bookmark,
  Plus,
  Trash2,
  UploadCloud,
  FileText,
  CheckCircle2,
  Calendar,
  Building,
  Building2,
  Globe,
  ShieldCheck,
  Search,
  Eye,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  Database,
  Pencil,
  FileDown
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QrCode as QrCodeGraphic } from "@/components/ui/qr-code";

export interface TransitDocument {
  id: string;
  name: string;
  size: string;
  type?: string;
}

export interface TransitEntryData {
  id?: string;
  super_agent: string;
  super_agent_name?: string;
  country: string;
  country_name?: string;
  branch: string;
  branch_name?: string;
  entry_serial: string;
  
  // Basic Info
  invoice_no: string;
  invoice_date: string;
  supplier_no: string;
  supplier_date: string;
  python_no: string;
  python_date: string;
  transit_no: string;
  transit_date: string;
  
  // Goods Info
  goods_name: string;
  quantity: number | string;
  unit: string;
  gross_weight: number | string;
  net_weight: number | string;
  price_per_unit: number | string;
  total_amount: number | string;
  
  // Parties
  created_by: string;
  delivered_to: string;
  
  // Companies
  export_company: string;
  import_company: string;
  notify_party: string;
  
  // Documents
  documents: TransitDocument[];
  
  // Notes
  notes: string;
  created_at?: string;
}

const DEFAULT_ENTRY: TransitEntryData = {
  super_agent: "",
  super_agent_name: "",
  country: "",
  country_name: "",
  branch: "",
  branch_name: "",
  entry_serial: "",

  invoice_no: "",
  invoice_date: "",
  supplier_no: "",
  supplier_date: "",
  python_no: "",
  python_date: "",
  transit_no: "",
  transit_date: "",

  goods_name: "",
  quantity: 0,
  unit: "",
  gross_weight: "",
  net_weight: "",
  price_per_unit: "",
  total_amount: "",

  created_by: "",
  delivered_to: "",

  export_company: "",
  import_company: "",
  notify_party: "",

  documents: [],
  notes: ""
};

export function TransitEntryManagementView({ lang: langProp = "en" }: { lang?: SupportedLanguage }) {
  const activeLang = useActiveLanguage();
  const lang = (activeLang && activeLang !== "en") ? activeLang : langProp;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const dir = isRtl ? "rtl" : "ltr";
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [formData, setFormData] = useState<TransitEntryData>(DEFAULT_ENTRY);
  const [activeTab, setActiveTab] = useState<"form" | "report" | "split" | "list">("split");
  const [savedEntries, setSavedEntries] = useState<TransitEntryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dataSource, setDataSource] = useState<string>("database");
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto calculate total amount
  const calculatedTotal = useMemo(() => {
    const qty = parseFloat(String(formData.quantity).replace(/,/g, "")) || 0;
    const price = parseFloat(String(formData.price_per_unit).replace(/,/g, "")) || 0;
    const total = qty * price;
    return total ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
  }, [formData.quantity, formData.price_per_unit]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      total_amount: calculatedTotal
    }));
  }, [calculatedTotal]);

  // Load existing records from backend API & Database
  async function loadRecords() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/clearing-agent/transit-entry");
      const json = await res.json();
      if (json.success && json.data) {
        setSavedEntries(json.data);
        if (json.source) setDataSource(json.source);
      }
    } catch (err) {
      console.error("Failed to load records:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const showNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (field: keyof TransitEntryData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newDocs: TransitDocument[] = files.map((file) => ({
        id: "doc-" + Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        type: file.type
      }));
      setFormData((prev) => ({
        ...prev,
        documents: [...prev.documents, ...newDocs]
      }));
      showNotification(`${files.length} ${tt("transit.docs_uploaded", "document(s) uploaded successfully!")}`);
    }
  };

  const handleDeleteDocument = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc.id !== id)
    }));
    showNotification(tt("transit.doc_removed", "Document removed"), "info");
  };

  const handleSaveEntry = async () => {
    if (!formData.goods_name?.trim()) {
      showNotification(tt("transit.err_goods_name", "Please enter Goods Name"), "error");
      return;
    }
    if (!formData.invoice_no?.trim()) {
      showNotification(tt("transit.err_invoice_no", "Please enter Invoice Number"), "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/erp/clearing-agent/transit-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`${tt("transit.entry_saved_prefix", "Transit Entry")} ${json.data.entry_serial} ${tt("transit.entry_saved_suffix", "saved to ERP Database!")}`);
        await loadRecords();
      } else {
        throw new Error(json.error || "Failed to save");
      }
    } catch (err: any) {
      showNotification(err.message || tt("transit.err_save", "Error saving transit entry"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (serial: string, id?: string) => {
    if (!confirm(`${tt("transit.delete_entry_confirm", "Are you sure you want to delete transit entry")} ${serial}?`)) return;
    try {
      const queryParam = id ? `id=${id}` : `serial=${encodeURIComponent(serial)}`;
      const res = await fetch(`/api/erp/clearing-agent/transit-entry?${queryParam}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`${tt("transit.entry_saved_prefix", "Transit entry")} ${serial} ${tt("transit.entry_deleted_suffix", "deleted successfully")}`, "info");
        await loadRecords();
      } else {
        throw new Error(json.error || "Failed to delete");
      }
    } catch (err: any) {
      showNotification(err.message || tt("transit.err_delete", "Error deleting entry"), "error");
    }
  };

  const handleSaveDraft = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("transit_entry_draft", JSON.stringify(formData));
      showNotification(tt("transit.draft_saved", "Draft saved to browser storage!"), "info");
    }
  };

  const handleNewEntry = () => {
    const randomSerial = "TE-" + String(Math.floor(1000000 + Math.random() * 9000000)).substring(0, 7);
    setFormData({
      ...DEFAULT_ENTRY,
      entry_serial: randomSerial,
      invoice_no: "INV-2026-" + String(Math.floor(100000 + Math.random() * 900000)),
      documents: []
    });
    showNotification(`${tt("transit.new_initialized", "New Transit Entry initialized")} (${randomSerial})`, "info");
  };

  const handlePrint = async () => {
    const { printDomFragmentViaModal } = await import("@/lib/reports/print-dom-fragment");
    if (!printDomFragmentViaModal("printable-transit-report", tt("transit.print_title", "Transit Entry"), { lang })) {
      window.print();
    }
  };

  const qrPayload = useMemo(() => {
    return `TRANSIT-ENTRY|${formData.entry_serial}|${formData.invoice_no}|${formData.goods_name}|QTY:${formData.quantity} ${formData.unit}|${formData.country}|${formData.branch}`;
  }, [formData]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedEntries;
    return savedEntries.filter(
      (e) =>
        e.entry_serial?.toLowerCase().includes(q) ||
        e.invoice_no?.toLowerCase().includes(q) ||
        e.goods_name?.toLowerCase().includes(q) ||
        e.export_company?.toLowerCase().includes(q) ||
        e.import_company?.toLowerCase().includes(q)
    );
  }, [savedEntries, searchQuery]);

  return (
    <div dir={dir} className="w-full space-y-4 pb-12">
      {/* Printable CSS Hook */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-transit-report, #printable-transit-report * {
            visibility: visible;
          }
          #printable-transit-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Notification Toast */}
      {notification && (
        <div
          className={cn(
            "fixed top-16 end-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4",
            notification.type === "success" && "bg-emerald-600 text-white shadow-emerald-600/30",
            notification.type === "error" && "bg-rose-600 text-white shadow-rose-600/30",
            notification.type === "info" && "bg-blue-600 text-white shadow-blue-600/30"
          )}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="ms-2 opacity-80 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Controls / Switcher Bar */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-foreground sm:text-lg flex items-center gap-2">
              {tt("transit.title", "TRANSIT ENTRY")}
              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-500" />
                {tt("transit.db_active", "DB ACTIVE")}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">{tt("transit.subtitle", "Create / Manage Transit Entries & Public Verification Reports")}</p>
          </div>
        </div>

        {/* View Mode Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("split")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "split" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tt("transit.split_view", "Split View")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "form" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{tt("transit.form_view", "Form View")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("report")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "report" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>{tt("transit.public_check", "Public Check")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "list" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span>{tt("transit.entries_tab", "Entries")} ({savedEntries.length})</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNewEntry}
            className="h-9 gap-1.5 rounded-xl font-bold cursor-pointer"
          >
            <Plus className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">{tt("transit.new_entry", "New Entry")}</span>
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            className="h-9 gap-1.5 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>{tt("transit.print_a4", "Print A4")}</span>
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className={cn(
        "grid gap-6 transition-all duration-300",
        activeTab === "split" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
      )}>
        
        {/* =========================================================================
            LEFT PANEL: TRANSIT ENTRY FORM (Create / Manage Transit Entries)
           ========================================================================= */}
        {(activeTab === "form" || activeTab === "split") && (
          <div className="no-print flex flex-col rounded-2xl border border-border bg-card shadow-md overflow-hidden">
            {/* Header with Title & Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e40af] px-4 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-xs">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-wide sm:text-base">{tt("transit.title", "TRANSIT ENTRY")}</h2>
                  <p className="text-[11px] text-blue-100/90 font-medium">{tt("transit.form_subtitle", "Create / Manage Transit Entries")}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{tt("trk.save_draft", "Save Draft")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab((curr) => (curr as string) === "report" ? "split" : "report")}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{tt("transit.print_preview", "Print Preview")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEntry}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 px-3.5 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{tt("transit.save_entry", "Save Entry")}</span>
                </button>
              </div>
            </div>

            {/* Form Body with standard blue uppercase section labels */}
            <div className="space-y-6 p-4 sm:p-6 text-foreground">
              
              {/* SECTION 1: SERIAL NUMBERS (System) */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80 flex items-center gap-1.5">
                  {tt("transit.sec_serial_numbers", "SERIAL NUMBERS (System)")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">1. {tt("transit.lbl_super_agent", "Super Agent")}</label>
                    <select
                      value={formData.super_agent}
                      onChange={(e) => handleInputChange("super_agent", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="SA-0001">SA-0001</option>
                      <option value="SA-0002">SA-0002 - Global Logistics</option>
                      <option value="SA-0003">SA-0003 - Apex Transit</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">2. {tt("common.country", "Country")}</label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="PK - Pakistan">PK - Pakistan</option>
                      <option value="AF - Afghanistan">AF - Afghanistan</option>
                      <option value="AE - UAE">AE - UAE</option>
                      <option value="IR - Iran">IR - Iran</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">3. {tt("common.branch", "Branch")}</label>
                    <select
                      value={formData.branch}
                      onChange={(e) => handleInputChange("branch", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="CHM - Chaman">CHM - Chaman</option>
                      <option value="TKM - Torkham">TKM - Torkham</option>
                      <option value="KHI - Karachi Port">KHI - Karachi Port</option>
                      <option value="QTA - Quetta">QTA - Quetta</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">4. {tt("transit.lbl_entry_serial", "Entry Serial")}</label>
                    <input
                      type="text"
                      value={formData.entry_serial}
                      onChange={(e) => handleInputChange("entry_serial", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: BASIC INFORMATION */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80">
                  {tt("transit.sec_basic_info", "BASIC INFORMATION")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_invoice_number", "Invoice Number")}</label>
                    <input
                      type="text"
                      value={formData.invoice_no}
                      onChange={(e) => handleInputChange("invoice_no", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="INV-2024-000567"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_invoice_date", "Invoice Date")}</label>
                    <input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => handleInputChange("invoice_date", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_supplier_number", "Supplier Number")}</label>
                    <input
                      type="text"
                      value={formData.supplier_no}
                      onChange={(e) => handleInputChange("supplier_no", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="SUP-000789"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_supplier_date", "Supplier Date")}</label>
                    <input
                      type="date"
                      value={formData.supplier_date}
                      onChange={(e) => handleInputChange("supplier_date", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_python_number", "Python Number")}</label>
                    <input
                      type="text"
                      value={formData.python_no}
                      onChange={(e) => handleInputChange("python_no", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="PYT-001234"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_python_date", "Python Date")}</label>
                    <input
                      type="date"
                      value={formData.python_date}
                      onChange={(e) => handleInputChange("python_date", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_transit_number", "Transit Number")}</label>
                    <input
                      type="text"
                      value={formData.transit_no}
                      onChange={(e) => handleInputChange("transit_no", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="TRN-009876"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_transit_date", "Transit Date")}</label>
                    <input
                      type="date"
                      value={formData.transit_date}
                      onChange={(e) => handleInputChange("transit_date", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: GOODS INFORMATION */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80">
                  {tt("transit.sec_goods_info", "GOODS INFORMATION")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_goods_name", "Goods Name")}</label>
                    <input
                      type="text"
                      value={formData.goods_name}
                      onChange={(e) => handleInputChange("goods_name", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="LED TV 42 Inch"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_total_quantity", "Total Quantity")}</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange("quantity", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_quantity_unit", "Quantity Unit")}</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleInputChange("unit", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="CTN">{tt("transit.unit_cartons", "CTN (Cartons)")}</option>
                      <option value="KG">KG</option>
                      <option value="TONS">TONS</option>
                      <option value="SETS">SETS</option>
                      <option value="CONTAINERS">{tt("transit.unit_containers", "CONTAINERS")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("tl.gross_weight_kg", "Gross Weight (KG)")}</label>
                    <input
                      type="text"
                      value={formData.gross_weight}
                      onChange={(e) => handleInputChange("gross_weight", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="1,200.000"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_net_weight_kg", "Net Weight (KG)")}</label>
                    <input
                      type="text"
                      value={formData.net_weight}
                      onChange={(e) => handleInputChange("net_weight", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="1,050.000"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_price_per_unit", "Price (Per Unit)")}</label>
                    <input
                      type="text"
                      value={formData.price_per_unit}
                      onChange={(e) => handleInputChange("price_per_unit", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="25,000.00"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_total_amount_calc", "Total Amount (Calculated)")}</label>
                    <input
                      type="text"
                      value={formData.total_amount}
                      readOnly
                      className="w-full rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-2 text-xs font-black text-blue-700 dark:text-blue-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: PARTIES / PEOPLE */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80">
                  {tt("transit.sec_parties", "PARTIES / PEOPLE")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_created_by", "Created By (Maker Name)")}</label>
                    <input
                      type="text"
                      value={formData.created_by}
                      onChange={(e) => handleInputChange("created_by", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Ali Khan"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_delivered_to", "Delivered To (Handed By)")}</label>
                    <input
                      type="text"
                      value={formData.delivered_to}
                      onChange={(e) => handleInputChange("delivered_to", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Ahmed Shah"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: COMPANIES & NOTIFY PARTY */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80">
                  {tt("transit.sec_companies", "COMPANIES & NOTIFY PARTY")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_export_company", "Export Company Name")}</label>
                    <input
                      type="text"
                      value={formData.export_company}
                      onChange={(e) => handleInputChange("export_company", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="ABC Exporters Ltd."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_import_company", "Import Company Name")}</label>
                    <input
                      type="text"
                      value={formData.import_company}
                      onChange={(e) => handleInputChange("import_company", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="XYZ Importers Pvt. Ltd."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">{tt("transit.lbl_notify_party", "Notify Party")}</label>
                    <input
                      type="text"
                      value={formData.notify_party}
                      onChange={(e) => handleInputChange("notify_party", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="M/S Bright Traders, Karachi"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: DOCUMENTS ATTACHED */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-3 pb-1 border-b border-border/80">
                  {tt("transit.sec_documents", "DOCUMENTS ATTACHED")}
                </h3>

                {/* Documents Table */}
                {formData.documents.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-3 py-2">{tt("transit.col_file_name", "File Name")}</th>
                          <th className="px-3 py-2 text-center w-28">{tt("transit.col_size", "Size")}</th>
                          <th className="px-3 py-2 text-center w-20">{tt("common.actions", "Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formData.documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 font-medium flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{doc.name}</span>
                            </td>
                            <td className="px-3 py-2 text-center text-muted-foreground font-mono text-[11px]">{doc.size}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                                title={tt("common.delete", "Delete document")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Upload Dropzone */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 p-6 text-center transition-colors cursor-pointer group"
                >
                  <UploadCloud className="h-8 w-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-foreground">
                    {tt("transit.upload_hint", "Drag & Drop files here or")} <span className="text-blue-600 dark:text-blue-400 underline">{tt("transit.click_browse", "Click to Browse")}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{tt("transit.upload_formats", "(PDF, JPG, PNG – Max 5MB each)")}</p>
                </div>
              </div>

              {/* SECTION 7: NOTES (Optional) */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1e40af] dark:text-blue-400 mb-2 pb-1 border-b border-border/80">
                  {tt("transit.sec_notes", "NOTES")} <span className="text-[10px] lowercase text-muted-foreground font-normal">{tt("transit.notes_optional", "(Optional)")}</span>
                </h3>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={tt("transit.notes_ph", "Enter notes here...")}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/20 px-6 py-3 text-center text-[11px] text-muted-foreground font-medium">
              {tt("transit.footer_copy", "© 2025 Transit Management System. All Rights Reserved.")}
            </div>
          </div>
        )}

        {/* =========================================================================
            RIGHT PANEL: TRANSIT ENTRY REPORT (PUBLIC CHECK / A4 Printable Document)
           ========================================================================= */}
        {(activeTab === "report" || activeTab === "split") && (
          <div
            id="printable-transit-report"
            className="flex flex-col rounded-2xl border border-border bg-white text-slate-900 shadow-md p-6 sm:p-8 font-sans max-w-4xl mx-auto w-full"
          >
            {/* Report Header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md">
                  <Globe className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                    {tt("transit.report_title", "TRANSIT ENTRY REPORT")}
                  </h2>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600 mt-0.5">
                    {tt("transit.public_check_report", "PUBLIC CHECK")}
                  </p>
                </div>
              </div>

              {/* Live QR Code with verify link */}
              <div className="text-center shrink-0">
                <div className="p-1 border border-slate-200 rounded-lg bg-white inline-block shadow-xs">
                  <QrCodeGraphic
                    value={qrPayload}
                    size={80}
                    className="h-16 w-16 sm:h-20 sm:w-20"
                  />
                </div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1">{tt("transit.scan_to_verify", "Scan to Verify")}</p>
              </div>
            </div>

            {/* Serial Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{tt("transit.lbl_super_agent", "Super Agent")}</span>
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{formData.super_agent}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{tt("common.country", "Country")}</span>
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{formData.country.split("-")[1]?.trim() || formData.country}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{tt("common.branch", "Branch")}</span>
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{formData.branch.split("-")[1]?.trim() || formData.branch}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{tt("transit.lbl_entry_serial", "Entry Serial")}</span>
                <span className="font-black text-red-600 text-xs sm:text-sm">{formData.entry_serial}</span>
              </div>
            </div>

            {/* BASIC INFORMATION SECTION */}
            <div className="py-4 border-b border-slate-200 text-xs space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                {tt("transit.sec_basic_info", "BASIC INFORMATION")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_invoice_number", "Invoice Number")}</span>
                  <span className="font-bold text-slate-900">: {formData.invoice_no}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_invoice_date", "Invoice Date")}</span>
                  <span className="font-bold text-slate-900">: {formData.invoice_date}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_supplier_number", "Supplier Number")}</span>
                  <span className="font-bold text-slate-900">: {formData.supplier_no}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_supplier_date", "Supplier Date")}</span>
                  <span className="font-bold text-slate-900">: {formData.supplier_date}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_python_number", "Python Number")}</span>
                  <span className="font-bold text-slate-900">: {formData.python_no}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_python_date", "Python Date")}</span>
                  <span className="font-bold text-slate-900">: {formData.python_date}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_transit_number", "Transit Number")}</span>
                  <span className="font-bold text-slate-900">: {formData.transit_no}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_transit_date", "Transit Date")}</span>
                  <span className="font-bold text-slate-900">: {formData.transit_date}</span>
                </div>
              </div>
            </div>

            {/* GOODS INFORMATION SECTION */}
            <div className="py-4 border-b border-slate-200 text-xs space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                {tt("transit.sec_goods_info", "GOODS INFORMATION")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_goods_name", "Goods Name")}</span>
                  <span className="font-bold text-slate-900">: {formData.goods_name}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_total_quantity", "Total Quantity")}</span>
                  <span className="font-bold text-slate-900">: {formData.quantity} {formData.unit}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("tl.gross_weight_kg", "Gross Weight (KG)")}</span>
                  <span className="font-bold text-slate-900">: {formData.gross_weight}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_net_weight_kg", "Net Weight (KG)")}</span>
                  <span className="font-bold text-slate-900">: {formData.net_weight}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.lbl_price_per_unit", "Price (Per Unit)")}</span>
                  <span className="font-bold text-slate-900">: {formData.price_per_unit}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-32 text-slate-600 font-semibold">{tt("transit.col_total_amount", "Total Amount")}</span>
                  <span className="font-black text-blue-700">: {formData.total_amount}</span>
                </div>
              </div>
            </div>

            {/* PARTIES / PEOPLE SECTION */}
            <div className="py-4 border-b border-slate-200 text-xs space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                {tt("transit.sec_parties", "PARTIES / PEOPLE")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-36 text-slate-600 font-semibold">{tt("transit.lbl_created_by", "Created By (Maker Name)")}</span>
                  <span className="font-bold text-slate-900">: {formData.created_by}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-36 text-slate-600 font-semibold">{tt("transit.lbl_delivered_to", "Delivered To (Handed By)")}</span>
                  <span className="font-bold text-slate-900">: {formData.delivered_to}</span>
                </div>
              </div>
            </div>

            {/* COMPANIES & NOTIFY PARTY SECTION */}
            <div className="py-4 border-b border-slate-200 text-xs space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                {tt("transit.sec_companies", "COMPANIES & NOTIFY PARTY")}
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-36 text-slate-600 font-semibold">{tt("transit.lbl_export_company", "Export Company Name")}</span>
                  <span className="font-bold text-slate-900">: {formData.export_company}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-36 text-slate-600 font-semibold">{tt("transit.lbl_import_company", "Import Company Name")}</span>
                  <span className="font-bold text-slate-900">: {formData.import_company}</span>
                </div>
                <div className="flex justify-between sm:justify-start gap-4">
                  <span className="w-36 text-slate-600 font-semibold">{tt("transit.lbl_notify_party", "Notify Party")}</span>
                  <span className="font-bold text-slate-900">: {formData.notify_party}</span>
                </div>
              </div>
            </div>

            {/* DOCUMENTS ATTACHED SECTION */}
            <div className="py-4 border-b border-slate-200 text-xs space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                {tt("transit.sec_documents", "DOCUMENTS ATTACHED")}
              </h4>
              {formData.documents.length > 0 ? (
                <div className="space-y-1 text-xs">
                  {formData.documents.map((doc, idx) => (
                    <div key={doc.id} className="flex items-center justify-between font-medium text-slate-700">
                      <span>{idx + 1}. {doc.name}</span>
                      <span className="text-slate-500 font-mono text-[11px]">({doc.size})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">{tt("transit.no_docs_attached", "No documents attached.")}</p>
              )}
            </div>

            {/* SIGNATURES SECTION */}
            <div className="pt-8 pb-4">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <p className="font-black text-slate-900 mb-8">{formData.created_by || "Maker"}</p>
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    {tt("vch.prepared_by", "Prepared By")}
                  </div>
                </div>

                <div>
                  <div className="h-10 mb-2" />
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    {tt("vch.checked_by", "Checked By")}
                  </div>
                </div>

                <div>
                  <div className="h-10 mb-2" />
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    {tt("vch.approved_by", "Approved By")}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Generation Footer */}
            <div className="mt-auto pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
              <p>{tt("transit.report_generated", "Report Generated On:")} {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="font-semibold italic">{tt("transit.sys_generated", "This is a system generated report.")}</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            ENTRIES REGISTRY LIST VIEW
           ========================================================================= */}
        {activeTab === "list" && (
          <div className="no-print rounded-2xl border border-border bg-card shadow-md p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <span>{tt("transit.registered_entries", "Registered Transit Entries")}</span>
                  {loading && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
                </h3>
                <p className="text-xs text-muted-foreground">{tt("transit.list_subtitle", "Search, edit and manage all recorded transit entries and database records")}</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tt("transit.search_ph", "Search serial, invoice, goods, company...")}
                    className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadRecords}
                  className="rounded-xl font-bold gap-1 cursor-pointer"
                  title={tt("common.refresh", "Refresh from database")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tt("common.refresh", "Refresh")}</span>
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">{tt("transit.col_entry_serial", "Entry Serial")}</th>
                    <th className="px-3 py-2.5">{tt("transit.col_invoice_transit", "Invoice / Transit No")}</th>
                    <th className="px-3 py-2.5">{tt("transit.col_goods_desc", "Goods Description")}</th>
                    <th className="px-3 py-2.5">{tt("common.quantity", "Quantity")}</th>
                    <th className="px-3 py-2.5">{tt("transit.col_total_amount", "Total Amount")}</th>
                    <th className="px-3 py-2.5">{tt("transit.col_export_import", "Export / Import Company")}</th>
                    <th className="px-3 py-2.5 text-center">{tt("common.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEntries.map((row) => (
                    <tr key={row.entry_serial} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-3 font-bold text-red-600 dark:text-red-400 font-mono">
                        {row.entry_serial}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        <div className="font-semibold text-foreground">{row.invoice_no}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{row.transit_no}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-foreground">
                        {row.goods_name}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground font-bold">
                        {row.quantity} {row.unit}
                      </td>
                      <td className="px-3 py-3 font-black text-blue-600 dark:text-blue-400">
                        {row.total_amount}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <div className="font-medium text-foreground">{row.export_company}</div>
                        <div className="text-[10px]">{row.import_company}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setFormData(row);
                              setActiveTab("split");
                              showNotification(`${tt("transit.loaded_entry", "Loaded entry:")} ${row.entry_serial}`, "info");
                            }}
                            className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {tt("common.view", "View")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setFormData(row);
                              setActiveTab("form");
                              showNotification(`${tt("transit.editing_entry", "Editing entry:")} ${row.entry_serial}`, "info");
                            }}
                            className="h-7 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            {tt("common.edit", "Edit")}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(row.entry_serial, row.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 transition-colors cursor-pointer"
                            title={tt("common.delete", "Delete entry")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">
                        {loading ? tt("transit.loading_entries", "Loading entries from database...") : tt("transit.no_entries_found", "No matching transit entries found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
