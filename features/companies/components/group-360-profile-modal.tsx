"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Globe,
  Printer,
  PencilLine,
  X,
  Plus,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Clock,
  Layers,
  Landmark,
  BadgeCheck,
  Building,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { localizeTerm } from "@/lib/i18n/transliteration";
import { openCompany360Report } from "@/lib/reports/open-company-360-report-window";
import { openMasterProfile } from "@/lib/reports/master-profiles";

export type GroupCompanyItem = {
  id: string;
  name: string;
  legal_name?: string;
  name_ur?: string;
  company_code?: string;
  business_type?: string;
  base_currency?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  contacts?: Array<{ type: string; value: string }>;
  registrations?: Array<{ type: string; value: string }>;
  is_active?: boolean;
  created_at?: string;
  raw?: any;
};

export type GroupProfileData = {
  id: string;
  groupAccountNo: string;
  consortiumName: string;
  branchRules: string;
  ownerPersonId?: string;
  ownerName: string;
  managerPersonId?: string;
  managerName?: string;
  primaryContact: string;
  email: string;
  country: string;
  state: string;
  city: string;
  address: string;
  companies: GroupCompanyItem[];
  totalCompaniesCount: number;
  totalContractsCount: number;
  raw?: any;
};

export type Group360ProfileModalProps = {
  group: GroupProfileData;
  lang?: string;
  onClose: () => void;
  onEditCompany?: (companyId: string) => void;
  onRegisterSisterCompany?: (ownerPersonId?: string) => void;
};

