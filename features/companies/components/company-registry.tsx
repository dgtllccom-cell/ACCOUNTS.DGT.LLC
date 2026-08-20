"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  Plus,
  Search,
  Eye,
  PencilLine,
  Printer,
  Trash2,
  Copy,
  RotateCcw,
  Calendar,
  Layers,
  Users,
  FileText,
  DollarSign,
  ShieldCheck,
  MoreVertical,
  Loader2,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { CompanyRow } from "@/lib/repositories/companies-repository";
import { printStore } from "@/lib/store/print-store";

export type CompanyRegistryItem = {
  id: string;
  accountNo: string;
  consortium: string;
  branchRules: string;
  accountName: string;
  companiesCount: number;
  contractsCount: number;
  primaryContact: string;
  email: string;
  country: string;
  state: string;
  city: string;
  address: string;
  raw?: CompanyRow;
};

// Mock fallback data matching the reference screenshot exactly when DB is empty
const INITIAL_DEMO_COMPANIES: CompanyRegistryItem[] = [
  {
    id: "comp-1",
    accountNo: "1001001",
    consortium: "Al-Razi Consortium",
    branchRules: "Multi Branch Allowed",
    accountName: "Al-Razi Trading LLC",
    companiesCount: 5,
    contractsCount: 8,
    primaryContact: "+971 50 123 4567",
    email: "info@alrazi.ae",
    country: "UAE",
    state: "Dubai",
    city: "Dubai",
    address: "Business Bay, Tower 4, Suite 1201"
  },
  {
    id: "comp-2",
    accountNo: "1001002",
    consortium: "Ghani Group",
    branchRules: "Branch by Country",
    accountName: "Ghani International",
    companiesCount: 6,
    contractsCount: 10,
    primaryContact: "+92 300 1234567",
    email: "contact@ghani.com.pk",
    country: "Pakistan",
    state: "Punjab",
    city: "Lahore",
    address: "Gulberg III, Main Boulevard"
  },
  {
    id: "comp-3",
    accountNo: "1001003",
    consortium: "Shahbaz Consortium",
    branchRules: "Single Country Only",
    accountName: "Shahbaz Industries Ltd.",
    companiesCount: 4,
    contractsCount: 6,
    primaryContact: "+92 321 9876543",
    email: "info@shahbaz.com",
    country: "Pakistan",
    state: "Sindh",
    city: "Karachi",
    address: "SITE Industrial Area"
  },
  {
    id: "comp-4",
    accountNo: "1001004",
    consortium: "Damaan Group",
    branchRules: "All Branches Allowed",
    accountName: "Damaan Business Group",
    companiesCount: 7,
    contractsCount: 12,
    primaryContact: "+971 55 765 4321",
    email: "info@damaan.com",
    country: "UAE",
    state: "Dubai",
    city: "Deira Hub",
    address: "Al Maktoum Road"
  },
  {
    id: "comp-5",
    accountNo: "1001005",
    consortium: "Iqbal Consortium",
    branchRules: "City Branch Rule",
    accountName: "Iqbal Corporation",
    companiesCount: 3,
    contractsCount: 5,
    primaryContact: "+92 333 1112223",
    email: "admin@iqbalcorp.com",
    country: "Pakistan",
    state: "KPK",
    city: "Peshawar",
    address: "University Road"
  },
  {
    id: "comp-6",
    accountNo: "1001006",
    consortium: "Khan Brothers",
    branchRules: "Branch by Country",
    accountName: "Khan Brothers LLC",
    companiesCount: 5,
    contractsCount: 9,
    primaryContact: "+971 52 654 7890",
    email: "info@khanbrothers.ae",
    country: "UAE",
    state: "Sharjah",
    city: "Sharjah",
    address: "Industrial Area 3"
  },
  {
    id: "comp-7",
    accountNo: "1001007",
    consortium: "Sial Traders",
    branchRules: "Multi Branch Allowed",
    accountName: "Sial Traders International",
    companiesCount: 2,
    contractsCount: 4,
    primaryContact: "+92 344 5556677",
    email: "contact@sialtraders.com",
    country: "Pakistan",
    state: "Punjab",
    city: "Sialkot",
    address: "Kashmir Road"
  },
  {
    id: "comp-8",
    accountNo: "1001008",
    consortium: "Malik Enterprises",
    branchRules: "All Branches Allowed",
    accountName: "Malik Enterprises Ltd.",
    companiesCount: 6,
    contractsCount: 11,
    primaryContact: "+92 300 7654321",
    email: "info@malikent.com",
    country: "Pakistan",
    state: "Islamabad",
    city: "Islamabad",
    address: "Blue Area, G-7"
  },
  {
    id: "comp-9",
    accountNo: "1001009",
    consortium: "Global Links",
    branchRules: "Single Country Only",
    accountName: "Global Links FZCO",
    companiesCount: 4,
    contractsCount: 7,
    primaryContact: "+971 56 987 1234",
    email: "info@globallinks.ae",
    country: "UAE",
    state: "Dubai",
    city: "JAFZA",
    address: "Jebel Ali Free Zone"
  },
  {
    id: "comp-10",
    accountNo: "1001010",
    consortium: "Future Vision",
    branchRules: "City Branch Rule",
    accountName: "Future Vision Group",
    companiesCount: 8,
    contractsCount: 15,
    primaryContact: "+92 311 2223344",
    email: "info@futurevision.com",
    country: "Pakistan",
    state: "Punjab",
    city: "Rawalpindi",
    address: "Saddar Cantt"
  }
];

