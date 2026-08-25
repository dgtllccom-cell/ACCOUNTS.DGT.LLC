"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  Briefcase,
  Landmark,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  X,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { PartyAffiliationSummary } from "@/lib/services/party-360-service";
import { Button } from "@/components/ui/button";

export type Party360ModalProps = {
  customerId?: string;
  name?: string;
  employeeId?: string;
  lang?: SupportedLanguage;
  onClose: () => void;
};

export function Party360Modal({
  customerId,
  name,
  employeeId,
  lang = "ur",
  onClose
}: Party360ModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PartyAffiliationSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "companies" | "employees" | "banks">("all");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (customerId) queryParams.set("customerId", customerId);
        if (name) queryParams.set("name", name);
        if (employeeId) queryParams.set("employeeId", employeeId);
        queryParams.set("lang", lang);

        const res = await apiGet<{ summary: PartyAffiliationSummary }>(
          `/api/erp/parties/360-summary?${queryParams.toString()}`
        );
        if (isMounted && res?.summary) {
          setSummary(res.summary);
        }
      } catch (err) {
        console.error("Failed to load Party 360 summary:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [customerId, name, employeeId, lang]);

  const displayName = summary?.customerName || name || "Party 360";
  const urduName = transliterateProperNoun(displayName, lang);
  const fatherName = summary?.fatherName ? transliterateProperNoun(summary.fatherName, lang) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {lang === "ur" ? "پرسن ماسٹر — ای آر پی لنکس" : "Person Master — ERP Links & Registration Details"}
                </span>
                {summary?.customerCode && (
                  <span className="rounded-md bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    {summary.customerCode}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                {urduName}
                {fatherName && (
                  <span className="text-xs font-semibold text-slate-500 mr-2">
                    ({lang === "ur" ? `ولدیت: ${fatherName}` : `S/o: ${fatherName}`})
                  </span>
                )}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-r-transparent" />
              <p className="text-xs font-bold text-slate-500">
                {lang === "ur" ? "ماسٹر ہستی کی تمام شاخوں کا ریکارڈ اکٹھا کیا جا رہا ہے..." : "Aggregating 360° cross-system records..."}
              </p>
            </div>
          ) : !summary ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              {lang === "ur" ? "کوئی منسلک ریکارڈ دریافت نہیں ہو سکا۔" : "No cross-module linkages found."}
            </div>
          ) : (
            <>
              {/* Top Overview KPI Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Companies Count */}
                <div 
                  onClick={() => setActiveTab("companies")}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    activeTab === "companies" 
                      ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-sm" 
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                    <span className="text-[11px] font-black uppercase">
                      {lang === "ur" ? "کمپنیاں" : "Companies"}
                    </span>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.companies.length}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {lang === "ur" ? "بطور مالک / ڈائریکٹر" : "As Owner / Director"}
                  </p>
                </div>

                {/* Employee Records */}
                <div 
                  onClick={() => setActiveTab("employees")}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    activeTab === "employees" 
                      ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-sm" 
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                    <span className="text-[11px] font-black uppercase">
                      {lang === "ur" ? "ملازمت" : "Employment"}
                    </span>
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.employees.length}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {summary.employees[0]?.employeeCode || (lang === "ur" ? "کوئی ملازم نہیں" : "Not Staff")}
                  </p>
                </div>

                {/* Banks Count */}
                <div 
                  onClick={() => setActiveTab("banks")}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    activeTab === "banks" 
                      ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 shadow-sm" 
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                    <span className="text-[11px] font-black uppercase">
                      {lang === "ur" ? "بینک اکاؤنٹس" : "Bank Accounts"}
                    </span>
                    <Landmark className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {summary.banks.length}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {lang === "ur" ? "کھاتہ جات" : "Active Master Banks"}
                  </p>
                </div>

                {/* Customer Account */}
                <div 
                  onClick={() => setActiveTab("all")}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                    <span className="text-[11px] font-black uppercase">
                      {lang === "ur" ? "پارٹی قسم" : "Party Type"}
                    </span>
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {summary.partyType || "Customer"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {summary.cityName || summary.countryName || "-"}
                  </p>
                </div>
              </div>

              {/* Personal Contact & Location Dossier Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang === "ur" ? "📍 مرکزی شناختی و رابطے کی تفصیلات" : "📍 Master Identity & Contact Details"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>{summary.mobile || summary.phone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">{summary.email || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {[summary.address, summary.cityName, summary.stateName, summary.countryName].filter(Boolean).join(", ") || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Companies Owned / Managed */}
              {(activeTab === "all" || activeTab === "companies") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {lang === "ur" ? `🏢 رجسٹرڈ کمپنیاں (${summary.companies.length})` : `🏢 Registered Sister & Owned Companies (${summary.companies.length})`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/dashboard/settings/company-setup` as Route);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {lang === "ur" ? "نئی سسٹر کمپنی بنائیں" : "+ New Sister Company"}
                    </button>
                  </div>

                  {summary.companies.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {summary.companies.map((co, idx) => (
                        <div
                          key={co.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-slate-900 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-black text-xs">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {localizeTerm(co.name, lang)}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {[co.businessType, co.cityName, co.countryName].filter(Boolean).join(" • ")}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              router.push(`/dashboard/settings/company-setup?companyId=${co.id}` as Route);
                            }}
                            className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg cursor-pointer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl">
                      {lang === "ur" ? "اس فرد کے نام پر ابھی کوئی کمپنی رجسٹرڈ نہیں ہے۔" : "No registered companies linked to this entity."}
                    </p>
                  )}
                </div>
              )}

              {/* Section 2: Employee Records */}
              {(activeTab === "all" || activeTab === "employees") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {lang === "ur" ? `👔 ملازم و عملہ ریکارڈ (${summary.employees.length})` : `👔 Employee & Staff Records (${summary.employees.length})`}
                      </h3>
                    </div>
                  </div>

                  {summary.employees.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {summary.employees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-mono font-bold text-xs">
                              {emp.employeeCode.slice(-3)}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {transliterateProperNoun(emp.fullName, lang)}
                                </span>
                                <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-700">
                                  {emp.employeeCode}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate">
                                {[emp.jobTitle, emp.department, emp.branchName].filter(Boolean).join(" • ")}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {emp.status || "Active"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                router.push(`/dashboard/general-office/employees?employeeId=${emp.id}` as Route);
                              }}
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg cursor-pointer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl">
                      {lang === "ur" ? "یہ فرد بطور ملازم رجسٹرڈ نہیں ہے۔" : "No employee profile registered for this entity."}
                    </p>
                  )}
                </div>
              )}

              {/* Section 3: Bank Master Accounts */}
              {(activeTab === "all" || activeTab === "banks") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-amber-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {lang === "ur" ? `🏦 منسلک بینک اکاؤنٹس (${summary.banks.length})` : `🏦 Linked Bank Accounts (${summary.banks.length})`}
                      </h3>
                    </div>
                  </div>

                  {summary.banks.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {summary.banks.map((bnk) => (
                        <div
                          key={bnk.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-white dark:bg-slate-900 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-bold text-xs">
                              {bnk.currency || "$"}
                            </div>
                            <div className="truncate">
                              <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {localizeTerm(bnk.bankName, lang)}
                              </p>
                              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                {bnk.accountNumber || "-"}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            {bnk.accountStatus || "Active"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl">
                      {lang === "ur" ? "کوئی منسلک بینک اکاؤنٹ نہیں ملا۔" : "No linked bank accounts found."}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 px-6 py-3.5 bg-slate-50/70 dark:bg-slate-950/50">
          <p className="text-[11px] text-slate-500 font-medium">
            {lang === "ur" ? "💡 تمام ریکارڈز ڈیٹا بیس سے خودکار مربوط ہیں۔" : "💡 All linkages automatically unified from Master Database."}
          </p>
          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            {lang === "ur" ? "بند کریں" : "Close"}
          </Button>
        </div>
      </div>
    </div>
  );
}
