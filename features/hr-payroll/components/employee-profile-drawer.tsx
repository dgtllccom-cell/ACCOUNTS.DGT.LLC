"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Award,
  Edit3,
  Layers,
  Calendar,
  ShieldCheck,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Printer,
  X,
  MessageSquare
} from "lucide-react";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { printEmployeeCertificate } from "@/components/ui/employee-certificate-print";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface EmployeeProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  onEdit?: (id: string) => void;
  onOpen360?: (personId: string) => void;
  onOpenLoan?: (emp: any) => void;
}

export function EmployeeProfileDrawer({
  isOpen,
  onClose,
  employeeId,
  onEdit,
  onOpen360,
  onOpenLoan
}: EmployeeProfileDrawerProps) {
  const lang = useActiveLanguage();
  const th = (s: string) => translateHeader(lang, s);
  const [emp, setEmp] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !employeeId) {
      setEmp(null);
      return;
    }

    let active = true;
    setLoading(true);

    apiGet<{ employee: any }>(`/api/erp/hr-payroll/employees/${employeeId}`)
      .then((res) => {
        if (!active) return;
        setEmp(res.employee || null);
      })
      .catch((err) => {
        console.error("Failed to load employee profile:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, employeeId]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!emp) return;
    let company: any = {};
    try {
      const r = await fetch(`/api/erp/branding?countryId=${emp.country_id ?? ""}`);
      const j = await r.json();
      if (j?.branding) {
        company = {
          name: j.branding.companyName,
          logoUrl: j.branding.logoUrl,
          stampUrl: j.branding.stampUrl,
          certificateHeader: j.branding.certificateHeader,
          hrManagerName: j.branding.hrManagerName,
          address: j.branding.address,
          country: j.branding.countryName,
          branch: emp.country_branch?.name || emp.city_branch?.name || null
        };
      }
    } catch {
      // fallback
    }

    printEmployeeCertificate(
      {
        employeeId: emp.employee_code,
        name: emp.person?.customer_name,
        photoUrl: emp.person?.photo_url || emp.photo_url || null,
        cnicPassport: emp.person?.cnic || emp.person?.passport || emp.cnic_passport || null,
        department: emp.department,
        designation: emp.designation,
        joiningDate: emp.joining_date,
        employmentType: emp.employment_type || emp.category,
        status: emp.status,
        nationality: emp.person?.nationality,
        address: emp.person?.address || emp.address,
        mobile: emp.person?.mobile,
        email: emp.person?.email,
        emergencyContact: emp.person?.emergency_contact || emp.person?.whatsapp,
        salary: emp.salary || emp.net_salary ? `${emp.net_salary || emp.salary} ${emp.salary_currency || "USD"}` : null,
        reportingManager: emp.reporting_manager_name || emp.reporting_manager?.customer_name || null,
        serials: {
          superAdmin: emp.super_admin_serial || emp.employee_code,
          country: emp.country_serial,
          branch: emp.branch_serial,
          entry: emp.entry_serial
        }
      },
      company
    );
  };

  const person = emp?.person || {};
  const country = emp?.country || {};
  const mainBranch = emp?.country_branch || {};
  const cityBranch = emp?.city_branch || {};

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={emp ? `${emp.person?.customer_name || emp.name || th("Employee")} — ${th("Dossier")}` : th("Employee Profile Details")}
      subtitle={th("Enterprise Employee Registry, Identity, Branch Assignment & Payroll Verification")}
    >
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
          {th("Loading employee dossier and verified records")}...
        </div>
      ) : !emp ? (
        <div className="p-8 text-center text-slate-500">
          {th("Employee profile could not be loaded.")}
        </div>
      ) : (
        <div className="space-y-5 p-2 font-sans text-xs">
          {/* Action Toolbar on Top of Drawer */}
          <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                className="h-8 text-xs font-bold gap-1.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-xs hover:bg-slate-100"
              >
                <Printer className="h-3.5 w-3.5 text-blue-600" />
                <span>{th("Print Certificate")}</span>
              </Button>
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onEdit(emp.id);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-xs hover:bg-slate-100"
                >
                  <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{th("Edit Profile")}</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {onOpenLoan && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenLoan(emp)}
                  className="h-8 text-xs font-bold gap-1.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-xs hover:bg-slate-100"
                >
                  <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                  <span>{th("Loan / Adv")}</span>
                </Button>
              )}
              {onOpen360 && person.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpen360(person.id)}
                  className="h-8 text-xs font-bold gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 shadow-xs"
                >
                  <Layers className="h-3.5 w-3.5 text-purple-600" />
                  <span>{th("360 Links")}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Primary Identity Card */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                {person.customer_name?.charAt(0) || emp.name?.charAt(0) || "E"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {person.customer_name || emp.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full ${
                      emp.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {emp.status || "Active"}
                  </Badge>
                </div>
                {person.father_name && (
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    S/O {person.father_name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md text-[11px] border border-blue-200 dark:border-blue-800">
                    {emp.employee_code}
                  </span>
                  {person.person_code && (
                    <span className="font-mono font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                      {person.person_code}
                    </span>
                  )}
                  <span className="font-bold text-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px] uppercase">
                    {emp.category || "Staff"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Level Serial Numbers Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              4-Level ERP Serial Tracking
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">1. Super Admin</div>
                <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                  {emp.super_admin_serial || emp.employee_code}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">2. Country Serial</div>
                <div className="font-mono font-extrabold text-blue-600 dark:text-blue-400 truncate mt-0.5">
                  {emp.country_serial || `CS-${emp.employee_code?.slice(-4) || "0001"}`}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">3. Branch Serial</div>
                <div className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  {emp.branch_serial || `BS-${emp.employee_code?.slice(-4) || "0001"}`}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">4. Entry Serial</div>
                <div className="font-mono font-extrabold text-purple-600 dark:text-purple-400 truncate mt-0.5">
                  {emp.entry_serial || `ES-${emp.employee_code?.slice(-4) || "0001"}`}
                </div>
              </div>
            </div>
          </div>

          {/* Location & Reporting Hierarchy */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {th("Location & Reporting Structure")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Country")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{country.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Main Branch")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {mainBranch.name || "N/A"} {mainBranch.code ? `(${mainBranch.code})` : ""}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("City Branch")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {cityBranch.name || "N/A"} {cityBranch.code ? `(${cityBranch.code})` : ""}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Reporting Manager")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {emp.reporting_manager_name || emp.reporting_manager?.customer_name || "Self / Branch Head"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Designation")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{emp.designation || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Department")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{emp.department || "Executive Management"}</span>
              </div>
            </div>
          </div>

          {/* Contact Details & Verification */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {th("Contact & Identity Verification")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Mobile Number")}</span>
                {person.mobile ? (
                  <a
                    href={`tel:${person.mobile}`}
                    className="font-bold text-blue-600 hover:underline font-mono"
                  >
                    {person.mobile}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("WhatsApp")}</span>
                {person.whatsapp || person.mobile ? (
                  <a
                    href={`https://wa.me/${(person.whatsapp || person.mobile).replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-teal-600 hover:underline font-mono"
                  >
                    {person.whatsapp || person.mobile}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Email Address")}</span>
                {person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {person.email}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("National ID / Passport")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {person.cnic || person.passport || emp.cnic_passport || "—"}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">{th("Address")}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {person.address || emp.address || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Payroll, Compensation & Financials */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {th("Payroll, Salary & Deductions")}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">{th("Net Salary")}</div>
                <div className="font-mono font-black text-emerald-800 dark:text-emerald-300 text-sm mt-0.5">
                  {Number(emp.net_salary || emp.salary || 0).toLocaleString()} {emp.salary_currency || "USD"}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">{th("Basic Salary")}</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                  {Number(emp.basic_salary || emp.salary || 0).toLocaleString()} {emp.salary_currency || "USD"}
                </div>
              </div>

              <div className="p-2.5 bg-red-50/60 dark:bg-red-950/30 rounded-xl border border-red-200/80 dark:border-red-800">
                <div className="text-[9px] font-bold text-red-700 dark:text-red-400 uppercase">{th("Adv / Loan Deduction")}</div>
                <div className="font-mono font-bold text-red-700 dark:text-red-300 text-sm mt-0.5">
                  -{Number((emp.advance_deduction || 0) + (emp.loan_deduction || 0)).toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] font-bold text-slate-400 uppercase">{th("Joining Date")}</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                  {emp.joining_date || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
