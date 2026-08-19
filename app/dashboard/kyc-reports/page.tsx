"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  Info,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";

type KycEntityType = "country_branch" | "city_branch" | "user_account" | "new_account";

type KycItem = {
  id: string;
  name: string;
  code?: string | null;
  type: KycEntityType;
  typeLabel: string;
  countryName: string;
  cityName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "incomplete" | "near_expiry" | "suspended" | "compliant";
  statusBadge: string;
  missingRequirements: string[];
  createdAt: string;
  graceTotalDays: number;
  daysRemaining: number;
  progressPercent: number;
  ownerName?: string | null;
  documentsCount: number;
  editUrl?: string;
  rawDetails: Record<string, any>;
};

type KycMetrics = {
  total: number;
  incomplete: number;
  nearExpiry: number;
  suspended: number;
  compliant: number;
};

const KYC_UI: Record<string, Record<SupportedLanguage, string>> = {
  title: {
    en: "KYC Reports & Master Record Audit Center",
    ur: "کے وائی سی رپورٹ اور ماسٹر ریکارڈ آڈٹ سینٹر",
    ar: "تقرير KYC ومركز تدقيق السجلات الرئيسية",
    fa: "گزارش KYC و مرکز حسابرسی پرونده‌های اصلی",
    ps: "د KYC راپور او د ماسټر ریکارډ د پلټنې مرکز"
  },
  subtitle: {
    en: "Live audit monitoring of missing profile fields, documents, and compliance grace period for Countries, Branches, Users & Fleet",
    ur: "ممالک، برانچز، صارفین اور گاڑیوں کے لیے ادھورے پروفائلز اور دستاویزات کا لائیو جائزہ",
    ar: "مراقبة التدقيق المباشر للحقول والمستندات المفقودة وفترة التوفيق للمؤسسات",
    fa: "پایش زنده مدارک و پرونده‌های ناقص برای کشورها، شعب، کاربران و ناوگان",
    ps: "د هیوادونو، څانګو، کاروونکو او موټرو لپاره د نیمګړو ریکارډونو ژوندۍ ارزونه"
  },
  totalTracked: {
    en: "Total Audited Entities",
    ur: "کل آڈٹ شدہ ریکارڈز",
    ar: "إجمالي السجلات المدققة",
    fa: "کل پرونده‌های آڈیت شده",
    ps: "ټول ارزیابي شوي ریکارډونه"
  },
  actionRequired: {
    en: "Incomplete (Red Alert)",
    ur: "غیر مکمل (سرخ الرٹ)",
    ar: "غير مكتمل (تنبيه أحمر)",
    fa: "ناقص (هشدار قرمز)",
    ps: "نیمګړی (سور خبرداری)"
  },
  nearExpiry: {
    en: "Near Expiry / Overdue",
    ur: "مہلت ختم ہونے کے قریب",
    ar: "قريب من الانتهاء",
    fa: "نزدیک به انقضا",
    ps: "د مودي پای ته نږدې"
  },
  compliant: {
    en: "Compliant & Verified",
    ur: "مکمل اور تصدیق شدہ",
    ar: "متوافق وموثق",
    fa: "کامل و تایید شده",
    ps: "بشپړ او تایید شوی"
  },
  completeNow: {
    en: "+ Upload / Complete Profile",
    ur: "+ پروفائل مکمل کریں",
    ar: "+ إكمال الملف",
    fa: "+ تکمیل پرونده",
    ps: "+ پروفایل بشپړ کړئ"
  }
};