export function Group360ProfileModal({
  group,
  lang: langProp,
  onClose,
  onEditCompany,
  onRegisterSisterCompany
}: Group360ProfileModalProps) {
  const activeLang = useActiveLanguage() || langProp || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

  const [activeTab, setActiveTab] = useState<
    "summary" | "companies" | "contacts" | "contracts" | "accounts" | "documents" | "audit"
  >("summary");

  const [selectedCompanyForPreview, setSelectedCompanyForPreview] = useState<GroupCompanyItem | null>(null);

  // Distinct currencies across the group
  const currencies = Array.from(
    new Set(group.companies.map((c) => c.base_currency).filter(Boolean))
  );

  // All registrations across the group
  const allRegistrations = group.companies.flatMap((c) =>
    (c.registrations || []).map((reg) => ({
      ...reg,
      companyId: c.id,
      companyName: c.name,
      companyCode: c.company_code || c.id
    }))
  );

  // All contacts across the group
  const allContacts = group.companies.flatMap((c) =>
    (c.contacts || []).map((cnt) => ({
      ...cnt,
      companyId: c.id,
      companyName: c.name
    }))
  );

  // Print Group Master Profile
  const handlePrintGroupMaster = () => {
    const primaryComp = group.companies[0] || group;
    void openMasterProfile({
      entity: "company",
      lang: activeLang as never,
      autoPrint: true,
      record: {
        id: group.id,
        name: group.consortiumName,
        code: group.groupAccountNo,
        legal_name: group.consortiumName,
        base_currency: currencies[0] || "USD",
        business_type: "Corporate Consortium / Holding Group",
        owner_name: group.ownerName,
        is_active: true,
        country_name: group.country,
        state_name: group.state,
        city_name: group.city,
        address: group.address,
        contacts: [{ type: "Mobile Number", value: group.primaryContact }, { type: "Email Address", value: group.email }],
        registrations: allRegistrations.map((r) => ({ type: r.type, value: r.value })),
        relatedAccounts: group.companies.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.company_code,
          role: "Sister Company"
        }))
      },
      scope: {
        countryName: group.country,
        branchName: "Main Consortium"
      }
    });
  };

  // Print Individual Company Master Profile
  const handlePrintCompany = (comp: GroupCompanyItem) => {
    void openMasterProfile({
      entity: "company",
      lang: activeLang as never,
      autoPrint: true,
      record: {
        id: comp.id,
        name: comp.name,
        code: comp.company_code || comp.id,
        legal_name: comp.legal_name || comp.name,
        base_currency: comp.base_currency || "USD",
        business_type: comp.business_type || "LLC",
        owner_name: group.ownerName,
        is_active: comp.is_active !== false,
        created_at: comp.created_at,
        country_name: comp.country || group.country,
        state_name: comp.state || group.state,
        city_name: comp.city || group.city,
        address: comp.address || group.address,
        contacts: comp.contacts,
        registrations: comp.registrations
      },
      scope: {
        countryName: comp.country || group.country,
        branchName: comp.city || group.city
      }
    });
  };

  // Print 360 Dossier for Individual Company
  const handlePrintCompanyDossier = (comp: GroupCompanyItem) => {
    openCompany360Report({
      company: {
        id: comp.id,
        accountNo: comp.company_code || comp.id,
        name: comp.name,
        legalName: comp.legal_name || comp.name,
        nameUrdu: comp.name_ur || comp.name,
        businessType: comp.business_type || "LLC",
        natureOfBusiness: "Trading & Commercial Operations",
        registrationType: comp.registrations?.[0]?.type || "Trade License",
        licenseNumber: comp.registrations?.[0]?.value || "—",
        baseCurrency: comp.base_currency || "USD",
        countryName: comp.country || group.country,
        stateName: comp.state || group.state,
        cityName: comp.city || group.city,
        address: comp.address || group.address,
        phone: comp.contacts?.find((c) => c.type.toLowerCase().includes("mobile") || c.type.toLowerCase().includes("phone"))?.value || group.primaryContact,
        email: comp.contacts?.find((c) => c.type.toLowerCase().includes("email"))?.value || group.email,
        branchRules: group.branchRules,
        mainBranchName: "Main Operations",
        companyCode: comp.company_code || "CMP-001"
      },
      owner: {
        name: group.ownerName,
        fatherName: "—",
        customerCode: "CUST-OWNER",
        employeeCode: "EMP-0010",
        phone: group.primaryContact,
        email: group.email,
        country: group.country,
        city: group.city,
        address: group.address
      },
      sisterCompanies: group.companies.map((c) => ({
        id: c.id,
        name: c.name,
        companyCode: c.company_code,
        currency: c.base_currency
      })),
      banks: [],
      lang: activeLang
    });
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-5xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ── MODAL HEADER BANNER ── */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white p-5 sm:p-6 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8 rtl:pr-0 rtl:pl-8">
            <div className="flex items-center gap-3.5">
              <div className="h-13 w-13 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-md shrink-0 shadow-lg">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {localizeTerm(group.consortiumName, activeLang)}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 border border-white/30 text-white backdrop-blur-xs">
                    {group.totalCompaniesCount} {activeLang === "ur" ? "کمپنیاں" : "Sister Companies"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                    Active Consortium
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-blue-100 font-medium mt-1 flex-wrap">
                  <span className="font-mono bg-black/20 px-2 py-0.5 rounded-md">
                    Account #{group.groupAccountNo}
                  </span>
                  <span>•</span>
                  <span>{localizeTerm(group.branchRules, activeLang)}</span>
                  <span>•</span>
                  <span>Owner: <strong className="text-white">{localizeTerm(group.ownerName, activeLang)}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintGroupMaster}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-bold gap-1.5 cursor-pointer backdrop-blur-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{activeLang === "ur" ? "پرنٹ پروفائل" : "Print Dossier"}</span>
              </Button>

              {onRegisterSisterCompany && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onRegisterSisterCompany(group.ownerPersonId);
                  }}
                  className="bg-white hover:bg-blue-50 text-blue-900 text-xs font-bold gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{activeLang === "ur" ? "+ سسٹر کمپنی" : "+ Sister Company"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* ── 7-TAB NAVIGATION BAR ── */}
          <div className="flex items-center gap-1.5 mt-6 overflow-x-auto pb-1 scrollbar-none text-xs font-bold border-t border-white/15 pt-3">
            {[
              { id: "summary", label: activeLang === "ur" ? "گروپ سمری" : "Group Summary", icon: Building2 },
              { id: "companies", label: `${activeLang === "ur" ? "کمپنیوں کی فہرست" : "Companies List"} (${group.totalCompaniesCount})`, icon: Layers },
              { id: "contacts", label: `${activeLang === "ur" ? "رابطے" : "Contacts"} (${allContacts.length})`, icon: Phone },
              { id: "contracts", label: `${activeLang === "ur" ? "لائسنس و معاہدے" : "Contracts & Licenses"} (${allRegistrations.length})`, icon: FileText },
              { id: "accounts", label: activeLang === "ur" ? "بینک و لیجر" : "Linked Accounts", icon: Landmark },
              { id: "documents", label: activeLang === "ur" ? "دستاویزات" : "Documents & Dossier", icon: BadgeCheck },
              { id: "audit", label: activeLang === "ur" ? "آڈٹ ٹریل" : "Audit / History", icon: Clock },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap",
                    active
                      ? "bg-white text-blue-900 shadow-md font-black"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB CONTENT BODY (SCROLLABLE) ── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-slate-900 dark:text-slate-100 font-sans">
          
          {/* TAB 1: GROUP SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              {/* 4 Pastel / Glass KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">Sister Companies</div>
                    <div className="text-2xl font-black text-blue-950 dark:text-blue-100">{group.totalCompaniesCount}</div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-400">Under this Consortium</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/50 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-purple-800 dark:text-purple-300">Total Contracts/Licenses</div>
                    <div className="text-2xl font-black text-purple-950 dark:text-purple-100">{group.totalContractsCount}</div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-400">Trade Lic., VAT & CR</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Active Currencies</div>
                    <div className="text-lg font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-1">
                      {currencies.length > 0 ? currencies.join(", ") : "USD"}
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Multi-Currency Base</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">Consortium Status</div>
                    <div className="text-lg font-black text-amber-950 dark:text-amber-100">Verified & Active</div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400">Compliant Enterprise</div>
                  </div>
                </div>
              </div>

              {/* Stakeholder Details: Owner & Manager Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Principal Owner / Investor Card */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center font-bold">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">Selected Owner / Investor</div>
                        <div className="text-[10px] text-muted-foreground">Principal Stakeholder</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Primary Owner
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Full Name:</span>
                      <strong className="text-slate-900 dark:text-slate-100">{localizeTerm(group.ownerName, activeLang)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Mobile:</span>
                      <div className="flex items-center gap-1.5" dir="ltr">
                        <span className="font-mono font-bold">{group.primaryContact}</span>
                        {group.primaryContact && group.primaryContact !== "—" && (
                          <a
                            href={`https://wa.me/${group.primaryContact.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-600 hover:text-green-700"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Official Email:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">{group.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registered Country:</span>
                      <span>{group.country || "United Arab Emirates"}</span>
                    </div>
                  </div>
                </div>

                {/* Company Manager Details */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center font-bold">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">Selected Company Manager</div>
                        <div className="text-[10px] text-muted-foreground">Authorized Signatory</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Authorized
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manager Name:</span>
                      <strong className="text-slate-900 dark:text-slate-100">{localizeTerm(group.managerName || group.ownerName, activeLang)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manager ID/Code:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">MGR-0010</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mobile Contact:</span>
                      <span className="font-mono font-bold" dir="ltr">{group.primaryContact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location / City:</span>
                      <span>{group.city || "Dubai"}, {group.country || "UAE"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group Registered Address & Branch Rules */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  <span>Consortium Headquarters & Branch Policy</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Branch Rules:</span>
                    <div className="font-bold text-blue-600 dark:text-blue-400">{localizeTerm(group.branchRules, activeLang)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-0.5 md:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Head Office Address:</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300">{group.address || "Main Commercial Plaza"}, {group.city}, {group.country}</div>
                  </div>
                </div>
              </div>

              {/* Sister Companies Quick Overview Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    <span>Sister Companies Under This Owner ({group.companies.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab("companies")}
                    className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    View Detailed Cards →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.companies.map((comp, i) => (
                    <div
                      key={comp.id}
                      onClick={() => setSelectedCompanyForPreview(comp)}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-300 hover:shadow-md transition cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{i + 1}</span>
                          <div className="font-black text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition">
                            {localizeTerm(comp.name, activeLang)}
                          </div>
                          {comp.legal_name && comp.legal_name !== comp.name && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                              {comp.legal_name}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                          {comp.base_currency || "USD"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-mono">{comp.company_code || "CMP-CODE"}</span>
                        <span className="text-emerald-600 font-bold">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPANIES LIST (FULL DETAILED CARDS & ACTIONS) */}
          {activeTab === "companies" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Sister Companies Directory ({group.companies.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All legal operating entities, retail shops, and corporate branches under {group.consortiumName}
                  </p>
                </div>

                {onRegisterSisterCompany && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onRegisterSisterCompany(group.ownerPersonId);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{activeLang === "ur" ? "نئی سسٹر کمپنی رجسٹر کریں" : "Add Sister Company"}</span>
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {group.companies.map((comp, idx) => {
                  const compMobile = comp.contacts?.find((c) => c.type.toLowerCase().includes("mobile") || c.type.toLowerCase().includes("phone"))?.value || group.primaryContact;
                  const compEmail = comp.contacts?.find((c) => c.type.toLowerCase().includes("email"))?.value || group.email;
                  const primaryLic = comp.registrations?.[0];

                  return (
                    <div
                      key={comp.id}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs hover:shadow-md transition space-y-3.5"
                    >
                      {/* Top row: Name, Currency, Code, Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200 dark:border-blue-900">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                {localizeTerm(comp.name, activeLang)}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300">
                                {comp.base_currency || "USD"}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                {comp.business_type || "LLC"}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {comp.legal_name && comp.legal_name !== comp.name ? comp.legal_name : "General Commercial Operations"} • Code: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{comp.company_code || "CMP-001"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons for this specific company */}
                        <div className="flex items-center gap-2 shrink-0">
                          {onEditCompany && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onClose();
                                onEditCompany(comp.id);
                              }}
                              className="h-8 px-2.5 text-xs font-bold gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              <span>{activeLang === "ur" ? "ترمیم" : "Edit"}</span>
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintCompany(comp)}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
                            title="Print A4 Master Profile"
                          >
                            <Printer className="h-3.5 w-3.5 text-blue-500" />
                            <span className="hidden sm:inline">Profile</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintCompanyDossier(comp)}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                            title="Print 360° Dossier"
                          >
                            <Printer className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Dossier</span>
                          </Button>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Address */}
                        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900 rounded-xl space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-rose-500" /> Location / Address
                          </span>
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {comp.address || group.address || "—"}, {comp.city || group.city}
                          </div>
                        </div>

                        {/* Contacts */}
                        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900 rounded-xl space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-500" /> Direct Contacts
                          </span>
                          <div className="flex items-center gap-2" dir="ltr">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{compMobile}</span>
                            {compMobile && compMobile !== "—" && (
                              <a
                                href={`https://wa.me/${compMobile.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-600 hover:text-green-700"
                                title="WhatsApp"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Licenses */}
                        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900 rounded-xl space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3 text-purple-500" /> Primary License / TRN
                          </span>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {primaryLic ? `${primaryLic.type}: ${primaryLic.value}` : "Active Commercial Record"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS BOOK */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Consortium Directory & Direct Contact Book
                </h3>
                <p className="text-xs text-muted-foreground">
                  All communication channels across {group.consortiumName} and its sister companies
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Entity / Stakeholder</th>
                      <th className="p-3">Contact Type</th>
                      <th className="p-3">Value</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr className="bg-blue-50/30 dark:bg-blue-950/20">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {group.ownerName} (Owner / Investor)
                      </td>
                      <td className="p-3 text-slate-600">Primary Mobile</td>
                      <td className="p-3 font-mono font-bold" dir="ltr">{group.primaryContact}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5" dir="ltr">
                          <a href={`tel:${group.primaryContact}`} className="p-1 rounded bg-emerald-100 text-emerald-700">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          <a href={`https://wa.me/${group.primaryContact.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-green-100 text-green-700">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                    {allContacts.map((c, i) => (
                      <tr key={i}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{c.companyName}</td>
                        <td className="p-3 text-slate-600">{c.type}</td>
                        <td className="p-3 font-mono font-bold" dir="ltr">{c.value}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5" dir="ltr">
                            {c.type.toLowerCase().includes("email") ? (
                              <a href={`mailto:${c.value}`} className="p-1 rounded bg-blue-100 text-blue-700">
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <>
                                <a href={`tel:${c.value}`} className="p-1 rounded bg-emerald-100 text-emerald-700">
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                                <a href={`https://wa.me/${c.value.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-green-100 text-green-700">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CONTRACTS & LICENSES */}
          {activeTab === "contracts" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Registrations, Trade Licenses & Tax IDs ({allRegistrations.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Official corporate licenses, VAT/TRN identifiers, and commercial records across all sister companies
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-3 text-center w-10">#</th>
                      <th className="p-3">Sister Company</th>
                      <th className="p-3">License / Contract Type</th>
                      <th className="p-3">Registration Number / ID</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allRegistrations.map((reg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          {reg.companyName}
                          <span className="block text-[10px] text-muted-foreground font-mono">{reg.companyCode}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{reg.type}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{reg.value}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: LINKED ACCOUNTS & BANKS */}
          {activeTab === "accounts" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Linked Bank Accounts & Corporate Ledgers
                </h3>
                <p className="text-xs text-muted-foreground">
                  Financial ledger connections, multicurrency operating accounts, and bank links
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currencies.map((curr) => (
                  <div key={curr} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-black text-xs">{curr} Operating Ledger</div>
                          <div className="text-[10px] text-muted-foreground">Main Settlement Currency</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-emerald-600">Active</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                      <span>Account Class:</span>
                      <strong className="text-slate-800 dark:text-slate-200">Asset / Operating Bank</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: DOCUMENTS & DOSSIER */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Official Dossiers & Registration Documents
                </h3>
                <p className="text-xs text-muted-foreground">
                  Export, view and print official company documents, 360 dossiers, and certificates
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Printer className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm">Group Master Profile (A4)</h4>
                      <p className="text-[10px] text-muted-foreground">Official consortium record with all sister entities</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handlePrintGroupMaster}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Group Master Profile</span>
                  </Button>
                </div>

                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm">Consortium Compliance Certificate</h4>
                      <p className="text-[10px] text-muted-foreground">360° corporate structure and shareholding breakdown</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handlePrintGroupMaster}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Generate Compliance Dossier</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT & HISTORY */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Consortium Audit Trail & System Log
                </h3>
                <p className="text-xs text-muted-foreground">
                  Immutable record of registration and updates on ERP
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">Consortium Registered</div>
                    <div className="text-muted-foreground">Created by Super Admin • Master Serial: {group.groupAccountNo}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Status: Verified in Database</div>
                  </div>
                </div>

                {group.companies.map((c, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Building className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100">Sister Company Added: {c.name}</div>
                      <div className="text-muted-foreground">Code: {c.company_code} • Currency: {c.base_currency}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.created_at || "Active Record"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Account #{group.groupAccountNo} • {group.totalCompaniesCount} Sister Companies Registered
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintGroupMaster}
              className="text-xs font-bold gap-1.5 cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{activeLang === "ur" ? "پرنٹ پروفائل" : "Print Master Profile"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 cursor-pointer"
            >
              {activeLang === "ur" ? "بند کریں" : "Close"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
