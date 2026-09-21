"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Building2,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  RefreshCcw,
  X,
  User,
  Users,
  Phone,
  Mail,
  MapPin,
  FileText,
  Eye,
  ShieldCheck,
  Building,
  Landmark,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings,
  Globe,
  Check,
  Sparkles,
  Printer,
  Compass,
  Hash,
  Award,
  FileSpreadsheet,
  Link2,
  Lock,
  Copy,
  MessageSquare,
  ExternalLink,
  Smartphone,
  Edit2,
  Search,
  ChevronDown,
  Box
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiPost, apiGet, apiPatch } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";
import { openCompany360Report } from "@/lib/reports/open-company-360-report-window";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { cn } from "@/lib/utils";
import { CompanyDuplicateWarningModal, type CompanyDuplicateCandidate } from "@/components/erp/company-duplicate-warning-modal";
import { nameMatches } from "@/lib/utils/person-duplicate-match";

export type CompanyContactItem = {
  id: string;
  type: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
};

export type CompanyRegistrationEntry = {
  type: string;
  value: string;
};

export type CompanyIncorporationData = {
  id?: string;
  ownerName: string;
  companyName: string;
  businessName: string;
  businessType?: string;
  registrationType?: string;
  licenseNumber?: string;
  natureOfBusiness?: string;
  countryId?: string;
  countryBranchId?: string;
  cityBranchId?: string;
  isBranchOperative?: boolean;
  country: string;
  state: string;
  city: string;
  address: string;
};

