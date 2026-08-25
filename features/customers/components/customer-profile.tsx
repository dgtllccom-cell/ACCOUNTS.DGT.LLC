"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, PencilLine, Printer, Download, ArrowLeft, User, MapPin, Phone, FileText, Info, Mail, MessageSquare, Columns, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getLabel } from "./translations";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";
import { Party360Modal } from "./party-360-modal";
import { Link2 } from "lucide-react";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function CustomerProfile({
  lang: langProp,
  customerId,
  isDrawer = false
}: {
  lang: SupportedLanguage;
  customerId: string;
  isDrawer?: boolean;
}) {
  const router = useRouter();
  // Prefer the reactive client-side language store over the server-rendered prop — otherwise
  // switching language after this page has loaded (without a full navigation) leaves it stuck
  // on whatever language was active at SSR time. See CLAUDE.md's i18n component pattern.
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErpLinks, setShowErpLinks] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<{ customer: CustomerRow }>(`/api/erp/customers/${customerId}`);
        setCustomer(res.customer);
      } catch (e: any) {
        setError(e.message || getLabel("failedToLoadCustomerProfile", lang));
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  const parsedMeta = useMemo(() => {
    if (!customer) return null;

    let meta = {
      customerType: customer.company_name ? "Business" : "Male",
      firstName: customer.customer_name.split(" ")[0] || customer.customer_name,
      lastName: customer.customer_name.split(" ").slice(1).join(" ") || "",
      fatherName: customer.contact_person || "",
      customerAccountNumber: "",
      country: "",
      stateProvince: "",
      city: "",
      cityCode: "-",
      contacts: [] as Array<{ type: string; value: string }>,
      documents: [] as Array<{ type: string; number: string; upload: string }>,
      status: "Active",
      remarks: customer.notes || "",
      accountName: "",
      accountNumber: "",
      manualReference: "",
      branchName: "",
      branchCode: "",
      cityBranch: "",
      companyName: "",
      companyRegNo: "",
      companyTaxNo: "",
      companyBusinessType: "Private Limited",
      companyPhone: "",
      companyEmail: "",
      companyCountry: "",
      companyCity: "",
      companyState: "",
      companyAddress: ""
    };

    if (customer.notes) {
      try {
        const parsed = JSON.parse(customer.notes);
        if (parsed && typeof parsed === "object") {
          meta = { ...meta, ...parsed };
        }
      } catch {
        // Fallback
      }
    }

    // Backwards compatibility fallbacks
    if (!meta.contacts || !meta.contacts.length) {
      const fallback = [];
      if (customer.mobile) fallback.push({ type: "Mobile", value: customer.mobile });
      if (customer.whatsapp) fallback.push({ type: "WhatsApp", value: customer.whatsapp });
      if (customer.email) fallback.push({ type: "Email", value: customer.email });
      if (fallback.length === 0) fallback.push({ type: "Mobile", value: "" });
      meta.contacts = fallback;
    }

    if (!meta.documents || !meta.documents.length) {
      meta.documents = [
        {
          type: (meta as any).documentType || "CNIC",
          number: (meta as any).documentNumber || "-",
          upload: (meta as any).documentUpload || ""
        }
      ];
    }

    // Explicitly compute customer account code derived from ID
    meta.customerAccountNumber = "CUST-" + customer.id.slice(0, 6).toUpperCase();

    return meta;
  }, [customer]);

  const isRtl = lang !== "en";

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-slate-500 font-medium">
        {getLabel("loadingCustomerProfilePreview", lang)}
      </div>
    );
  }

  if (error || !customer || !parsedMeta) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 m-6">
        {error || getLabel("customerProfileNotFound", lang)}
        <div className="mt-3">
          <Button type="button" onClick={() => router.push("/dashboard/settings/customers" as Route)}>
            {getLabel("backToList", lang)}
          </Button>
        </div>
      </div>
    );
  }

  // Dedicated A4 customer profile via the shared master-profile engine (real record data only).
  const handlePrint = () => {
    if (!customer) return;
    const tt = (key: string, fallback: string) => t(lang as never, key as never, fallback);
    const c: any = customer;
    const created = c.created_at ? new Date(c.created_at).toLocaleString() : "";
    openMasterProfileReportWindow({
      lang,
      autoPrint: true,
      title: tt("cust.report_title", "Customer Profile Report"),
      subtitle: tt("cust.report_subtitle", "Customer Profile Summary"),
      overviewLabel: tt("cust.overview", "Customer Profile Overview"),
      name: c.customer_name,
      status: c.is_active === false ? tt("acct.not_registered", "Inactive") : tt("acct.registered", "Active"),
      reportIdPrefix: "CUST",
      reportIdValue: c.customer_number || (c.id ? String(c.id).slice(0, 8).toUpperCase() : ""),
      meta: [
        { label: tt("acct.customer_code", "Customer Code"), value: c.customer_number },
        { label: tt("acct.company_name", "Company Name"), value: c.company_name },
        { label: tt("acct.country", "Country"), value: parsedMeta?.country || c.country_name },
        { label: tt("acct.city", "City"), value: c.city_name }
      ],
      sections: [
        { title: tt("cust.sec_customer", "Customer Information"), rows: [
          { label: tt("acct.customer_name", "Customer Name"), value: c.customer_name },
          { label: tt("acct.company_name", "Company Name"), value: c.company_name },
          { label: tt("cust.contact_person", "Contact Person"), value: c.contact_person },
          { label: tt("acct.customer_code", "Customer Code"), value: c.customer_number }
        ]},
        { title: tt("cust.sec_contact", "Contact Information"), rows: [
          { label: tt("acct.phone", "Phone"), value: c.mobile },
          { label: tt("branch.whatsapp", "WhatsApp"), value: c.whatsapp },
          { label: tt("acct.email", "Email"), value: c.email }
        ]},
        { title: tt("branch.sec_location", "Location & Address"), rows: [
          { label: tt("acct.address", "Address"), value: c.address },
          { label: tt("acct.city", "City"), value: c.city_name },
          { label: tt("acct.country", "Country"), value: parsedMeta?.country || c.country_name }
        ]},
        { title: tt("acct.sec_audit_info", "System / Audit Information"), rows: [
          { label: tt("acct.created_on", "Created On"), value: created },
          { label: tt("acct.reference_no", "Reference No."), value: c.customer_number }
        ]}
      ]
    });
  };

  // WhatsApp contact click Action
  const shareWhatsApp = () => {
    const primaryMobile = parsedMeta.contacts.find(c => c.type === "WhatsApp" || c.type === "Mobile")?.value || "";
    const cleanNo = primaryMobile.replace(/[^0-9]/g, "");
    if (cleanNo) {
      window.open(`https://wa.me/${cleanNo}`, "_blank");
    } else {
      alert(getLabel("noWhatsAppNumberMsg", lang));
    }
  };

  // Email contact Action
  const shareEmail = () => {
    const emailAddr = parsedMeta.contacts.find(c => c.type === "Email")?.value || customer.email || "";
    if (emailAddr) {
      window.location.href = `mailto:${emailAddr}?subject=Customer Profile Certificate&body=Please find attached details for ${customer.customer_name}`;
    } else {
      alert(getLabel("noEmailRegisteredMsg", lang));
    }
  };

  // Download Simulated Scanned Document Scan File
  const handleDownloadScan = () => {
    const doc = parsedMeta.documents[0];
    if (doc && doc.upload) {
      const blob = new Blob(["Simulated Document Scan Content for " + doc.type + "\nNumber: " + doc.number], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.upload;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert(getLabel("noDocumentFilesUploadedMsg", lang));
    }
  };

  if (isDrawer) {
    return (
      <div className="bg-white text-slate-900 p-2 relative select-text flex flex-col justify-between dark:bg-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
        {/* Subtle Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] overflow-hidden select-none">
          <Building2 className="w-[180px] h-[180px] text-slate-900 dark:text-slate-100" />
        </div>
        <div className="space-y-5">
          {/* Header branding */}
          <div className="border-b-2 border-teal-600 pb-2.5 flex items-center justify-between dark:border-teal-500">
            <div>
              <h2 className="text-sm font-extrabold text-teal-800 tracking-tight dark:text-teal-400">DAMAAN GROUP</h2>
              <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mt-0.5 dark:text-slate-400">{getLabel("enterpriseRegistry", lang)}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 border border-teal-200 uppercase dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900">
                {parsedMeta.status}
              </span>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5 dark:text-slate-400">{parsedMeta.customerAccountNumber}</p>
            </div>
          </div>

          {/* Content Grids */}
          <div className="space-y-3">
            {/* Customer Account Details Card */}
            <div className="border rounded-xl p-3 bg-slate-50/50 space-y-1.5 dark:bg-slate-900/40 dark:border-slate-800">
              <h3 className="text-[9px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1 dark:text-teal-400">{t(lang, "nav.customer_account_details", "Customer Account Details")}</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "purchase.f_account_name", "Account Name")}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{parsedMeta.accountName || customer.customer_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "bank.account_number", "Account Number")}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.accountNumber || parsedMeta.customerAccountNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "roz.cef_customer_number", "Customer Number")}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.customerAccountNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("manualReference", lang)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.manualReference || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "cdash.col_branch_name", "Branch Name")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.branchName || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "bdash.branch_code", "Branch Code")}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.branchCode || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "report.scope_city_branch", "City Branch")}</span>
                  <span className="font-bold text-slate-850 dark:text-slate-200">{parsedMeta.cityBranch || parsedMeta.city || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("countryAndState", lang)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{[parsedMeta.country, parsedMeta.stateProvince].filter(Boolean).join(", ") || "-"}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500">{t(lang, "purchase.f_address", "Address")}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right truncate max-w-[180px]" title={customer.address || ""}>{customer.address || "-"}</span>
                </div>
              </div>
            </div>

            {/* Customer Company Details Card */}
            <div className="border rounded-xl p-3 bg-slate-50/50 space-y-1.5 dark:bg-slate-900/40 dark:border-slate-800">
              <h3 className="text-[9px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1 dark:text-teal-400">{getLabel("customerCompanyDetails", lang)}</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "branch.row_company_name", "Company Name")}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{parsedMeta.companyName || customer.company_name || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "ledger.registration_number", "Registration Number")}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.companyRegNo || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("taxNtnNumber", lang)}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.companyTaxNo || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "company_form.business_type_label", "Business Type")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.companyBusinessType || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "purchase.f_phone_number", "Phone Number")}</span>
                  <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{parsedMeta.companyPhone || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("emailAddress", lang)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[120px]" title={parsedMeta.companyEmail}>{parsedMeta.companyEmail || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("country", lang)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.companyCountry || parsedMeta.country || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{getLabel("city", lang)}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.companyCity || parsedMeta.city || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 pb-1 dark:border-slate-800/50">
                  <span className="text-slate-500">{t(lang, "branch.state_label", "State")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parsedMeta.companyState || parsedMeta.stateProvince || "-"}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500">{getLabel("completeAddress", lang)}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right truncate max-w-[120px]" title={parsedMeta.companyAddress || customer.address || ""}>{parsedMeta.companyAddress || customer.address || "-"}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Contacts */}
          <div className="space-y-1.5">
            <h3 className="text-[9px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1 dark:text-teal-400">{getLabel("contacts", lang)}</h3>
            <div className="border rounded-lg overflow-hidden dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
                  <tr>
                    <Th className="px-3 py-1">{getLabel("typeLabel", lang)}</Th>
                    <Th className="px-3 py-1 font-mono">{t(lang, "god.asset_value", "Value")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {parsedMeta.contacts.map((contact, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="px-3 py-1 font-bold text-slate-700 dark:text-slate-300">{contact.type}</td>
                      <td className="px-3 py-1 font-mono text-slate-900 dark:text-slate-100">{contact.value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-1.5">
            <h3 className="text-[9px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1 dark:text-teal-400">{getLabel("documents", lang)}</h3>
            <div className="border rounded-lg overflow-hidden dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
                  <tr>
                    <Th className="px-3 py-1">{getLabel("typeLabel", lang)}</Th>
                    <Th className="px-3 py-1 font-mono">{getLabel("numberLabel", lang)}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {parsedMeta.documents.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="px-3 py-1 font-bold text-slate-700 dark:text-slate-300">{doc.type}</td>
                      <td className="px-3 py-1 font-mono text-slate-900 dark:text-slate-100">{doc.number || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          {parsedMeta.remarks && (
            <div className="space-y-1 border rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900/40 dark:border-slate-800">
              <h4 className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{getLabel("remarksRegistryNotes", lang)}</h4>
              <p className="text-xs text-slate-700 leading-relaxed font-medium dark:text-slate-300">{parsedMeta.remarks}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-800 text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* Dynamic Top Toolbar */}
      <header className="pdf-preview-toolbar bg-slate-900 h-12 flex items-center justify-between px-4 border-b border-slate-950 text-xs font-medium sticky top-0 z-50 select-none shadow-sm">
        {/* Left Side: Document Navigation */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/settings/customers" as Route)}
            className="h-8 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md gap-1.5 px-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{getLabel("backButton", lang)}</span>
          </Button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-slate-200">
            <FileText className="h-4 w-4 text-teal-500" />
            <span className="font-semibold text-slate-200">{getLabel("documentPreview", lang)}</span>
          </div>
        </div>

        {/* Center Side: Page format controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-semibold text-[10px] uppercase flex items-center gap-1.5"
          >
            <Columns className="h-3 w-3" />
            {t(lang, "pv.portrait", "Portrait")}
          </button>
          <span className="text-slate-500">{getLabel("pageOneOfOne", lang)}</span>
          <span className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-2.5 py-0.5 rounded font-bold uppercase">
            A4
          </span>
        </div>

        {/* Right Side: Quick Action PDF icons */}
        <div className="flex items-center gap-2">
          {/* WhatsApp share */}
          <button
            onClick={shareWhatsApp}
            title={getLabel("openWhatsAppChatTitle", lang)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-teal-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          {/* Email share */}
          <button
            onClick={shareEmail}
            title={getLabel("composeEmailTitle", lang)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Mail className="h-4 w-4" />
          </button>
          {/* Download first upload scan */}
          <button
            onClick={handleDownloadScan}
            title={getLabel("downloadDocumentScanTitle", lang)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <DownloadActionIcon className="h-4 w-4" />
          </button>
          {/* Edit details redirect */}
          <button
            onClick={() => router.push(`/dashboard/settings/customers/setup?customerId=${customer.id}` as Route)}
            title={getLabel("editCustomerRecordTitle", lang)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <PencilLine className="h-4 w-4" />
          </button>
          {/* ERP Links / Registration Details — every module/role this Person Master is linked to */}
          <button
            onClick={() => setShowErpLinks(true)}
            title={t(lang, "erp.person_links_title", "ERP Links / Registration Details")}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-indigo-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-slate-700" />
          {/* Print */}
          <button
            onClick={handlePrint}
            title={getLabel("printSavePdfA4Title", lang)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Preview canvas area */}
      <main className="pdf-preview-canvas flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start">
        {/* Centered A4 styled paper sheet */}
        <div className="pdf-a4-sheet bg-white text-slate-900 w-full max-w-[800px] min-h-[1130px] shadow-2xl p-10 sm:p-12 relative border border-slate-200 select-text flex flex-col justify-between">
          {/* Subtle Watermark Centered Logo in Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden select-none">
            <Building2 className="w-[300px] h-[300px] text-slate-900" />
          </div>

          <div className="space-y-8">
            {/* Header branding */}
            <div className="border-b-2 border-teal-600 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-teal-800 tracking-tight">DAMAAN BUSINESS GROUP</h2>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">{getLabel("enterpriseErpFmsPortal", lang)}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[10px] font-bold text-teal-700 border border-teal-200 uppercase">
                  {parsedMeta.status}
                </span>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{parsedMeta.customerAccountNumber}</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center py-2 bg-slate-50 border rounded-lg">
              <h1 className="text-base font-extrabold text-slate-800 uppercase tracking-widest">{getLabel("officialCustomerProfileRegistry", lang)}</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">{getLabel("databaseAuditRecordCertificateMsg", lang)}</p>
            </div>

            {/* Content Grids */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Customer Account Details Card */}
              <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3 relative">
                <div className="absolute top-3 right-3 text-teal-600/30">
                  <User className="h-6 w-6" />
                </div>
                <h3 className="text-[10px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1">{t(lang, "nav.customer_account_details", "Customer Account Details")}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "purchase.f_account_name", "Account Name")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.accountName || customer.customer_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "bank.account_number", "Account Number")}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.accountNumber || parsedMeta.customerAccountNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "roz.cef_customer_number", "Customer Number")}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.customerAccountNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("manualReference", lang)}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.manualReference || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "cdash.col_branch_name", "Branch Name")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.branchName || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "bdash.branch_code", "Branch Code")}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.branchCode || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "report.scope_city_branch", "City Branch")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.cityBranch || parsedMeta.city || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("countryAndState", lang)}</span>
                    <span className="font-bold text-slate-800">{[parsedMeta.country, parsedMeta.stateProvince].filter(Boolean).join(", ") || "-"}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-slate-500">{t(lang, "purchase.f_address", "Address")}</span>
                    <span className="font-bold text-slate-900 text-right max-w-[150px] truncate" title={customer.address || ""}>{customer.address || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Customer Company Details Card */}
              <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3 relative">
                <div className="absolute top-3 right-3 text-teal-600/30">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-[10px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1">{getLabel("customerCompanyDetails", lang)}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "branch.row_company_name", "Company Name")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.companyName || customer.company_name || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "ledger.registration_number", "Registration Number")}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.companyRegNo || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("taxNtnNumber", lang)}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.companyTaxNo || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "company_form.business_type_label", "Business Type")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.companyBusinessType || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "purchase.f_phone_number", "Phone Number")}</span>
                    <span className="font-bold text-slate-800 font-mono">{parsedMeta.companyPhone || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("emailAddress", lang)}</span>
                    <span className="font-bold text-slate-800 text-right max-w-[150px] truncate text-[11px]" title={parsedMeta.companyEmail}>{parsedMeta.companyEmail || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("country", lang)}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.companyCountry || parsedMeta.country || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{getLabel("city", lang)}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.companyCity || parsedMeta.city || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">{t(lang, "branch.state_label", "State")}</span>
                    <span className="font-bold text-slate-800">{parsedMeta.companyState || parsedMeta.stateProvince || "-"}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-slate-500">{getLabel("completeAddress", lang)}</span>
                    <span className="font-bold text-slate-900 text-right max-w-[150px] truncate" title={parsedMeta.companyAddress || customer.address || ""}>{parsedMeta.companyAddress || customer.address || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts Table style */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1">{getLabel("communicationChannels", lang)}</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                    <tr>
                      <Th className="px-4 py-2">#</Th>
                      <Th className="px-4 py-2">{getLabel("contactType", lang)}</Th>
                      <Th className="px-4 py-2 font-mono">{getLabel("contactDetailsValue", lang)}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedMeta.contacts.map((contact, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-2 font-bold text-slate-700">{contact.type}</td>
                        <td className="px-4 py-2 font-mono text-slate-900">{contact.value || "-"}</td>
                      </tr>
                    ))}
                    {parsedMeta.contacts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center italic text-slate-400">{getLabel("noContactDetailsRegistered", lang)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documents Table style */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-teal-800 uppercase tracking-wider border-b pb-1">{getLabel("registeredVerificationDocuments", lang)}</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                    <tr>
                      <Th className="px-4 py-2">#</Th>
                      <Th className="px-4 py-2">{getLabel("documentType", lang)}</Th>
                      <Th className="px-4 py-2 font-mono">{getLabel("numberLabel", lang)}</Th>
                      <Th className="px-4 py-2">{getLabel("scanAttachmentReference", lang)}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedMeta.documents.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-2 font-bold text-slate-700">{doc.type}</td>
                        <td className="px-4 py-2 font-mono text-slate-900">{doc.number || "-"}</td>
                        <td className="px-4 py-2">
                          {doc.upload ? (
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-slate-500">{doc.upload}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const blob = new Blob(["Simulated Scan Content for " + doc.type], { type: "text/plain" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = doc.upload;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }}
                                className="text-[9px] text-teal-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5 ml-2"
                              >
                                <DownloadActionIcon className="h-2.5 w-2.5" />
                                {getLabel("downloadScan", lang)}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">{getLabel("noScanUpload", lang)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {parsedMeta.documents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center italic text-slate-400">{getLabel("noDocumentsRegistered", lang)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Remarks Section */}
            {parsedMeta.remarks && (
              <div className="space-y-1.5 border rounded-lg p-3 bg-slate-50/50">
                <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{getLabel("remarksRegistryAuditorNotes", lang)}</h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">{parsedMeta.remarks}</p>
              </div>
            )}
          </div>

          {/* Footer Signature stamp block */}
          <div className="border-t pt-8 mt-12 flex justify-between text-xs select-none">
            <div className="space-y-1">
              <p className="text-slate-400 uppercase text-[9px] font-bold">{getLabel("dateOfIssuance", lang)}</p>
              <p className="font-bold text-slate-700 font-mono">
                {new Date().toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-slate-400 uppercase text-[9px] font-bold">{t(lang, "acct.authorized_signature", "Authorized Signature")}</p>
              <div className="h-8 flex items-end justify-end">
                <div className="w-32 border-b border-dashed border-slate-400" />
              </div>
              <p className="text-[9px] text-slate-400 italic">{getLabel("erpRegistrarOfficeStamp", lang)}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Global CSS Style tag to isolate printing the A4 Sheet container */}
      <style>{`
        @media print {
          html, body {
            background: none !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          .pdf-preview-toolbar {
            display: none !important;
          }
          .pdf-preview-canvas {
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }
          .pdf-a4-sheet {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      {showErpLinks ? (
        <Party360Modal
          customerId={customer.id}
          lang={lang}
          onClose={() => setShowErpLinks(false)}
        />
      ) : null}
    </div>
  );
}
