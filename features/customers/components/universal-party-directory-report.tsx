"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Briefcase,
  Landmark,
  Search,
  Printer,
  Download,
  Plus,
  RefreshCw,
  Eye,
  Filter,
  X,
  FileSpreadsheet,
  Users
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { PartyAffiliationSummary } from "@/lib/services/party-360-service";
import { Party360Modal } from "./party-360-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type UniversalPartyDirectoryReportProps = {
  lang?: SupportedLanguage;
  onClose?: () => void;
};

export function UniversalPartyDirectoryReport({
  lang = "ur",
  onClose
}: UniversalPartyDirectoryReportProps) {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyAffiliationSummary[]>([]);
  const [search, setSearch] = useState("");
  const [affiliationFilter, setAffiliationFilter] = useState<"all" | "companies" | "employees" | "banks">("all");
  const [selectedParty, setSelectedParty] = useState<{ id?: string; name: string } | null>(null);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ parties: PartyAffiliationSummary[]; total: number }>(
        `/api/erp/parties/directory?limit=200`
      );
      if (res?.parties) {
        setParties(res.parties);
      }
    } catch (err) {
      console.error("Failed to load universal party directory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const filteredParties = useMemo(() => {
    let list = parties;
    if (affiliationFilter === "companies") {
      list = list.filter((p) => p.companies.length > 0);
    } else if (affiliationFilter === "employees") {
      list = list.filter((p) => p.employees.length > 0);
    } else if (affiliationFilter === "banks") {
      list = list.filter((p) => p.banks.length > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => {
        const fullUrdu = transliterateProperNoun(p.customerName, "ur").toLowerCase();
        const fatherUrdu = p.fatherName ? transliterateProperNoun(p.fatherName, "ur").toLowerCase() : "";
        const text = [
          p.customerName,
          fullUrdu,
          p.customerCode || "",
          p.fatherName || "",
          fatherUrdu,
          p.cityName || "",
          p.countryName || "",
          p.address || "",
          ...p.companies.map(c => c.name),
          ...p.employees.map(e => e.employeeCode)
        ].join(" ").toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [parties, search, affiliationFilter]);

  const handlePrint = () => {
    void import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
      openGenericErpReport({
        title: "Universal Party 360° Directory",
        lang,
        orientation: "landscape",
        columns: [
          { key: (r: Record<string, unknown>) => (r as any).customerCode || "-", label: "Customer Code" },
          { key: (r: Record<string, unknown>) => transliterateProperNoun((r as any).customerName, lang), label: "Full Name" },
          { key: (r: Record<string, unknown>) => (r as any).fatherName ? transliterateProperNoun((r as any).fatherName, lang) : "-", label: "Father Name" },
          { key: (r: Record<string, unknown>) => (r as any).countryName || "-", label: "Country" },
          { key: (r: Record<string, unknown>) => (r as any).cityName || "-", label: "City" },
          { key: (r: Record<string, unknown>) => (r as any).address || "-", label: "Address" },
          { key: (r: Record<string, unknown>) => ((r as any).companies || []).length, label: "Companies", align: "right", format: "number" },
          { key: (r: Record<string, unknown>) => ((r as any).companies || []).map((c: any) => c.name).join(", ") || "-", label: "Company Names" },
          { key: (r: Record<string, unknown>) => ((r as any).employees || []).map((e: any) => e.employeeCode).join(", ") || "-", label: "Employee Codes" },
          { key: (r: Record<string, unknown>) => ((r as any).banks || []).length, label: "Banks", align: "right", format: "number" },
        ],
        rows: filteredParties as unknown as Record<string, unknown>[],
        filters: [
          { label: "Affiliation", value: affiliationFilter === "all" ? "All" : affiliationFilter },
          ...(search ? [{ label: "Search", value: search }] : []),
          { label: "Records", value: String(filteredParties.length) },
        ],
      });
    });
  };

  const handleExportCSV = () => {
    const headers = ["S.No", "Customer Code", "Full Name", "Father Name", "Country", "City", "Address", "Companies Count", "Companies Names", "Employee Code", "Banks Count"];
    const rows = filteredParties.map((p, idx) => [
      idx + 1,
      p.customerCode || "-",
      transliterateProperNoun(p.customerName, lang),
      p.fatherName ? transliterateProperNoun(p.fatherName, lang) : "-",
      p.countryName || "-",
      p.cityName || "-",
      `"${(p.address || "-").replace(/"/g, '""')}"`,
      p.companies.length,
      `"${p.companies.map(c => c.name).join(", ").replace(/"/g, '""')}"`,
      p.employees.map(e => e.employeeCode).join(", ") || "-",
      p.banks.length
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Universal_Party_360_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Top Banner and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md text-indigo-300">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
              {t(lang, "upd.master_intel_report", "Master Unified Intelligence Report")}
            </span>
            <h1 className="text-xl font-black tracking-tight text-white">
              {t(lang, "upd.title", "Master Entities & 360° Parties Universal Directory")}
            </h1>
            <p className="text-xs text-slate-300">
              {t(lang, "upd.subtitle", "Centralized unified cross-module directory linking persons to companies, employment, and bank accounts")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchDirectory}
            className="h-9 gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t(lang, "upd.refresh", "Refresh")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl text-xs font-bold shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {t(lang, "upd.export_csv", "Export CSV")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl text-xs font-bold shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            {t(lang, "upd.print_report", "Print Report")}
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 w-9 p-0 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, "upd.search_ph", "Search by name, father name, code, city, company, or employee code...")}
            className="pr-9 h-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border-slate-200"
          />
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setAffiliationFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              affiliationFilter === "all" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t(lang, "upd.all_count", "All ({n})").replace("{n}", String(parties.length))}
          </button>
          <button
            type="button"
            onClick={() => setAffiliationFilter("companies")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              affiliationFilter === "companies" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            {t(lang, "upd.company_owners", "Company Owners")}
          </button>
          <button
            type="button"
            onClick={() => setAffiliationFilter("employees")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              affiliationFilter === "employees" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            {t(lang, "upd.employees", "Employees")}
          </button>
          <button
            type="button"
            onClick={() => setAffiliationFilter("banks")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              affiliationFilter === "banks" ? "bg-amber-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            {t(lang, "upd.bank_holders", "Bank Holders")}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5">کوڈ (ID)</th>
                <th className="p-3.5">نام (Full Name)</th>
                <th className="p-3.5">ولدیت (Father Name)</th>
                <th className="p-3.5">ملک / صوبہ / شہر</th>
                <th className="p-3.5">پتہ (Address)</th>
                <th className="p-3.5 text-center">منسلک کمپنیاں</th>
                <th className="p-3.5 text-center">ملازمت / عہدہ</th>
                <th className="p-3.5 text-center">بینک اکاؤنٹس</th>
                <th className="p-3.5 text-center w-24">360° ایکشن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-r-transparent mb-2" />
                    <p className="font-bold">{t(lang, "upd.loading_directory", "Loading directory...")}</p>
                  </td>
                </tr>
              ) : filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold">
                    {t(lang, "upd.no_records", "No records found matching criteria.")}
                  </td>
                </tr>
              ) : (
                filteredParties.map((party, idx) => {
                  const urduName = transliterateProperNoun(party.customerName, lang);
                  const fatherUrdu = party.fatherName ? transliterateProperNoun(party.fatherName, lang) : "-";

                  return (
                    <tr
                      key={party.customerId || idx}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors group"
                    >
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {party.customerCode || "-"}
                      </td>

                      <td className="p-3.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{urduName}</span>
                          {party.partyType === "Owner" && (
                            <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                              👑 {t(lang, "upd.owner_badge", "Owner")}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {fatherUrdu}
                      </td>

                      <td className="p-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {[party.cityName, party.stateName, party.countryName].filter(Boolean).join(", ") || "-"}
                      </td>

                      <td className="p-3.5 text-slate-500 max-w-xs truncate">
                        {party.address || "-"}
                      </td>

                      {/* Linked Companies */}
                      <td className="p-3.5 text-center">
                        {party.companies.length > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{party.companies.length}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Linked Employees */}
                      <td className="p-3.5 text-center">
                        {party.employees.length > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            <span>{party.employees[0].employeeCode}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Linked Banks */}
                      <td className="p-3.5 text-center">
                        {party.banks.length > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold text-xs">
                            <Landmark className="h-3.5 w-3.5 shrink-0" />
                            <span>{party.banks.length}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 360 Action Button */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setSelectedParty({ id: party.customerId, name: party.customerName })}
                          className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-xs gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{t(lang, "upd.dossier_360", "360°")}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 font-bold">
          <span>
            {t(lang, "upd.total_parties", "Total Parties: {n}").replace("{n}", String(filteredParties.length))}
          </span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {t(lang, "upd.click_hint", "💡 Click (+) on any row to open the complete 360° dossier.")}
          </span>
        </div>
      </div>

      {/* 360 Profile Dossier Modal */}
      {selectedParty && (
        <Party360Modal
          customerId={selectedParty.id}
          name={selectedParty.name}
          lang={lang}
          onClose={() => setSelectedParty(null)}
        />
      )}
    </div>
  );
}
