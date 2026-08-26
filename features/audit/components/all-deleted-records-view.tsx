"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  RefreshCw,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingDown,
  TrendingUp,
  History,
  FileSpreadsheet,
  Printer,
  X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { downloadCsv } from "@/features/branches/components/branch-report-export";

interface DeletedRecordRow {
  id: string;
  entity_type: string;
  entity_id: string;
  reference_no?: string;
  module: string;
  version_number: number;
  party_name?: string;
  amount?: number;
  currency?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  country_id?: string;
  country_name?: string;
  city_branch_id?: string;
  branch_name?: string;
  reason?: string;
  risk_level: "High" | "Medium" | "Low";
  review_status: "Pending" | "Reviewed" | "Investigating";
  deleted_at: string;
  original_date?: string;
  previous_edit_count?: number;
  is_restored?: boolean;
}

export function AllDeletedRecordsView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();

  // Filters
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedDeletedBy, setSelectedDeletedBy] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Data & Pagination
  const [records, setRecords] = useState<DeletedRecordRow[]>([]);
  const [kpis, setKpis] = useState({
    deletedToday: 308,
    pendingReview: 156,
    highRiskDeletions: 42,
    restoredRecords: 77,
    totalCountries: 5,
    totalBranches: 9
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);

  // Dynamic dropdown options
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [currentPage, pageSize, selectedCountry, selectedBranch, selectedModule, selectedRisk, selectedStatus]);

  async function fetchFilterOptions() {
    try {
      const [cRes, bRes] = await Promise.allSettled([
        fetch("/api/erp/locations/countries").then(r => r.json()),
        fetch("/api/erp/locations/branches/city").then(r => r.json())
      ]);
      if (cRes.status === "fulfilled" && cRes.value?.countries) {
        setCountriesList(cRes.value.countries);
      }
      if (bRes.status === "fulfilled" && bRes.value?.data?.branches) {
        setBranchesList(bRes.value.data.branches);
      }
    } catch (_) {}
  }

  async function fetchRecords() {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const qp = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset)
      });
      if (selectedCountry !== "all") qp.set("countryId", selectedCountry);
      if (selectedBranch !== "all") qp.set("cityBranchId", selectedBranch);
      if (selectedModule !== "all") qp.set("module", selectedModule);
      if (selectedDeletedBy !== "all") qp.set("deletedBy", selectedDeletedBy);
      if (selectedRisk !== "all") qp.set("riskLevel", selectedRisk);
      if (selectedStatus !== "all") qp.set("reviewStatus", selectedStatus);
      if (fromDate) qp.set("fromDate", fromDate);
      if (toDate) qp.set("toDate", toDate);
      if (searchQuery.trim()) qp.set("search", searchQuery.trim());

      const res = await fetch(`/api/erp/audit/deleted-records?${qp.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setTotalCount(data.total || 0);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFilters() {
    setSelectedCountry("all");
    setSelectedBranch("all");
    setSelectedModule("all");
    setSelectedDeletedBy("all");
    setSelectedRisk("all");
    setSelectedStatus("all");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setCurrentPage(1);
  }

  function handleExportCsv() {
    if (!records.length) return;
    const exportRows = records.map((r, i) => ({
      "#": i + 1,
      "Deleted At": new Date(r.deleted_at).toLocaleString(),
      "Original Date": r.original_date ? new Date(r.original_date).toLocaleString() : "-",
      "Module": r.module,
      "Country": r.country_name || "Global",
      "Branch": r.branch_name || "Main Branch",
      "Bill / Ref No": r.reference_no || r.entity_id,
      "Record / Party": r.party_name || "-",
      "Deleted By": `${r.user_name} (${r.user_role})`,
      "Reason": r.reason || "-",
      "Risk Level": r.risk_level,
      "Review Status": r.review_status
    }));
    downloadCsv(exportRows, `all_deleted_records_${new Date().toISOString().split("T")[0]}`);
  }

  function handlePrint() {
    window.print();
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="mx-auto w-full max-w-[1720px] p-4 lg:p-6 space-y-6 font-sans antialiased text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* ── HEADER STRIP ── */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
            <Trash2 className="h-6 w-6 text-rose-600" />
            <span>{t(lang, "audit.deleted_records_title", "Deleted Records Control — All Countries & Branches")}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t(lang, "audit.deleted_records_subtitle", "Complete deletion monitoring, approval evidence and recoverable record history")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 h-9 px-3.5 border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>{t(lang, "audit.export_csv", "Export CSV")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-1.5 h-9 px-3.5 border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-blue-600" />
            <span>{t(lang, "audit.audit_pdf", "Audit PDF")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fetchRecords}
            className="flex items-center gap-1.5 h-9 px-3 border-slate-200 dark:border-slate-700 font-bold text-xs"
            title={t(lang, "audit.refresh", "Refresh")}
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t(lang, "audit.refresh", "Refresh")}</span>
          </Button>
        </div>
      </header>

      {/* ── 6 KPI SUMMARY CARDS ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Deleted Today */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_deleted_today", "Deleted Today")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.deletedToday.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 mt-1">
                <TrendingDown className="h-3 w-3" />
                <span>-18.4% vs yesterday</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shadow-xs">
              <Trash2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Pending Review */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_pending_review", "Pending Review")}
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {kpis.pendingReview.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 mt-1">
                <TrendingDown className="h-3 w-3" />
                <span>-12.6% vs yesterday</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: High-Risk Deletions */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_high_risk_deletions", "High-Risk Deletions")}
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {kpis.highRiskDeletions.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 mt-1">
                <TrendingUp className="h-3 w-3" />
                <span>8.9% vs yesterday</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 flex items-center justify-center shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Restored Records */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_restored_records", "Restored Records")}
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {kpis.restoredRecords.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 mt-1">
                <TrendingUp className="h-3 w-3" />
                <span>15.6% vs yesterday</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
              <RotateCcw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Countries */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_countries", "Countries")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.totalCountries}
              </div>
              <div className="text-[10.5px] font-medium text-slate-400 mt-1">
                All operating countries
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shadow-xs">
              <Globe className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 6: Branches */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_branches", "Branches")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.totalBranches}
              </div>
              <div className="text-[10.5px] font-medium text-slate-400 mt-1">
                All offices / branches
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── COMPREHENSIVE FILTER BAR ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        
        {/* Row 1: Dropdown selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Country */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_country", "Country")}
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_countries", "All Countries")}</option>
              {countriesList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="pk">Pakistan</option>
              <option value="ae">UAE</option>
              <option value="af">Afghanistan</option>
              <option value="ir">Iran</option>
              <option value="in">India</option>
              <option value="sa">Saudi Arabia</option>
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_branch", "Branch")}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_branches", "All Branches")}</option>
              {branchesList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="pk_main">Pakistan Main Branch</option>
              <option value="dxb_main">Dubai Main Branch</option>
              <option value="khi_port">Karachi Port Branch</option>
              <option value="kbl_main">Kabul Central Branch</option>
            </select>
          </div>

          {/* Module */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_module", "Module")}
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_modules", "All Modules")}</option>
              <option value="Purchase">Purchase</option>
              <option value="Local Purchase">Local Purchase</option>
              <option value="Sales">Sales</option>
              <option value="Local Sales">Local Sales</option>
              <option value="Cash Entry">Cash Entry / Roznamcha</option>
              <option value="Ledger">Ledger</option>
              <option value="Payment">Payment & Transfers</option>
              <option value="Shipping">Shipping & Clearing</option>
              <option value="Invoices">Invoices & Endorsements</option>
              <option value="Customers">Customers & Parties</option>
              <option value="Employees">Employees</option>
            </select>
          </div>

          {/* Deleted By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_deleted_by", "Deleted By")}
            </label>
            <select
              value={selectedDeletedBy}
              onChange={(e) => {
                setSelectedDeletedBy(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_users", "All Users")}</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Ali Hassan">Ali Hassan</option>
              <option value="Neha Sharma">Neha Sharma</option>
              <option value="Bilal Ahmed">Bilal Ahmed</option>
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_risk_level", "Risk Level")}
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => {
                setSelectedRisk(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_risk_levels", "All Risk Levels")}</option>
              <option value="High">{t(lang, "audit.risk_high", "High")}</option>
              <option value="Medium">{t(lang, "audit.risk_medium", "Medium")}</option>
              <option value="Low">{t(lang, "audit.risk_low", "Low")}</option>
            </select>
          </div>

          {/* Review Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_review_status", "Review Status")}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_statuses", "All Statuses")}</option>
              <option value="Pending">{t(lang, "audit.status_pending", "Pending")}</option>
              <option value="Reviewed">{t(lang, "audit.status_reviewed", "Reviewed")}</option>
              <option value="Investigating">{t(lang, "audit.status_investigating", "Investigating")}</option>
            </select>
          </div>
        </div>

        {/* Row 2: Dates, Search and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            
            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">{t(lang, "audit.filter_from_date", "From Date")}:</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8.5 w-36 text-xs bg-slate-50/50 dark:bg-slate-800"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">{t(lang, "audit.filter_to_date", "To Date")}:</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8.5 w-36 text-xs bg-slate-50/50 dark:bg-slate-800"
              />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder={t(lang, "audit.search_placeholder", "Search bill, reference or keywords...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRecords()}
                className="h-8.5 pl-8 pr-3 text-xs bg-slate-50/50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-8.5 px-3 text-xs font-bold border-slate-200 dark:border-slate-700"
            >
              {t(lang, "audit.reset", "Reset")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={fetchRecords}
              className="h-8.5 px-4 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              {t(lang, "audit.filter_btn", "Filter")}
            </Button>
          </div>
        </div>
      </section>

      {/* ── MAIN DELETED RECORDS TABLE ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3.5 text-center w-8">#</th>
                <th className="py-3 px-3.5 flex items-center gap-1 text-rose-700 dark:text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t(lang, "audit.th_deleted_at", "Deleted At")}</span>
                </th>
                <th className="py-3 px-3">{t(lang, "audit.th_original_date", "Original Date")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_module", "Module")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_country", "Country")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_branch", "Branch")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_bill_ref", "Bill / Ref No.")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_record_party", "Record / Party")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_deleted_by", "Deleted By")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_user_role", "User Role")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_reason", "Reason")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_risk", "Risk")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_status", "Status")}</th>
                <th className="py-3 px-3.5 text-center">{t(lang, "audit.th_action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading enterprise deleted records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                    No deleted records found matching current criteria.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3.5 text-center font-mono text-slate-400 text-[10.5px]">
                        {itemNumber}
                      </td>
                      
                      {/* Deleted At */}
                      <td className="py-2.5 px-3.5 font-medium text-slate-800 dark:text-slate-200">
                        {new Date(row.deleted_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>

                      {/* Original Date */}
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {row.original_date ? new Date(row.original_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "-"}
                      </td>

                      {/* Module Badge */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {row.module}
                        </span>
                      </td>

                      {/* Country */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {row.country_name || "Global"}
                      </td>

                      {/* Branch */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {row.branch_name || "Main Branch"}
                      </td>

                      {/* Bill / Ref No with +History tag */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {row.reference_no || row.entity_id}
                          </span>
                          {(row.previous_edit_count || 0) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              +History
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Record / Party */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {row.party_name || "General Entry"}
                      </td>

                      {/* Deleted By */}
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {row.user_name || "Super Admin"}
                      </td>

                      {/* User Role */}
                      <td className="py-2.5 px-3 text-slate-500">
                        {row.user_role || "Admin"}
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate" title={row.reason}>
                        {row.reason || "Soft Deleted"}
                      </td>

                      {/* Risk Level Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          row.risk_level === "High"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : row.risk_level === "Medium"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                          {row.risk_level}
                        </span>
                      </td>

                      {/* Review Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          row.review_status === "Pending"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {row.review_status}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2.5 px-3.5 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/audit/deleted-records/${encodeURIComponent(row.id)}`)}
                          className="h-7.5 px-2.5 text-[11px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {t(lang, "audit.view_deleted_record", "View Deleted Record")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount.toLocaleString()}</span> records
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-semibold"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-black text-xs">
                {currentPage}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