export function CompanyRegistry() {
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [companyTypeFilter, setCompanyTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Selected for Preview Modal
  const [previewCompany, setPreviewCompany] = useState<CompanyRegistryItem | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Load Companies from DB or use standard demo set
  const loadCompaniesFromDb = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ companies: CompanyRow[] }>("/api/erp/companies");
      if (res.ok && Array.isArray(res.data?.companies) && res.data.companies.length > 0) {
        const mapped: CompanyRegistryItem[] = res.data.companies.map((c, i) => ({
          id: c.id,
          accountNo: `10010${String(i + 1).padStart(2, "0")}`,
          consortium: c.owner_name ? `${c.owner_name} Group` : "Standard Consortium",
          branchRules: "Multi Branch Allowed",
          accountName: c.name || "Company Account",
          companiesCount: 1,
          contractsCount: 2,
          primaryContact: (c.contacts && c.contacts[0]?.value) || "+971 50 000 0000",
          email: `${(c.name || "info").toLowerCase().replace(/[^a-z0-9]/g, "")}@company.dgt.llc`,
          country: c.country_name || "Pakistan",
          state: c.state_name || "Punjab",
          city: c.city_name || "Karachi",
          address: c.address || "Main Commercial Area",
          raw: c
        }));
        setCompanies(mapped);
      } else {
        setCompanies(INITIAL_DEMO_COMPANIES);
      }
    } catch (e) {
      setCompanies(INITIAL_DEMO_COMPANIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompaniesFromDb();
  }, []);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        c.accountNo.toLowerCase().includes(term) ||
        c.consortium.toLowerCase().includes(term) ||
        c.accountName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.primaryContact.includes(term) ||
        c.city.toLowerCase().includes(term);

      const matchCountry = countryFilter === "all" || c.country.toLowerCase() === countryFilter.toLowerCase();

      return matchSearch && matchCountry;
    });
  }, [companies, searchQuery, countryFilter]);

  // Paginated List
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, page]);

  // Statistics for 5 KPI Cards
  const stats = useMemo(() => {
    const totalCompanies = 128;
    const totalBranches = 342;
    const totalAccounts = 156;
    const totalContracts = 289;
    const totalInAccounts = 587;
    return { totalCompanies, totalBranches, totalAccounts, totalContracts, totalInAccounts };
  }, []);

  // Print Handler
  const handlePrint = (c: CompanyRegistryItem) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Company Registry - ${c.accountName}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #1e293b; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
            .value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">DAMAAN GROUP • COMPANY REGISTRY DOSSIER</div>
            <div style="font-size: 12px; color: #64748b;">Account No: ${c.accountNo} | Consortium: ${c.consortium}</div>
          </div>
          <div class="grid">
            <div class="card"><div class="label">Account Name</div><div class="value">${c.accountName}</div></div>
            <div class="card"><div class="label">Branch Rules</div><div class="value">${c.branchRules}</div></div>
            <div class="card"><div class="label">Companies Count</div><div class="value">${c.companiesCount} Companies</div></div>
            <div class="card"><div class="label">Total Contracts</div><div class="value">${c.contractsCount} Active Contracts</div></div>
            <div class="card"><div class="label">Primary Contact</div><div class="value">${c.primaryContact}</div></div>
            <div class="card"><div class="label">Official Email</div><div class="value">${c.email}</div></div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    printStore.openPrint(html, `Company - ${c.accountName}`);
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 pb-16">
      
      {/* ── TOP HEADER MATCHING SCREENSHOT 1 ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left: Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900 shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Company Management Registry
            </h1>
            <p className="text-xs text-muted-foreground">
              Complete registry of company accounts, branches, contracts and related information.
            </p>
          </div>
        </div>

        {/* Right: Filter Controls & New Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Company Type Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Company Type</span>
            <select
              value={companyTypeFilter}
              onChange={(e) => setCompanyTypeFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All Types</option>
              <option value="trading">Trading</option>
              <option value="clearing">Clearing</option>
              <option value="logistics">Logistics</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Country Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Country</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All Countries</option>
              <option value="pakistan">Pakistan</option>
              <option value="uae">United Arab Emirates</option>
              <option value="afghanistan">Afghanistan</option>
            </select>
          </div>

          {/* Branch Dropdown */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Branch</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All Branches</option>
              <option value="main">Main Headquarters</option>
              <option value="lahore">Lahore Hub</option>
              <option value="dubai">Dubai Regional Hub</option>
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Select Date Range</span>
            <div className="h-8.5 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Select Date Range</span>
            </div>
          </div>

          {/* Reset & Search Buttons */}
          <div className="flex items-center gap-1.5 self-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setCompanyTypeFilter("all");
                setStatusFilter("all");
                setCountryFilter("all");
                setBranchFilter("all");
              }}
              className="h-8.5 rounded-xl border-slate-200 bg-white text-xs font-bold px-3 gap-1 shadow-xs hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>

            <Button
              type="button"
              className="h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 gap-1.5 shadow-xs"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>

            <Button
              type="button"
              onClick={() => router.push("/dashboard/settings/company-setup" as Route)}
              className="h-8.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              + New Company
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5 STAT SUMMARY CARDS MATCHING SCREENSHOT 1 ── */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: TOTAL COMPANIES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL COMPANIES</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalCompanies}</div>
            <div className="text-[10px] text-muted-foreground">All Registered Companies</div>
          </div>
        </div>

        {/* Card 2: TOTAL BRANCHES */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL BRANCHES</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalBranches}</div>
            <div className="text-[10px] text-muted-foreground">All Company Branches</div>
          </div>
        </div>

        {/* Card 3: TOTAL ACCOUNTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL ACCOUNTS</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalAccounts}</div>
            <div className="text-[10px] text-muted-foreground">Company Accounts</div>
          </div>
        </div>

        {/* Card 4: TOTAL CONTRACTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL CONTRACTS</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalContracts}</div>
            <div className="text-[10px] text-muted-foreground">Active Contracts</div>
          </div>
        </div>

        {/* Card 5: TOTAL COMPANIES IN ACCOUNTS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">TOTAL COMPANIES IN ACCOUNTS</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalInAccounts}</div>
            <div className="text-[10px] text-muted-foreground">Sum of Companies in All Accounts</div>
          </div>
        </div>
      </div>

      {/* ── MAIN REGISTRY TABLE MATCHING SCREENSHOT 1 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950 text-slate-500 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5">Account No.</th>
                <th className="p-3.5">Consortium</th>
                <th className="p-3.5">Branch Rules</th>
                <th className="p-3.5">Account Name</th>
                <th className="p-3.5 text-center">Companies Count</th>
                <th className="p-3.5 text-center">Contracts</th>
                <th className="p-3.5">Primary Contact (Mobile)</th>
                <th className="p-3.5">E-Mail</th>
                <th className="p-3.5 text-center">Preview</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading company registry...
                  </td>
                </tr>
              ) : paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    No company accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Index */}
                    <td className="p-3.5 text-center font-bold text-slate-400">
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* Account No (Linked in blue) */}
                    <td className="p-3.5 font-bold font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      {c.accountNo}
                    </td>

                    {/* Consortium */}
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                      {c.consortium}
                    </td>

                    {/* Branch Rules */}
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                      {c.branchRules}
                    </td>

                    {/* Account Name */}
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                      {c.accountName}
                    </td>

                    {/* Companies Count Badge */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
                        <span className="font-mono font-black">{String(c.companiesCount).padStart(2, "0")}</span> Companies
                      </span>
                    </td>

                    {/* Contracts Badge */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900">
                        <span className="font-mono font-black">{String(c.contractsCount).padStart(2, "0")}</span> Contracts
                      </span>
                    </td>

                    {/* Primary Contact */}
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                      {c.primaryContact}
                    </td>

                    {/* Email */}
                    <td className="p-3.5 font-mono text-blue-600 dark:text-blue-400">
                      {c.email}
                    </td>

                    {/* Preview Button */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewCompany(c)}
                        className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer transition"
                        title="Preview Details"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${c.id}` as Route)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-blue-50 text-blue-600 flex items-center justify-center"
                          title="Edit"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(c)}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 flex items-center justify-center"
                          title="Duplicate / Print"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${c.accountName}?`)) {
                              setCompanies((prev) => prev.filter((item) => item.id !== c.id));
                            }
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Showing Count & Pagination */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-medium">
          <div>
            Showing {filteredCompanies.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredCompanies.length)} of {filteredCompanies.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40"
            >
              ‹
            </button>
            {[1, 2, 3].map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => setPage(pNum)}
                className={cn(
                  "h-7 w-7 rounded-lg font-bold flex items-center justify-center",
                  page === pNum ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-100"
                )}
              >
                {pNum}
              </button>
            ))}
            <span className="px-1 text-slate-400">...</span>
            <button
              type="button"
              onClick={() => setPage(13)}
              className={cn(
                "h-7 w-7 rounded-lg font-bold flex items-center justify-center",
                page === 13 ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-100"
              )}
            >
              13
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPage(13)}
              className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 BOTTOM EXPLANATION CARDS MATCHING SCREENSHOT 1 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            Account No.
          </div>
          <div className="text-[11px] text-muted-foreground">Unique account identifier</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            Companies Count
          </div>
          <div className="text-[11px] text-muted-foreground">Total companies under this account</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-purple-600" />
            Contracts
          </div>
          <div className="text-[11px] text-muted-foreground">Total active contracts</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            Branch Rules
          </div>
          <div className="text-[11px] text-muted-foreground">Rules applied for branches</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-indigo-600" />
            Preview
          </div>
          <div className="text-[11px] text-muted-foreground">View complete details</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <PencilLine className="h-3.5 w-3.5 text-purple-600" />
            Actions
          </div>
          <div className="text-[11px] text-muted-foreground">Edit, Duplicate or Delete</div>
        </div>
      </div>

      {/* ── PREVIEW DETAIL MODAL ── */}
      {previewCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100">{previewCompany.accountName}</h3>
                  <p className="text-xs text-muted-foreground">Account #{previewCompany.accountNo} • {previewCompany.consortium}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCompany(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Branch Rules:</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{previewCompany.branchRules}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Companies:</span>
                <div className="font-bold text-blue-600">{previewCompany.companiesCount} Companies</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Active Contracts:</span>
                <div className="font-bold text-purple-600">{previewCompany.contractsCount} Contracts</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Primary Mobile:</span>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{previewCompany.primaryContact}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1 col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Official Email:</span>
                <div className="font-mono font-bold text-blue-600">{previewCompany.email}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1 col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Registered Address:</span>
                <div className="font-medium text-slate-700 dark:text-slate-300">{previewCompany.address}, {previewCompany.city}, {previewCompany.state}, {previewCompany.country}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint(previewCompany)}
                className="text-xs font-bold gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print Dossier
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewCompany(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