export default function KycReportsPage() {
  const [activeLang, setActiveLang] = useState<SupportedLanguage>("en");
  const dir = getLanguageDirection(activeLang);

  const [items, setItems] = useState<KycItem[]>([]);
  const [metrics, setMetrics] = useState<KycMetrics>({
    total: 0,
    incomplete: 0,
    nearExpiry: 0,
    suspended: 0,
    compliant: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [message, setMessage] = useState("");

  // Modal state for Uploading & Completing KYC
  const [activeItem, setActiveItem] = useState<KycItem | null>(null);
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [docList, setDocList] = useState<string[]>([]);
  const [savingKyc, setSavingKyc] = useState(false);

  const tUI = (key: string) => KYC_UI[key]?.[activeLang] || KYC_UI[key]?.en || key;

  function handleSystemLanguageChange(code: SupportedLanguage) {
    setActiveLang(code);
    try {
      localStorage.setItem("erp_lang", code);
      document.cookie = `erp_lang=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new Event("erp_lang_changed"));
      window.location.reload();
    } catch (err) {
      console.error("Failed to change global system language:", err);
    }
  }

  async function fetchKycData() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/kyc/reports");
      const json = await res.json();
      if (res.ok && json.items) {
        setItems(json.items);
        setMetrics(json.metrics || { total: 0, incomplete: 0, nearExpiry: 0, suspended: 0, compliant: 0 });
      }
    } catch (err: any) {
      console.error("Failed to load KYC reports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_lang") as SupportedLanguage | null;
      if (stored && ["en", "ur", "ps", "ar", "fa"].includes(stored)) {
        setActiveLang(stored);
      } else {
        const match = document.cookie.match(/erp_lang=([^;]+)/);
        if (match && match[1] && ["en", "ur", "ps", "ar", "fa"].includes(match[1])) {
          setActiveLang(match[1] as SupportedLanguage);
        }
      }
    } catch {
      // ignore SSR errors
    }
    fetchKycData();
  }, []);

  function handleOpenKycModal(item: KycItem) {
    setActiveItem(item);
    setEditOwnerName(item.ownerName || item.rawDetails?.owner_name || "");
    setEditPhone(item.phone || item.rawDetails?.phone || "");
    setEditEmail(item.email || item.rawDetails?.email || "");
    setEditAddress(item.rawDetails?.address || "");
    setDocList(Array.isArray(item.rawDetails?.documents) ? item.rawDetails.documents : ["Official Trade License Copy.pdf", "NTN Tax Registration.pdf"]);
    setNewDocName("");
  }

  function handleAddDocument() {
    if (!newDocName.trim()) return;
    setDocList([...docList, newDocName.trim()]);
    setNewDocName("");
  }

  async function handleSaveKyc(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;

    setSavingKyc(true);
    setMessage("");

    try {
      const res = await fetch("/api/erp/kyc/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeItem.id,
          entityType: activeItem.type,
          action: "complete_kyc",
          ownerName: editOwnerName,
          phone: editPhone,
          email: editEmail,
          address: editAddress,
          documents: docList
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update KYC record");

      setMessage(`✅ KYC Records & Verification Documents updated successfully for "${activeItem.name}"!`);
      setActiveItem(null);
      await fetchKycData();
    } catch (err: any) {
      setMessage("❌ " + (err.message || "Failed to update KYC record"));
    } finally {
      setSavingKyc(false);
    }
  }

  function handleKycPrint() {
    const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);
    openJournalReportWindow({
      lang: activeLang,
      autoPrint: true,
      title: tt("nav.kyc_reports", "KYC Compliance Report"),
      subtitle: tt("jrn.roznamcha_journal", "Compliance Audit Report"),
      overviewLabel: tt("jrn.overview", "Report Overview"),
      scopeName: tt("nav.kyc_reports", "KYC Compliance Report"),
      reportIdPrefix: "KYC",
      reportIdValue: "audit",
      chips: [{ label: tt("jrn.entry_count", "Total Records"), value: String(filteredItems.length) }],
      kpis: [],
      columns: [
        { key: "sno", label: tt("rozrep.sno", "S.No") },
        { key: "code", label: tt("acct.account_code", "Code") },
        { key: "name", label: tt("acct.customer_name", "Name") },
        { key: "type", label: tt("acct.account_type", "Type") },
        { key: "country", label: tt("acct.country", "Country") },
        { key: "owner", label: tt("prof.owner_name", "Owner") },
        { key: "phone", label: tt("acct.phone", "Phone") },
        { key: "email", label: tt("acct.email", "Email") },
        { key: "status", label: tt("acct.status", "Status") }
      ],
      rows: (filteredItems as any[]).map((item, idx) => ({
        sno: String(idx + 1),
        code: item.code,
        name: item.name,
        type: item.typeLabel || item.type,
        country: item.countryName,
        owner: item.ownerName,
        phone: item.phone,
        email: item.email,
        status: item.status
      }))
    });
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.countryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || item.type === selectedType;
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div dir={dir} className="mx-auto max-w-[1600px] space-y-6 text-foreground p-4 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">
              Regulatory Compliance & Verification Center (5-Language Active)
            </p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            {tUI("title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            {tUI("subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 5-Language Switcher Pills */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-950">
            {[
              { code: "en", label: "US English" },
              { code: "ur", label: "اردو PK" },
              { code: "ps", label: "پښتو AF" },
              { code: "ar", label: "العربية AE" },
              { code: "fa", label: "فارسی IR" }
            ].map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSystemLanguageChange(l.code as SupportedLanguage)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  activeLang === l.code
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleKycPrint}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3 rounded-xl shadow-sm text-xs"
          >
            <RefreshCw className="h-4 w-4 mr-2 hidden" />
            {t(activeLang, "bankroz.print_pdf", "Print / PDF")}
          </Button>

          <Button
            onClick={fetchKycData}
            disabled={loading}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3 rounded-xl shadow-sm text-xs"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading ? "animate-spin text-rose-600" : "")} />
            Refresh KYC Matrix
          </Button>
        </div>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-sm",
          message.startsWith("✅")
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
        )}>
          <span>{message}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tUI("totalTracked")}</p>
              <p className="mt-1.5 text-2xl font-black text-foreground">{metrics.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Tracked across system databases</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{tUI("actionRequired")}</p>
              <p className="mt-1.5 text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.incomplete}</p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Missing required profile fields</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{tUI("nearExpiry")}</p>
              <p className="mt-1.5 text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.nearExpiry + metrics.suspended}</p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">&le; 5 Days before suspension</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{tUI("compliant")}</p>
              <p className="mt-1.5 text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.compliant}</p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">100% verified status</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-card border-border/60 p-4 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entity name, code, email, or country..."
              className="w-full bg-background border border-border/80 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-rose-500 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Entities" },
              { id: "country_branch", label: "Countries & Main Branches" },
              { id: "city_branch", label: "City Branch Nodes" },
              { id: "user_account", label: "Users & Staff" },
              { id: "new_account", label: "Commercial Accounts" }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedType === type.id
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Row */}
        <div className="flex items-center gap-2 border-t border-border/40 pt-3 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Filter Status:</span>
          {[
            { id: "all", label: "All Statuses" },
            { id: "incomplete", label: "Incomplete (Red Alert)" },
            { id: "near_expiry", label: "Near Expiry (< 5 Days)" },
            { id: "suspended", label: "Suspended / Overdue" },
            { id: "compliant", label: "Compliant & Verified" }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shrink-0 border",
                selectedStatus === st.id
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {st.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Main KYC Report Table */}
      <Card className="bg-card border-border/60 rounded-2xl overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              KYC Verification & Grace Period Audit Directory
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Showing {filteredItems.length} of {items.length} compliance audit records.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-foreground">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <Th className="px-5 py-3.5">Entity & Record Title</Th>
                <Th className="px-5 py-3.5">Type & Location</Th>
                <Th className="px-5 py-3.5">Missing Profile Requirements</Th>
                <Th className="px-5 py-3.5">Grace Period (15 Days)</Th>
                <Th className="px-5 py-3.5">Status</Th>
                <Th className="px-5 py-3.5 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-semibold">
                    Loading live KYC reports and compliance audit timers...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No KYC compliance records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground flex items-center gap-2">
                        {item.type === "country_branch" && <Globe2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                        {item.type === "city_branch" && <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                        {item.type === "user_account" && <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                        {item.type === "new_account" && <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                        <span>{item.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>Code: {item.code || "N/A"}</span>
                        {item.email && <span>&bull; {item.email}</span>}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-muted text-foreground border border-border/60">
                        {item.typeLabel}
                      </span>
                      <p className="text-[11px] font-semibold text-muted-foreground mt-1">{item.countryName}</p>
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      {item.missingRequirements.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.missingRequirements.map((req, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              ⚠ {req}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> All requirements verified
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 min-w-[160px]">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className={cn(
                          item.status === "compliant" ? "text-emerald-600 dark:text-emerald-400" :
                          item.status === "suspended" ? "text-rose-600 dark:text-rose-400" :
                          item.daysRemaining <= 5 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {item.status === "compliant" ? "Verified" : `${item.daysRemaining} Days Remaining`}
                        </span>
                        <span className="text-muted-foreground font-mono">{item.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            item.status === "compliant" ? "bg-emerald-500" :
                            item.status === "suspended" ? "bg-rose-600" :
                            item.daysRemaining <= 5 ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                          )}
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase border inline-flex items-center gap-1",
                        item.status === "compliant"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : item.status === "suspended"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 animate-pulse"
                          : item.status === "near_expiry"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      )}>
                        {item.statusBadge}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.editUrl && (
                          <Link href={item.editUrl as any}>
                            <Button
                              variant="outline"
                              className="h-8 px-2.5 text-[11px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <ExternalLink className="h-3 w-3 mr-1 text-slate-600 dark:text-slate-400" /> Direct Edit
                            </Button>
                          </Link>
                        )}
                        <Button
                          onClick={() => handleOpenKycModal(item)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-8 px-3 rounded-lg text-xs shadow-xs"
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" /> {tUI("completeNow")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interactive Modal for KYC Upload & Completion */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">KYC Verification Portal</span>
                <h3 className="text-base font-extrabold text-foreground">{activeItem.name}</h3>
              </div>
              <button onClick={() => setActiveItem(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKyc} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Registered Name / Title</Label>
                  <Input
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    placeholder="Owner or Entity Title"
                    className="bg-background text-xs h-9 rounded-lg mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Official Phone / WhatsApp</Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="bg-background text-xs h-9 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Official Email Address</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="official@company.dgt.llc"
                  className="bg-background text-xs h-9 rounded-lg mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Physical Address</Label>
                <Input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Official office street address, city, country"
                  className="bg-background text-xs h-9 rounded-lg mt-1"
                />
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Attached Compliance Documents</span>
                  <span className="text-[10px] text-muted-foreground">NTN, Trade License, CNIC/Passport</span>
                </Label>

                <div className="flex gap-2">
                  <Input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Doc name (e.g. Pakistan_NTN_Registration.pdf)"
                    className="bg-background text-xs h-9 rounded-lg flex-1"
                  />
                  <Button type="button" onClick={handleAddDocument} variant="outline" className="h-9 px-3 text-xs font-bold">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Doc
                  </Button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {docList.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40 text-xs">
                      <span className="font-mono text-[11px] text-foreground truncate">{doc}</span>
                      <button
                        type="button"
                        onClick={() => setDocList(docList.filter((_, i) => i !== idx))}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setActiveItem(null)} className="h-9 text-xs font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={savingKyc} className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 px-4 text-xs">
                  {savingKyc ? "Saving KYC Documents..." : "Save & Complete Verification"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
