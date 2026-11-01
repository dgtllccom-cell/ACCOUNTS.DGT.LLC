"use client";

import { useState, useMemo, useEffect } from "react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { localizeCountryName } from "@/lib/i18n/country-names";
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  Languages, 
  ShieldCheck, 
  Calendar, 
  Layers, 
  GitBranch,
  ExternalLink,
  BookOpen,
  Building2,
  Boxes,
  Users,
  Landmark,
  FileCheck,
  FileSpreadsheet,
  Lock,
  Search,
  KeyRound,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessRegisterEntry } from "@/lib/repositories/access-register-repository";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import { Th } from "@/components/ui/translated-th";
import { DAILY_DEVELOPMENT_LOGS, HANDOVER_GUIDE_NOTES, type DailyLog } from "@/lib/handover/handover-content";


export function HandoverReportView({ privileged = false }: { privileged?: boolean }) {
  const lang = useActiveLanguage();
  const roleLabel = (r: string) => t(lang, ("role." + r.trim().toLowerCase().replace(/[\s/]+/g, "_")) as never, translateHeader(lang, r));
  const th = (s: string) => translateHeader(lang, s);
  const [activeTab, setActiveTab] = useState<"operational" | "overview" | "access-register" | "timeline" | "database" | "i18n" | "rbac" | "guide">(privileged ? "access-register" : "operational");
  // the real operational handover figures (Business -> Shipping handovers inside the login's own scope); the system facts only for the Super Admin
  const [summary, setSummary] = useState<{ total: number; byStatus: Array<{ status: string; n: number }>; latest: Array<Record<string, any>>; system?: { publicTables: number } } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erp/reports/handover-summary${privileged ? "?admin=1" : ""}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.ok) setSummary(d.data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [privileged]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [accessSearch, setAccessSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [accessRegister, setAccessRegister] = useState<AccessRegisterEntry[]>([]);
  const [accessRegisterLoading, setAccessRegisterLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // the global login access register is privileged: it is never even requested for another role
    if (!privileged) { setAccessRegisterLoading(false); return () => { cancelled = true; }; }
    fetch("/api/erp/reports/access-register", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAccessRegister(Array.isArray(d?.rows) ? d.rows : []); })
      .catch(() => { if (!cancelled) setAccessRegister([]); })
      .finally(() => { if (!cancelled) setAccessRegisterLoading(false); });
    return () => { cancelled = true; };
  }, [privileged]);

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      link.href = "/api/erp/reports/handover-pdf";
      link.download = "COMPLETE_ERP_SYSTEM_HANDOVER_REPORT.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open("/api/erp/reports/handover-pdf", "_blank");
    } finally {
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };

  const handleDownloadAccessExcel = () => {
    const link = document.createElement("a");
    link.href = "/api/erp/reports/access-register/excel";
    link.download = "Country_Branch_Login_Access_Register.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAccessPdf = () => {
    try {
      const link = document.createElement("a");
      link.href = "/api/erp/reports/access-register/pdf";
      link.download = "Country_Branch_Login_Access_Register.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open("/api/erp/reports/access-register/pdf", "_blank");
    }
  };

  const handlePrintGenericReport = () => {
    openGenericErpReport({
      title: th("Living Production System & Journal Report PDF — ERP Handover"),
      subtitle: th("Complete architecture overview, database tables verification and branch login access audit"),
      columns: [
        { key: "country", label: th("Country") },
        { key: "mainBranch", label: th("Main Branch") },
        { key: "cityBranch", label: th("City Branch") },
        { key: "responsiblePerson", label: th("Responsible Person") },
        { key: "role", label: th("Role") },
        { key: "username", label: th("Username / Login ID") },
        { key: "passwordVaultRef", label: th("Vault Ref / Credential ID") },
        { key: "status", label: th("Status"), format: "status" }
      ],
      rows: accessRegister as any,
      summary: {
        totalLogins: accessRegister.length,
        publicTables: summary?.system?.publicTables ?? 0,
        handovers: summary?.total ?? 0
      },
      orientation: "landscape",
      companyInfo: {
        name: "DGT LLC Accounts ERP",
        tagline: "Living Production System & Enterprise Journal Handover",
        currency: "USD"
      }
    });
  };

  const filteredAccessEntries = useMemo(() => {
    return accessRegister.filter(entry => {
      const matchesSearch = accessSearch === "" ||
        entry.country.toLowerCase().includes(accessSearch.toLowerCase()) ||
        entry.mainBranch.toLowerCase().includes(accessSearch.toLowerCase()) ||
        entry.cityBranch.toLowerCase().includes(accessSearch.toLowerCase()) ||
        entry.responsiblePerson.toLowerCase().includes(accessSearch.toLowerCase()) ||
        entry.username.toLowerCase().includes(accessSearch.toLowerCase()) ||
        entry.passwordVaultRef.toLowerCase().includes(accessSearch.toLowerCase());

      const matchesRole = roleFilter === "all" || entry.role === roleFilter;
      const matchesCountry = countryFilter === "all" || entry.country.includes(countryFilter);

      return matchesSearch && matchesRole && matchesCountry;
    });
  }, [accessRegister, accessSearch, roleFilter, countryFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <FileCheck className="w-3.5 h-3.5" /> {th("Living Production System & Journal Report PDF")}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{th("Journal Report PDF ERP")}</h1>
          <p className="text-slate-400 text-sm max-w-3xl">
            {th("Country & Branch Login Access Register, complete ERP system architecture, database data migration proof, and living PDF handover.")}
          </p>
        </div>

        {privileged && (
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={handleDownloadAccessExcel} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            {th("Download Excel Register")}
          </Button>
          <Button 
            onClick={handleDownloadAccessPdf} 
            className="bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {th("Download PDF Register")}
          </Button>
          <Button 
            onClick={handleDownloadPdf} 
            disabled={isDownloading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloading ? th("Downloading") + "..." : th("Download Handover PDF")}
          </Button>
        </div>
        )}
      </div>

      {/* Metrics Row - real figures only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          [String(summary?.total ?? 0), th("Handovers in your scope"), "text-slate-900 dark:text-slate-100"],
          ...(summary?.byStatus ?? []).slice(0, privileged ? 1 : 3).map((s) => [String(s.n), th(String(s.status).replace(/_/g, " ")), "text-blue-600"]),
          ...(privileged ? [[String(accessRegister.length), th("Branch Logins Registered"), "text-emerald-600"], [String(summary?.system?.publicTables ?? 0), th("Verified DB Tables"), "text-indigo-600"]] : [])
        ].slice(0, 4).map(([value, label, tone]) => (
          <div key={String(label)} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className={`text-2xl font-bold font-mono ${tone}`}>{value}</div>
            <div className="text-xs uppercase font-semibold text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1">
        {[
          { key: "operational", label: th("Operational Handovers"), icon: Layers },
          ...(privileged ? [
          { key: "access-register", label: th("Country / Branch Login Access Register"), icon: KeyRound },
          { key: "overview", label: th("Executive Overview"), icon: Layers },
          { key: "timeline", label: th("Daily Development Timeline (Living Log)"), icon: Calendar },
          { key: "database", label: th("Database Post-Migration Audit"), icon: Database },
          { key: "i18n", label: th("5-Language Translation Audit"), icon: Languages },
          { key: "rbac", label: th("Role & Permission Hierarchy"), icon: ShieldCheck },
          { key: "guide", label: th("Developer Handover Guide"), icon: BookOpen },
          ] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Operational handovers (real saved records in the login's scope) */}
      {activeTab === "operational" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600">
                <Th className="px-3 py-2 text-start">{th("Handover No.")}</Th>
                <Th className="px-3 py-2 text-start">{th("Action")}</Th>
                <Th className="px-3 py-2 text-start">{th("Business Reference")}</Th>
                <Th className="px-3 py-2 text-start">{th("BL Reference")}</Th>
                <Th className="px-3 py-2 text-start">{th("Status")}</Th>
                <Th className="px-3 py-2 text-start">{th("Created By")}</Th>
                <Th className="px-3 py-2 text-start">{th("Date")}</Th>
              </tr>
            </thead>
            <tbody>
              {(summary?.latest ?? []).map((h) => (
                <tr key={String(h.id)} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5 font-bold">{h.handover_no || "—"}</td>
                  <td className="px-3 py-1.5">{h.action_type ? th(String(h.action_type).replace(/_/g, " ")) : "—"}</td>
                  <td className="px-3 py-1.5">{h.business_reference_no || "—"}</td>
                  <td className="px-3 py-1.5">{h.bl_reference || "—"}</td>
                  <td className="px-3 py-1.5">{h.status ? th(String(h.status).replace(/_/g, " ")) : "—"}</td>
                  <td className="px-3 py-1.5">{h.created_by_name || "—"}</td>
                  <td className="px-3 py-1.5" dir="ltr">{h.created_at ? String(h.created_at).slice(0, 10) : "—"}</td>
                </tr>
              ))}
              {summary && summary.latest.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">{th("No handovers recorded in your scope yet.")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Country / Branch Login Access Register */}
      {privileged && activeTab === "access-register" && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-red-800 dark:text-red-300">
              <div className="font-bold text-sm">{th("Super Admin Restricted Credential Register")}</div>
              <p>
                {th("In compliance with strict security policies, plaintext passwords are never stored, exported, or displayed. Every login account is linked to the approved enterprise credential vault via its Password Vault Reference / Credential ID. To reset credentials, utilize the verified identity provisioning channel.")}
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={th("Search Country, Branch, Person, Vault ID...")}
                value={accessSearch}
                onChange={(e) => setAccessSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="all">{th("All Countries")}</option>
                {Array.from(new Set(accessRegister.map((e) => e.country).filter(Boolean))).sort().map((c) => (
                  <option key={c} value={c}>{localizeCountryName(c, lang)}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="all">{th("All Roles")}</option>
                {Array.from(new Set(accessRegister.map((e) => e.role).filter(Boolean))).sort().map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Access Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="max-h-[68vh] overflow-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase font-semibold text-[11px] shadow-sm">
                  <tr>
                    <Th className="whitespace-nowrap p-3">{th("Country")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Main Branch")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("City Branch")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("User / Person")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Role")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Username / Login ID")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Assigned Permissions")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Vault Ref ID")}</Th>
                    <Th className="whitespace-nowrap p-3">{th("Status")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(accessRegisterLoading || filteredAccessEntries.length === 0) && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                        {accessRegisterLoading ? th("Loading access register…") : th("No access-register records found.")}
                      </td>
                    </tr>
                  )}
                  {filteredAccessEntries.map((entry) => {
                    let roleBadge = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
                    if (entry.role === "Super Admin") roleBadge = "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300";
                    else if (entry.role === "Country Admin") roleBadge = "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300";
                    else if (entry.role === "Main Branch Admin") roleBadge = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300";
                    else if (entry.role === "Clearing Agent") roleBadge = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300";

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100 align-middle">{localizeCountryName(entry.country, lang)}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 align-middle">{entry.mainBranch}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 align-middle">{entry.cityBranch}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 align-middle">{entry.responsiblePerson}</td>
                        <td className="p-3 align-middle">
                          <span className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-2xs ${roleBadge}`}>
                            {roleLabel(entry.role)}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate p-3 font-mono text-[11px] text-blue-700 dark:text-blue-300 font-semibold align-middle" title={entry.username}>{entry.username}</td>
                        <td className="p-3 align-top text-[11px] text-slate-600 dark:text-slate-400" title={entry.assignedPermissions}>
                          {(() => {
                            const list = String(entry.assignedPermissions || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
                            if (list.length === 0) return <span className="text-slate-400">—</span>;
                            return (
                              <details className="print:open">
                                <summary className="cursor-pointer list-none font-semibold text-slate-700 dark:text-slate-300 marker:content-none">
                                  {list.length} {th("permissions assigned")}
                                </summary>
                                <div className="mt-1 flex max-w-[260px] flex-wrap gap-1">
                                  {list.map((p, i) => (
                                    <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">{p}</span>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                        </td>
                        <td className="max-w-[150px] truncate p-3 font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded px-2 py-1 align-middle" title={entry.passwordVaultRef}>
                          {entry.passwordVaultRef}
                        </td>
                        <td className="p-3 align-middle">
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Overview */}
      {privileged && activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {th("System Status & VPS Production Handover")}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              The <strong>ACCOUNTS.DGT.LLC</strong> enterprise system is fully deployed and operational on the production host <strong>72.60.209.121</strong>. All master registries (Companies, Banks, Warehouses, Customers/Owners, Accounts, Goods, Locations, Employees) operate on genuine PostgreSQL database tables with live search, filters, pagination, and multi-language support.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">{th("Core Architectures Implemented")}</h3>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  <li><strong>Country / Branch Login Register:</strong> Centralized multi-tier access mapping.</li>
                  <li><strong>Account Multi-Linking:</strong> 4 junction tables linking single accounts across entities.</li>
                  <li><strong>Universal Report Modal:</strong> Standardized Journal/Ledger print, PDF & CSV suite.</li>
                  <li><strong>Stock Movements:</strong> In/Out tracking, warehouse balance recalculation, variations.</li>
                  <li><strong>Dynamic Multilingual:</strong> 11,154 database translations with RTL/LTR switching.</li>
                </ul>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">{th("Production Environment")}</h3>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  <li><strong>VPS Host:</strong> <code>72.60.209.121</code> (Port 3000 / Port 80 via Nginx)</li>
                  <li><strong>PM2 Runtime:</strong> <code>dgt-nextjs</code> (Process ID 0, auto-restart on boot)</li>
                  <li><strong>Database:</strong> AWS AP-Southeast-2 Supabase PostgreSQL Pooler</li>
                  <li><strong>Repository:</strong> <code>B:\accounts.dgt.llc.code_project\ACCOUNTS.DGT.LLC</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Timeline */}
      {privileged && activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-xs text-blue-800 dark:text-blue-300">
            <strong>Living Report Rule:</strong> Every developer completing work must append a new dated entry to this log and run <code>node scripts/generate-complete-erp-handover-pdf.mjs</code> to update the downloadable PDF.
          </div>

          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8 pb-4">
            {DAILY_DEVELOPMENT_LOGS.map((log, index) => (
              <div key={index} className="relative pl-6">
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white dark:border-slate-900" />
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{log.date}</span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{log.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                        {log.gitRef}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {log.testingStatus}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {log.summary}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-200 block mb-1">{th("Modules Affected:")}</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                        {log.modulesAffected.map((mod, i) => (
                          <li key={i}>{mod}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-200 block mb-1">{th("Issues Fixed:")}</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-emerald-600 dark:text-emerald-400">
                        {log.issuesFixed.map((fix, i) => (
                          <li key={i}>{fix}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Database Audit */}
      {privileged && activeTab === "database" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{th("Direct SQL Row Counts (Local vs VPS PostgreSQL)")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                <tr>
                  <Th className="p-2.5">{th("Module Name")}</Th>
                  <Th className="p-2.5">{th("Database Table")}</Th>
                  <Th className="p-2.5">{th("Local DB Rows")}</Th>
                  <Th className="p-2.5">{th("VPS DB Rows")}</Th>
                  <Th className="p-2.5">{th("Status")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { m: "Companies Master", t: "companies", l: 203, v: 213 },
                  { m: "Banks Master", t: "banks", l: 149, v: 152 },
                  { m: "Warehouses Master", t: "warehouses", l: 169, v: 171 },
                  { m: "Customers / Owners", t: "customers", l: 207, v: 211 },
                  { m: "Chart of Accounts", t: "accounts", l: 4, v: 4 },
                  { m: "Goods / Items Master", t: "goods", l: 6, v: 12 },
                  { m: "Stock Movements", t: "stock_movements", l: 6, v: 6 },
                  { m: "Employees Master", t: "employees", l: 54, v: 54 },
                  { m: "Ports / Borders", t: "ports", l: 9, v: 15 },
                  { m: "Account Multi-Link (Company)", t: "account_companies", l: 7, v: 7 },
                  { m: "Account Multi-Link (Customer)", t: "account_customer_owners", l: 4, v: 4 },
                  { m: "Account Multi-Link (Bank)", t: "account_banks", l: 4, v: 4 },
                  { m: "Account Multi-Link (Warehouse)", t: "account_warehouses", l: 4, v: 4 },
                  { m: "Customer Registrations", t: "customer_registrations", l: 80, v: 80 },
                  { m: "Customer Contacts", t: "customer_contacts", l: 120, v: 120 },
                  { m: "Cities Master", t: "cities", l: 664494, v: 704824 },
                  { m: "Multilingual Translations", t: "record_translations", l: 9442, v: 11154 }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">{row.m}</td>
                    <td className="p-2.5 font-mono text-slate-500">{row.t}</td>
                    <td className="p-2.5 font-mono">{row.l.toLocaleString()}</td>
                    <td className="p-2.5 font-mono font-semibold text-blue-600">{row.v.toLocaleString()}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 whitespace-nowrap">
                        {th("Supported")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: i18n Audit */}
      {privileged && activeTab === "i18n" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{th("5-Language Translation Audit (11,154 Database Records)")}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {th("Every master entity has 5-language coverage stored directly in")} <code>public.record_translations</code>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {[
              { code: "en", name: "English", dir: "LTR", status: "Supported" },
              { code: "ur", name: "Urdu (اردو)", dir: "RTL", status: "Supported" },
              { code: "ar", name: "Arabic (العربية)", dir: "RTL", status: "Supported" },
              { code: "fa", name: "Persian (فارسی)", dir: "RTL", status: "Supported" },
              { code: "ps", name: "Pashto (پښتو)", dir: "RTL", status: "Supported" },
            ].map((lang, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center space-y-1">
                <div className="text-xs font-mono font-bold uppercase text-slate-500">{lang.code} • {lang.dir}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{lang.name}</div>
                <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 whitespace-nowrap">
                  {th(lang.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: RBAC */}
      {privileged && activeTab === "rbac" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{th("Role-Based Access Control (RBAC) Hierarchy")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                <tr>
                  <Th className="p-2.5">{th("Role")}</Th>
                  <Th className="p-2.5">{th("Geographic Scope")}</Th>
                  <Th className="p-2.5">{th("Master CRUD")}</Th>
                  <Th className="p-2.5">{th("Ledger & Journal")}</Th>
                  <Th className="p-2.5">{th("Stock & Inventory")}</Th>
                  <Th className="p-2.5">{th("System Config")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="p-2.5 font-semibold text-blue-600">{th("Super Admin")}</td>
                  <td className="p-2.5">{th("Global (All Countries)")}</td>
                  <td className="p-2.5">{th("Full CRUD")}</td>
                  <td className="p-2.5">{th("Global Consolidation")}</td>
                  <td className="p-2.5">{th("All Warehouses")}</td>
                  <td className="p-2.5">{th("Full Admin")}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{th("Country Admin")}</td>
                  <td className="p-2.5">{th("Assigned Country")}</td>
                  <td className="p-2.5">{th("Country Scoped")}</td>
                  <td className="p-2.5">{th("Country Ledger")}</td>
                  <td className="p-2.5">{th("Country Warehouses")}</td>
                  <td className="p-2.5">{th("Branch Setup")}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{th("Main Branch Admin")}</td>
                  <td className="p-2.5">{th("Assigned Branch")}</td>
                  <td className="p-2.5">{th("Branch Scoped")}</td>
                  <td className="p-2.5">{th("Branch Ledger")}</td>
                  <td className="p-2.5">{th("Branch Warehouses")}</td>
                  <td className="p-2.5">{th("Staff Management")}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{th("City Branch User")}</td>
                  <td className="p-2.5">{th("Assigned City Branch")}</td>
                  <td className="p-2.5">{th("Read & Entry Only")}</td>
                  <td className="p-2.5">{th("Roznamcha Entry")}</td>
                  <td className="p-2.5">{th("Stock In/Out Entry")}</td>
                  <td className="p-2.5">{th("No Access")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Guide */}
      {privileged && activeTab === "guide" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{th("Instructions for Future Developers & Engineers")}</h2>
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {HANDOVER_GUIDE_NOTES.map((n, i) => (
              <p key={i}>
                {i + 1}. <strong>{n.title}</strong> {n.text}
                {n.command ? (
                  <>
                    <br />
                    <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-blue-600 inline-block mt-1">{n.command}</code>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