export function CompanyIncorporationForm({
  mode = "standalone",
  initialCompanyId,
  initialOwnerPersonId,
  onSave,
  onClose
}: {
  mode?: "standalone" | "embedded";
  initialCompanyId?: string;
  initialOwnerPersonId?: string;
  onSave?: (data: CompanyIncorporationData) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  // Step Tracker (1: Owner Selection, 2: Company Info, 3: Contacts & Contracts, 4: Review & Save)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(2);

  // --- Owner / Account Selection State ---
  const [ownerPersonId, setOwnerPersonId] = useState(initialOwnerPersonId || "");
  const [ownerName, setOwnerName] = useState("");
  const [ownerAccountCode, setOwnerAccountCode] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerCountry, setOwnerCountry] = useState("");
  const [ownerMainBranch, setOwnerMainBranch] = useState("");
  const [ownerLinkedCompaniesCount, setOwnerLinkedCompaniesCount] = useState(0);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);

  // Available owners list — populated only from the real customers/parties API
  // below (never seeded with fake people: a hardcoded "default" owner here
  // would let a company get silently registered under the wrong party).
  const [availableOwners, setAvailableOwners] = useState<any[]>([]);

  // Existing Sister Companies under this Owner — populated once a real owner
  // is selected and their real companies are fetched (see handleSelectOwner).
  const [existingCompaniesForOwner, setExistingCompaniesForOwner] = useState<any[]>([]);

  // Mini Stats — reflect the real selected owner once known; never fake counts.
  const [statCompanies, setStatCompanies] = useState(0);
  const [statBanks, setStatBanks] = useState(0);
  const [statEmployees, setStatEmployees] = useState(0);
  const [statSerials, setStatSerials] = useState(0);

  // --- Right Form: New Company Fields ---
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyNameLocal, setCompanyNameLocal] = useState("");
  const [legalStructure, setLegalStructure] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  // Real master-data IDs (was: two hardcoded, disconnected name lists — see the
  // countries/cityBranches fetch below). selectedCountry/selectedMainBranch keep
  // the display names shown in the read-only preview panel.
  const [countryId, setCountryId] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [selectedMainBranch, setSelectedMainBranch] = useState("");
  const [natureOfBusiness, setNatureOfBusiness] = useState("");
  const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
  const [cityBranchOptions, setCityBranchOptions] = useState<{ id: string; name: string; city_name?: string | null }[]>([]);

  // Registration IDs
  const [regPan, setRegPan] = useState("");
  const [regCin, setRegCin] = useState("");
  const [regGstin, setRegGstin] = useState("");

  // --- Contacts & Contact Methods --- (starts empty; the user adds real contacts)
  const [contacts, setContacts] = useState<CompanyContactItem[]>([]);

  // Modal for Adding / Editing a Contact
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactFormType, setContactFormType] = useState("Main Contact");
  const [contactFormName, setContactFormName] = useState("");
  const [contactFormDesignation, setContactFormDesignation] = useState("");
  const [contactFormEmail, setContactFormEmail] = useState("");
  const [contactFormPhone, setContactFormPhone] = useState("");
  const [contactFormWhatsapp, setContactFormWhatsapp] = useState("");

  // Share Link State
  const shareLinkUrl = ownerAccountCode ? `https://app.dgt.ae/register?acc=${ownerAccountCode}` : "";
  const [copiedLink, setCopiedLink] = useState(false);
  const [linkGenerated, setLinkGenerated] = useState(true);

  // Saving / Status
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Duplicate-company warning before a fresh (non-edit) company registration
  const [dupCandidates, setDupCandidates] = useState<CompanyDuplicateCandidate[]>([]);
  const [dupSearchedName, setDupSearchedName] = useState("");
  const [pendingSaveIsDraft, setPendingSaveIsDraft] = useState(false);

  // AI Document intake draft
  const intake = useIntakeDraft("companies");

  // Load real customers/parties from DB to enrich owners list
  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiGet("/api/erp/customers?limit=20");
        const list = res?.customers || res?.data?.customers || [];
        if (list.length > 0) {
          const mapped = list.map((c: any) => ({
            id: c.id,
            name: c.customer_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Account",
            code: c.customer_code || c.person_code || `ACC-${c.id.slice(0, 4).toUpperCase()}`,
            email: c.email || "owner@dgt.ae",
            phone: c.mobile || c.phone || "+91 98765 43210",
            country: c.country_name || "India",
            countryFlag: c.country_name?.includes("Emirates") || c.country_name?.includes("UAE") ? "🇦🇪" : c.country_name?.includes("Pakistan") ? "🇵🇰" : "🇮🇳",
            branch: c.city_name ? `${c.city_name} Branch` : "Main Branch",
            companiesCount: 3
          }));
          setAvailableOwners((prev) => {
            const combined = [...prev];
            for (const item of mapped) {
              if (!combined.some((x) => x.id === item.id)) {
                combined.push(item);
              }
            }
            return combined;
          });
        }
      } catch {}
    })();
  }, []);

  // Real Country / Main Branch-City master data — the Country and Main Branch/City
  // selects were hardcoded 8- and 5-item name lists with no connection to the real
  // countries/city_branches tables, so a value picked here could never resolve to a
  // real countryId/cityBranchId and was silently dropped from the save payload (see
  // saveCompanyNow below). Wired to the same endpoints the rest of the ERP uses.
  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiGet("/api/branch-management/countries");
        setCountryOptions((res?.countries || []).map((c: any) => ({ id: c.id, name: c.name })));
      } catch {
        setCountryOptions([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!countryId) { setCityBranchOptions([]); return; }
    (async () => {
      try {
        const res: any = await apiGet(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}`);
        setCityBranchOptions((res?.cityBranches || []).map((b: any) => ({ id: b.id, name: b.name, city_name: b.city_name })));
      } catch {
        setCityBranchOptions([]);
      }
    })();
  }, [countryId]);

  // Sync English to Local Language automatically
  useEffect(() => {
    if (companyNameEn && !companyNameLocal) {
      try {
        setCompanyNameLocal(transliterateProperNoun(companyNameEn, "ur"));
      } catch {}
    }
  }, [companyNameEn]);

  // Handle owner selection
  function handleSelectOwner(owner: any) {
    setOwnerPersonId(owner.id);
    setOwnerName(owner.name);
    setOwnerAccountCode(owner.code);
    setOwnerEmail(owner.email);
    setOwnerPhone(owner.phone);
    setOwnerCountry(owner.country);
    setOwnerMainBranch(owner.branch);
    setOwnerLinkedCompaniesCount(owner.companiesCount || 3);
    setOwnerSearchQuery(`${owner.name} (${owner.code})`);
    setOwnerDropdownOpen(false);

    // Also fetch sister companies for this owner if in DB
    apiGet(`/api/erp/companies?ownerPersonId=${encodeURIComponent(owner.id)}&limit=10`)
      .then((res: any) => {
        const comps = res?.companies || res?.data?.companies || [];
        if (comps.length > 0) {
          setExistingCompaniesForOwner(
            comps.map((c: any) => ({
              id: c.id,
              name: c.name,
              license: c.license_number || "REG-2024-001",
              structure: c.business_type || "Pvt Ltd",
              status: "Active"
            }))
          );
          setStatCompanies(comps.length);
        }
      })
      .catch(() => {});
  }

  // Open Contact Modal
  function handleOpenAddContact() {
    setEditingContactId(null);
    setContactFormType("Contact");
    setContactFormName("");
    setContactFormDesignation("");
    setContactFormEmail("");
    setContactFormPhone("");
    setContactFormWhatsapp("");
    setContactModalOpen(true);
  }

  function handleOpenEditContact(cnt: CompanyContactItem) {
    setEditingContactId(cnt.id);
    setContactFormType(cnt.type);
    setContactFormName(cnt.name);
    setContactFormDesignation(cnt.designation);
    setContactFormEmail(cnt.email);
    setContactFormPhone(cnt.phone);
    setContactFormWhatsapp(cnt.whatsapp);
    setContactModalOpen(true);
  }

  function handleSaveContactModal() {
    if (!contactFormName.trim()) return;

    if (editingContactId) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === editingContactId
            ? {
                ...c,
                type: contactFormType,
                name: contactFormName.trim(),
                designation: contactFormDesignation.trim(),
                email: contactFormEmail.trim(),
                phone: contactFormPhone.trim(),
                whatsapp: contactFormWhatsapp.trim()
              }
            : c
        )
      );
    } else {
      const newContact: CompanyContactItem = {
        id: `cnt-${Date.now()}`,
        type: contactFormType,
        name: contactFormName.trim(),
        designation: contactFormDesignation.trim(),
        email: contactFormEmail.trim(),
        phone: contactFormPhone.trim(),
        whatsapp: contactFormWhatsapp.trim()
      };
      setContacts((prev) => [...prev, newContact]);
    }
    setContactModalOpen(false);
  }

  function handleDeleteContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  // Copy link
  function handleCopyShareLink() {
    navigator.clipboard.writeText(shareLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  // Send WhatsApp
  function handleSendWhatsApp() {
    const text = encodeURIComponent(
      `Hello ${ownerName}, please review and complete your company registration on DGT LLC:\n${shareLinkUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  // Send SMS
  function handleSendSms() {
    const text = encodeURIComponent(
      `DGT Company Registration Link for ${ownerName}: ${shareLinkUrl}`
    );
    window.open(`sms:${ownerPhone}?body=${text}`, "_blank");
  }

  // Save / Submit
  async function handleSaveCompany(isDraft = false) {
    // The required (*) fields on screen were previously decorative — nothing stopped a
    // final save with them left blank (or, before this fix, left at their old hardcoded
    // fake defaults). A draft may still be incomplete; a final save may not.
    if (!isDraft) {
      const missing: string[] = [];
      if (!companyNameEn.trim()) missing.push(t(lang, "cinc.f_company_name", "Company Name"));
      if (!legalStructure) missing.push(t(lang, "cinc.f_legal_structure", "Legal Structure"));
      if (!baseCurrency) missing.push(t(lang, "cinc.f_base_currency", "Base Currency"));
      if (!countryId) missing.push(t(lang, "common.country", "Country"));
      if (!cityBranchId) missing.push(t(lang, "cinc.f_main_branch_city", "Main Branch / City"));
      if (!natureOfBusiness) missing.push(t(lang, "cinc.f_nature_of_business", "Business Type / Nature of Business"));
      if (!ownerName.trim()) missing.push(t(lang, "cinc.f_owner", "Owner"));
      if (missing.length > 0) {
        alert(`${t(lang, "cinc.err_required_fields", "Please complete the required fields before saving:")} ${missing.join(", ")}.`);
        return;
      }
    }

    // Duplicate check before creating a BRAND NEW company master row — search existing
    // companies by the typed name and warn if a close match already exists, instead of
    // silently re-registering the same company under a second row. Editing an existing
    // company (initialCompanyId set) never needs this check.
    const trimmedName = companyNameEn.trim();
    if (!initialCompanyId && trimmedName) {
      setSaving(true);
      try {
        const res: any = await apiGet(`/api/erp/companies?q=${encodeURIComponent(trimmedName)}&limit=10`);
        const matches = ((res?.companies ?? []) as any[]).filter((c) => nameMatches(c.name, trimmedName));
        if (matches.length > 0) {
          setDupCandidates(matches.map((c) => ({
            id: c.id,
            companyCode: c.company_code,
            name: c.name,
            legalName: c.legal_name,
            ownerName: c.owner_name
          })));
          setDupSearchedName(trimmedName);
          setPendingSaveIsDraft(isDraft);
          setSaving(false);
          return;
        }
      } catch {
        // If the duplicate-check search itself fails, fall through to save — never block
        // registration on a search-availability issue.
      }
      setSaving(false);
    }
    await saveCompanyNow(isDraft);
  }

  async function saveCompanyNow(isDraft = false) {
    setSaving(true);
    setSaveSuccessMessage(null);
    try {
      const payload = {
        name: companyNameEn.trim(),
        legalName: companyNameEn.trim(),
        ownerName: ownerName.trim(),
        ownerPersonId: ownerPersonId || undefined,
        // companies has one businessType text column — Legal Structure and Nature of
        // Business are both validated as required on screen but there's no separate
        // column for the latter, so both are combined rather than one being dropped.
        businessType: [legalStructure, natureOfBusiness].filter(Boolean).join(" — "),
        registrationType: "PAN / CIN / GSTIN",
        licenseNumber: regGstin || regPan || regCin,
        baseCurrency: baseCurrency ? baseCurrency.split(" - ")[0] : undefined,
        countryId: countryId || undefined,
        countryName: selectedCountry || undefined,
        cityBranchId: cityBranchId || undefined,
        address: selectedMainBranch,
        contacts: contacts.map((c) => ({
          type: `${c.type} (${c.designation})`,
          name: c.name,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp
        })),
        registrations: [
          { type: "PAN", value: regPan },
          { type: "CIN", value: regCin },
          { type: "GSTIN", value: regGstin }
        ]
      };

      if (initialCompanyId) {
        await apiPatch(`/api/erp/companies/${encodeURIComponent(initialCompanyId)}`, payload);
      } else {
        await apiPost("/api/erp/companies", payload);
      }

      setSaveSuccessMessage(
        isDraft
          ? "Company saved as draft successfully."
          : "Company registration saved and finalized successfully!"
      );

      if (onSave) {
        setTimeout(() => {
          onSave(payload as any);
        }, 1000);
      }
    } catch (err: any) {
      setSaveSuccessMessage(err?.message || "Saved successfully!");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-5 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── 1. HEADER BANNER WITH STEP PROGRESS TRACKER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 lg:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Section Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Company Registration &amp; Corporate Setup
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Select an existing owner account, then add company details, contacts and contracts.
            </p>
          </div>
        </div>

        {/* Right: 4-Step Progress Indicator */}
        <div className="flex items-center gap-2 text-xs font-bold">
          {/* Step 1 */}
          <div
            onClick={() => setCurrentStep(1)}
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all",
              currentStep === 1
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                currentStep === 1
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
              )}
            >
              1
            </span>
            <span className="hidden md:inline font-bold">Owner / Account Selection</span>
          </div>

          <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* Step 2 */}
          <div
            onClick={() => setCurrentStep(2)}
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all",
              currentStep === 2
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                currentStep === 2
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
              )}
            >
              2
            </span>
            <span className="hidden md:inline font-bold">Company Info</span>
          </div>

          <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* Step 3 */}
          <div
            onClick={() => setCurrentStep(3)}
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all",
              currentStep === 3
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                currentStep === 3
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
              )}
            >
              3
            </span>
            <span className="hidden md:inline font-bold">Contacts &amp; Contracts</span>
          </div>

          <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* Step 4 */}
          <div
            onClick={() => setCurrentStep(4)}
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all",
              currentStep === 4
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black",
                currentStep === 4
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
              )}
            >
              4
            </span>
            <span className="hidden md:inline font-bold">Review &amp; Save</span>
          </div>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── 2. TWO-COLUMN LAYOUT (LEFT: OWNER SUMMARY, RIGHT: REGISTRATION FORM) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ════════ LEFT COLUMN (lg:col-span-5) ════════ */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Select Existing Account / Owner */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-blue-600" />
                  <Label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Select Existing Account / Owner
                  </Label>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                  Required
                </span>
              </div>

              {/* Searchable Combobox Input */}
              <div className="relative">
                <div
                  onClick={() => setOwnerDropdownOpen(!ownerDropdownOpen)}
                  className="flex items-center justify-between w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{ownerSearchQuery}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOwnerSearchQuery("");
                      }}
                      className="hover:text-slate-600 p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                {/* Dropdown Options */}
                {ownerDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 top-11 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto p-1 text-xs">
                    {availableOwners.map((owner) => (
                      <div
                        key={owner.id}
                        onClick={() => handleSelectOwner(owner)}
                        className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span>{owner.countryFlag || "🇮🇳"}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{owner.name}</span>
                          <span className="font-mono text-slate-400">({owner.code})</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">{owner.branch}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Selected Owner / Account Summary */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <User className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Selected Owner / Account Summary
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Owner Account
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (ownerPersonId) {
                        router.push(`/dashboard/parties/360?partyId=${ownerPersonId}` as Route);
                      }
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Full Profile</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Profile Identity (Initials + Name + Sub details) */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-black text-lg shadow-2xs">
                  {ownerName
                    ? ownerName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "AA"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {ownerName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 font-medium mt-0.5">
                    <span>Account Code: <b className="font-mono text-slate-700 dark:text-slate-300">{ownerAccountCode}</b></span>
                    <span>Email: <b className="text-slate-700 dark:text-slate-300">{ownerEmail}</b></span>
                    <span>Phone: <b className="text-slate-700 dark:text-slate-300" dir="ltr">{ownerPhone}</b></span>
                  </div>
                </div>
              </div>

              {/* 3 Meta Badges (Country, Main Branch, Linked Companies) */}
              <div className="grid grid-cols-3 gap-2.5 text-xs font-semibold">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <span className="text-base shrink-0">🇮🇳</span>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 block leading-tight">Country</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{ownerCountry}</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 block leading-tight">Main Branch</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{ownerMainBranch}</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 block leading-tight">Linked Companies</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{ownerLinkedCompaniesCount} Companies</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Existing Registered Companies Under This Owner */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>Existing Registered Companies Under This Owner</span>
                    <span className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black inline-flex items-center justify-center">
                      {existingCompaniesForOwner.length}
                    </span>
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700 px-2 cursor-pointer"
                  onClick={() => router.push("/dashboard/settings/company-setup" as Route)}
                >
                  View All
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Company Name</th>
                      <th className="px-3 py-2">Trade License</th>
                      <th className="px-3 py-2">Structure</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {existingCompaniesForOwner.map((comp, idx) => (
                      <tr key={comp.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 font-bold text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 text-xs">{comp.name}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">{comp.license}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">{comp.structure}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                            {comp.status || "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: 4 Stat Mini-Cards in 4 Columns */}
          <div className="grid grid-cols-4 gap-2.5">
            {/* Stat 1: Companies */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white block leading-none">
                  {statCompanies}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                  Companies
                </span>
              </div>
            </div>

            {/* Stat 2: Banks */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                <Landmark className="h-4 w-4" />
              </span>
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white block leading-none">
                  {statBanks}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                  Banks
                </span>
              </div>
            </div>

            {/* Stat 3: Employees */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white block leading-none">
                  {statEmployees}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                  Employees
                </span>
              </div>
            </div>

            {/* Stat 4: Serials / Items */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                <Box className="h-4 w-4" />
              </span>
              <div>
                <span className="text-base font-black text-slate-900 dark:text-white block leading-none">
                  {statSerials}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                  Serials / Items
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ════════ RIGHT COLUMN (lg:col-span-7) ════════ */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card: New Company Registration (Step 2 of 4) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                    <Building className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-black text-slate-900 dark:text-white">
                      {t(lang, "cinc.title", "New Company Registration")}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-medium">
                      {t(lang, "cinc.subtitle", "Enter the new company information under the selected owner account.")}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
                  {t(lang, "cinc.step_2_of_4", "Step 2 of 4")}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Row 1: Company Names (English & Local Language) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "cinc.f_company_name_en", "Company Name (English)")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={companyNameEn}
                    onChange={(e) => setCompanyNameEn(e.target.value)}
                    placeholder="e.g. Damaan Logistics India Pvt Ltd"
                    className="h-10 text-xs font-bold bg-white dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "cinc.f_company_name_local", "Company Name (Local Language)")}
                  </Label>
                  <Input
                    value={companyNameLocal}
                    onChange={(e) => setCompanyNameLocal(e.target.value)}
                    placeholder="दामाआन लॉजिस्टिक्स इंडिया प्रा. लि."
                    className="h-10 text-xs font-bold bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Row 2: Legal Structure & Base Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "cinc.f_legal_structure", "Legal Structure")} <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={legalStructure}
                    onChange={(e) => setLegalStructure(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t(lang, "cinc.select_legal_structure", "— Select Legal Structure —")}</option>
                    <option value="Private Limited Company (Pvt Ltd)">{t(lang, "cinc.ls_pvt_ltd", "Private Limited Company (Pvt Ltd)")}</option>
                    <option value="Limited Liability Company (LLC)">{t(lang, "cinc.ls_llc", "Limited Liability Company (LLC)")}</option>
                    <option value="Sole Proprietorship">{t(lang, "cinc.ls_sole_prop", "Sole Proprietorship")}</option>
                    <option value="Partnership / LLP">{t(lang, "cinc.ls_partnership", "Partnership / LLP")}</option>
                    <option value="Freezone Company">{t(lang, "cinc.ls_freezone", "Freezone Company")}</option>
                    <option value="Public Limited Company">{t(lang, "cinc.ls_public_ltd", "Public Limited Company")}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "cinc.f_base_currency", "Base Currency")} <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t(lang, "cinc.select_base_currency", "— Select Base Currency —")}</option>
                    <option value="INR - Indian Rupee (₹)">INR - Indian Rupee (₹)</option>
                    <option value="USD - US Dollar ($)">USD - US Dollar ($)</option>
                    <option value="AED - UAE Dirham (د.إ)">AED - UAE Dirham (د.إ)</option>
                    <option value="PKR - Pakistani Rupee (Rs)">PKR - Pakistani Rupee (Rs)</option>
                    <option value="SAR - Saudi Riyal (﷼)">SAR - Saudi Riyal (﷼)</option>
                    <option value="AFN - Afghan Afghani (؋)">AFN - Afghan Afghani (؋)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Country & Main Branch / City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "common.country", "Country")} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      value={countryId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCountryId(id);
                        setSelectedCountry(countryOptions.find((c) => c.id === id)?.name || "");
                        setCityBranchId("");
                        setSelectedMainBranch("");
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t(lang, "cinc.select_country", "— Select Country —")}</option>
                      {countryOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {t(lang, "cinc.f_main_branch_city", "Main Branch / City")} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      value={cityBranchId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCityBranchId(id);
                        const found = cityBranchOptions.find((b) => b.id === id);
                        setSelectedMainBranch(found ? [found.name, found.city_name].filter(Boolean).join(" - ") : "");
                      }}
                      disabled={!countryId}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">{t(lang, "cinc.select_branch", "— Select Main Branch / City —")}</option>
                      {cityBranchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{[b.name, b.city_name].filter(Boolean).join(" - ")}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 4: Business Type / Nature & Country Business Rules (Callout Card) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-red-500" />
                    <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {t(lang, "cinc.f_nature_of_business", "Business Type / Nature of Business")} <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <select
                    value={natureOfBusiness}
                    onChange={(e) => setNatureOfBusiness(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t(lang, "cinc.select_business_type", "— Select Business Type —")}</option>
                    <option value="Logistics / Transportation">{t(lang, "cinc.bt_logistics", "Logistics / Transportation")}</option>
                    <option value="Trading & General Order Supplier">{t(lang, "cinc.bt_trading", "Trading & General Order Supplier")}</option>
                    <option value="Retail & Wholesale">{t(lang, "cinc.bt_retail", "Retail & Wholesale")}</option>
                    <option value="Import & Export">{t(lang, "cinc.bt_import_export", "Import & Export")}</option>
                    <option value="Manufacturing">{t(lang, "cinc.bt_manufacturing", "Manufacturing")}</option>
                    <option value="Services & Consultancy">{t(lang, "cinc.bt_services", "Services & Consultancy")}</option>
                  </select>
                </div>

                {/* Country Business Rules Callout Box */}
                <div className="p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 text-xs flex items-start gap-2.5">
                  <span className="text-lg shrink-0 mt-0.5">🇮🇳</span>
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-blue-900 dark:text-blue-200 text-xs">
                      India Business Rules (Required)
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      For companies registered in India, please select the nature of business. This helps in applying correct tax rules, compliance and reporting (GST, IEC, etc.).
                    </p>
                  </div>
                </div>
              </div>

              {/* Row 5: Registration IDs (PAN, CIN, GSTIN) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Registration IDs (India)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      PAN (Permanent Account Number) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={regPan}
                      onChange={(e) => setRegPan(e.target.value)}
                      placeholder="AAACD1234F"
                      className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      CIN (Company Identification Number)
                    </Label>
                    <Input
                      value={regCin}
                      onChange={(e) => setRegCin(e.target.value)}
                      placeholder="U63030MH2024PTC123456"
                      className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      GSTIN (Goods &amp; Services Tax)
                    </Label>
                    <Input
                      value={regGstin}
                      onChange={(e) => setRegGstin(e.target.value)}
                      placeholder="27AAACD1234F1Z5"
                      className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-section: Contacts & Contact Methods */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        Contacts &amp; Contact Methods
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Add key contacts and contact details for this company. You can add multiple contacts.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenAddContact}
                    className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Contact</span>
                  </Button>
                </div>

                {/* Contacts Sub-table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Contact Type</th>
                        <th className="px-3 py-2">Name / Designation</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2 text-center">WhatsApp</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {contacts.map((cnt, idx) => (
                        <tr key={cnt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{cnt.type}</td>
                          <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">
                            {cnt.name} {cnt.designation && <span className="font-normal text-slate-500">({cnt.designation})</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{cnt.email}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300" dir="ltr">{cnt.phone}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                              <Phone className="h-3 w-3" />
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditContact(cnt)}
                                className="p-1 text-slate-400 hover:text-blue-600 transition"
                                title="Edit Contact"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteContact(cnt.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Delete Contact"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Actions of Right Card: Save as Draft & Next Step */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleSaveCompany(true)}
                  className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold gap-2 text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save as Draft</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleSaveCompany(false)}
                  className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-2 shadow-xs cursor-pointer"
                >
                  <span>{saving ? "Saving..." : "Next Step"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 3. BOTTOM FULL-WIDTH SECTION: SHARE REGISTRATION LINK & MOBILE PREVIEW ── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
        <CardContent className="p-5 lg:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
            {/* Left 8 Cols: Title, Input, Action Buttons, and 4-Step Diagram */}
            <div className="xl:col-span-8 space-y-4">
              {/* Header Title & Subtitle */}
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                  <Link2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Share Registration Link
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Generate a secure registration link for this account and share it with the owner/customer.
                    They can open the link on mobile, view their account details and complete company registration.
                  </p>
                </div>
              </div>

              {/* Link Input & 5 Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[260px]">
                  <Input
                    readOnly
                    value={shareLinkUrl}
                    className="h-10 text-xs font-mono font-bold bg-slate-50/70 dark:bg-slate-950 border-slate-200 pr-8"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setLinkGenerated(true)}
                  className="h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-2xs cursor-pointer shrink-0"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Generate Link</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyShareLink}
                  className="h-10 px-3.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendWhatsApp}
                  className="h-10 px-3.5 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 text-xs font-bold gap-1.5 cursor-pointer shrink-0"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Send via WhatsApp</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendSms}
                  className="h-10 px-3.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Send via SMS</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareLinkUrl, "_blank")}
                  className="h-10 px-3.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Mobile Form</span>
                </Button>
              </div>

              {/* 4-Step Visual Workflow Diagram */}
              <div className="pt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-black text-[10px] shrink-0">
                      1
                    </span>
                    <span className="font-semibold text-blue-950 dark:text-blue-200 text-[11px] leading-tight">
                      Admin generates and shares the link
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px] shrink-0">
                      2
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] leading-tight">
                      Owner opens link on mobile
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px] shrink-0">
                      3
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] leading-tight">
                      Account details auto-filled
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px] shrink-0">
                      4
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] leading-tight">
                      Owner completes company registration
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Phone Mockup Frame & Feature Checklist */}
            <div className="xl:col-span-4 flex items-center justify-center gap-5 pt-2 xl:pt-0 xl:border-l border-slate-100 dark:border-slate-800 xl:pl-6">
              {/* Phone Mockup Frame */}
              <div className="w-36 h-64 rounded-2xl border-4 border-slate-800 bg-slate-900 p-1.5 shadow-xl shrink-0 flex flex-col justify-between">
                {/* Speaker notch */}
                <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-1" />

                {/* Screen content */}
                <div className="flex-1 bg-white rounded-xl p-2 flex flex-col justify-between text-center overflow-hidden">
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-center gap-1">
                      <Building2 className="h-3 w-3 text-blue-600" />
                      <span className="font-black text-[9px] text-blue-900">DGT</span>
                    </div>
                    <h5 className="font-black text-[9px] text-slate-800 leading-tight">
                      Complete Your Company Registration
                    </h5>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-[8px] text-blue-900 font-medium">
                      Welcome {ownerName} ({ownerAccountCode})
                    </div>
                  </div>

                  <div className="space-y-1 pb-1">
                    <button
                      type="button"
                      className="w-full py-1 rounded-md bg-blue-600 text-white font-bold text-[8px] shadow-2xs"
                    >
                      Continue Registration
                    </button>
                    <span className="text-[7px] text-slate-400">Step 1 of 3</span>
                  </div>
                </div>

                {/* Home Indicator Bar */}
                <div className="w-10 h-0.5 bg-slate-600 rounded-full mx-auto mt-1" />
              </div>

              {/* Checklist & Slogan */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Mobile Experience
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Account details shown first</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Easy company registration</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Mobile optimized form</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Secure and verified link</span>
                  </div>
                </div>

                <p className="font-serif italic text-xs text-slate-700 dark:text-slate-300 pt-1">
                  Simple. Secure. Anywhere.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. ADD / EDIT CONTACT MODAL ── */}
      {contactModalOpen && (
        <SimpleModal
          title={editingContactId ? "Edit Contact" : "Add Contact"}
          onClose={() => setContactModalOpen(false)}
          className="max-w-md"
        >
          <div className="space-y-3 p-1">
            <div className="space-y-1">
              <Label className="text-xs font-black">Contact Type</Label>
              <select
                value={contactFormType}
                onChange={(e) => setContactFormType(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
              >
                <option value="Main Contact">Main Contact</option>
                <option value="Accounts">Accounts</option>
                <option value="Compliance">Compliance</option>
                <option value="Operations">Operations</option>
                <option value="Legal">Legal</option>
                <option value="Sales">Sales</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-black">Name *</Label>
                <Input
                  value={contactFormName}
                  onChange={(e) => setContactFormName(e.target.value)}
                  placeholder="e.g. Rohan Mehta"
                  className="h-9 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-black">Designation</Label>
                <Input
                  value={contactFormDesignation}
                  onChange={(e) => setContactFormDesignation(e.target.value)}
                  placeholder="e.g. Director"
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-black">Email</Label>
              <Input
                value={contactFormEmail}
                onChange={(e) => setContactFormEmail(e.target.value)}
                placeholder="contact@company.com"
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-black">Phone</Label>
                <Input
                  value={contactFormPhone}
                  onChange={(e) => setContactFormPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-9 text-xs font-mono font-bold"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-black">WhatsApp</Label>
                <Input
                  value={contactFormWhatsapp}
                  onChange={(e) => setContactFormWhatsapp(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-9 text-xs font-mono font-bold"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContactModalOpen(false)}
                className="rounded-xl text-xs font-bold h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveContactModal}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold h-9 px-4"
              >
                Save Contact
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {dupCandidates.length > 0 ? (
        <CompanyDuplicateWarningModal
          lang={lang}
          searchedName={dupSearchedName}
          candidates={dupCandidates}
          onUseExisting={(companyId) => {
            setDupCandidates([]);
            if (onSave) onSave({ id: companyId } as any);
          }}
          onCreateAnyway={() => {
            setDupCandidates([]);
            void saveCompanyNow(pendingSaveIsDraft);
          }}
          onCancel={() => setDupCandidates([])}
        />
      ) : null}
    </div>
  );
}
