"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Save, X, RefreshCcw, CheckCircle2, User, MapPin, Phone, FileText, Info, Paperclip, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { SendToCustomerModal } from "./send-to-customer-modal";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { nameMatches } from "@/lib/utils/person-duplicate-match";
import { PersonDuplicateWarningModal, type PersonDuplicateCandidate } from "@/components/erp/person-duplicate-warning-modal";
import { VoiceFormFill } from "@/components/voice-form-fill";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name: string | null;
  contact_person: string | null;
  father_name?: string | null;
  person_code?: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function CustomerForm({
  lang: initialLang,
  initialCustomerId,
  mode = "standalone",
  onSave,
  onClose
}: {
  lang: SupportedLanguage;
  initialCustomerId?: string;
  mode?: "standalone" | "embedded";
  onSave?: (customerId: string) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  // The server-rendered `lang` prop is only correct at the moment of the initial page
  // load — it never re-renders when the user switches languages client-side without a
  // full navigation (the exact "stale language state after navigation" bug class).
  // useActiveLanguage() tracks the live selector reactively instead. `initialLang` is
  // kept only as the SSR value React hydrates against (avoids a hydration mismatch).
  const lang = useActiveLanguage() || initialLang;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);

  // ── AI Document Intake draft (Scan / Upload Document → reviewed draft) ──
  const intake = useIntakeDraft("customers");
  const effectiveCustomerId = initialCustomerId || intake.linkedSourceId || undefined;
  const [dupCandidates, setDupCandidates] = useState<PersonDuplicateCandidate[]>([]);
  const [dupSearchedName, setDupSearchedName] = useState("");
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  // DB customers local cache to read details if editing
  const [savedCompanies, setSavedCompanies] = useState<CustomerRow[]>([]);

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [customerType, setCustomerType] = useState("Male");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [passportPicture, setPassportPicture] = useState("");

  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: "",
    areaId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>({
    country: null,
    state: null,
    district: null,
    city: null,
    area: null
  });
  const [address, setAddress] = useState("");
  const [cityCode, setCityCode] = useState("");

  // Dynamic Contacts List
  const [contacts, setContacts] = useState<Array<{ type: string; value: string }>>([
    { type: "Mobile", value: "" }
  ]);

  // Dynamic Documents List
  const [documents, setDocuments] = useState<Array<{ type: string; number: string; upload: string }>>([
    { type: "CNIC", number: "", upload: "" }
  ]);

  const [status, setStatus] = useState("Active");
  const [remarks, setRemarks] = useState("");

  // Customer Account Details states
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [cityBranch, setCityBranch] = useState("");

  // Customer Company Details states
  const [companyName, setCompanyName] = useState("");
  const [companyRegNo, setCompanyRegNo] = useState("");
  const [companyTaxNo, setCompanyTaxNo] = useState("");
  const [companyBusinessType, setCompanyBusinessType] = useState("Private Limited");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyCountry, setCompanyCountry] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Retrieve existing customer list to search edit candidate
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ customers: CustomerRow[] }>("/api/erp/customers?limit=250");
        setSavedCompanies(res.customers ?? []);
      } catch {
        // Fallback
      }
    })();
  }, []);

  // Overlay AI-extracted values from the reviewed draft (runs after any
  // existing-record load so the user reviews AI values on top of the record).
  useEffect(() => {
    if (!intake.draft) return;
    const p = intake.payload;
    const full = String(p.customerName || "").trim();
    if (full) { setFirstName(full.split(" ")[0] || ""); setLastName(full.split(" ").slice(1).join(" ")); }
    if (p.companyName) setBusinessName(String(p.companyName));
    if (p.fatherName) setFatherName(String(p.fatherName));
    if (p.address) setAddress(String(p.address));
    if (p.phone || p.email) {
      setContacts((prev) => {
        const next = prev.map((c) => ({ ...c }));
        const set = (type: string, value: string) => {
          if (!value) return;
          const i = next.findIndex((c) => c.type === type);
          if (i >= 0) next[i].value = next[i].value || value; else next.push({ type, value });
        };
        set("Mobile Number", String(p.phone || ""));
        set("Email Address", String(p.email || ""));
        return next;
      });
    }
  }, [intake.draft]);

  // Load details directly from API if editing (or a draft is linked to a record)
  useEffect(() => {
    if (!effectiveCustomerId) return;
    (async () => {
      try {
        const res = await apiGet<{ customer: CustomerRow }>(`/api/erp/customers/${effectiveCustomerId}?lang=${encodeURIComponent(lang || "en")}`);
        const c = res.customer;
        if (!c) return;

        setAddress(c.address || "");
        setLocation({
          countryId: c.country_id || "",
          stateProvinceId: c.state_province_id || "",
          districtId: c.district_id || "",
          cityId: c.city_id || "",
          areaId: c.area_location_id || ""
        });

        if (c.father_name) setFatherName(c.father_name);
        if ((c as any).photo_url) setPassportPicture((c as any).photo_url);

        if (c.notes) {
          try {
            const parsed = typeof c.notes === "string" ? JSON.parse(c.notes) : c.notes;
            if (parsed && typeof parsed === "object") {
              if (parsed.customerType) setCustomerType(parsed.customerType);
              if (parsed.cityCode) setCityCode(parsed.cityCode);
              if (parsed.status) setStatus(parsed.status);
              if (parsed.remarks) setRemarks(parsed.remarks);
              if (parsed.photoUrl) setPassportPicture(parsed.photoUrl);

              // Load account fields
              if (parsed.accountName) setAccountName(parsed.accountName);
              if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
              if (parsed.manualReference) setManualReference(parsed.manualReference);
              if (parsed.branchName) setBranchName(parsed.branchName);
              if (parsed.branchCode) setBranchCode(parsed.branchCode);
              if (parsed.cityBranch) setCityBranch(parsed.cityBranch);

              // Load company fields
              if (parsed.companyName) setCompanyName(parsed.companyName);
              if (parsed.companyRegNo) setCompanyRegNo(parsed.companyRegNo);
              if (parsed.companyTaxNo) setCompanyTaxNo(parsed.companyTaxNo);
              if (parsed.companyBusinessType) setCompanyBusinessType(parsed.companyBusinessType);
              if (parsed.companyPhone) setCompanyPhone(parsed.companyPhone);
              if (parsed.companyEmail) setCompanyEmail(parsed.companyEmail);
              if (parsed.companyCountry) setCompanyCountry(parsed.companyCountry);
              if (parsed.companyCity) setCompanyCity(parsed.companyCity);
              if (parsed.companyState) setCompanyState(parsed.companyState);
              if (parsed.companyAddress) setCompanyAddress(parsed.companyAddress);

              // Dynamic contacts list
              if (parsed.contacts && Array.isArray(parsed.contacts) && parsed.contacts.length > 0) {
                setContacts(parsed.contacts);
              } else {
                const legacyContacts = [];
                if (c.mobile) legacyContacts.push({ type: "Mobile", value: c.mobile });
                if (c.whatsapp) legacyContacts.push({ type: "WhatsApp", value: c.whatsapp });
                if (c.email) legacyContacts.push({ type: "Email", value: c.email });
                if (legacyContacts.length === 0) legacyContacts.push({ type: "Mobile", value: "" });
                setContacts(legacyContacts);
              }

              // Dynamic documents list
              if (parsed.documents && Array.isArray(parsed.documents) && parsed.documents.length > 0) {
                setDocuments(parsed.documents);
              } else if (parsed.documentType || parsed.documentNumber) {
                setDocuments([
                  {
                    type: parsed.documentType || "CNIC",
                    number: parsed.documentNumber || "",
                    upload: parsed.documentUpload || ""
                  }
                ]);
              }

              // Load business or personal names
              if (parsed.customerType === "Business") {
                setBusinessName(parsed.businessName || c.company_name || c.customer_name || "");
                setFirstName(parsed.firstName || c.contact_person?.split(" ")[0] || "");
                setLastName(parsed.lastName || c.contact_person?.split(" ").slice(1).join(" ") || "");
              } else {
                setFirstName(parsed.firstName || c.first_name || c.customer_name.split(" ")[0] || c.customer_name || "");
                setLastName(parsed.lastName || c.last_name || c.customer_name.split(" ").slice(1).join(" ") || "");
                setFatherName(c.father_name || parsed.fatherName || "");
              }
            }
          } catch {
            // Notes parsing error fallback
          }
        } else {
          setFirstName(c.first_name || c.customer_name.split(" ")[0] || c.customer_name || "");
          setLastName(c.last_name || c.customer_name.split(" ").slice(1).join(" ") || "");
          setFatherName(c.father_name || "");
          if (c.company_name) {
            setBusinessName(c.company_name);
            setCustomerType("Business");
          }
          const legacyContacts = [];
          if (c.mobile) legacyContacts.push({ type: "Mobile", value: c.mobile });
          if (c.whatsapp) legacyContacts.push({ type: "WhatsApp", value: c.whatsapp });
          if (c.email) legacyContacts.push({ type: "Email", value: c.email });
          if (legacyContacts.length > 0) setContacts(legacyContacts);
        }
      } catch (e) {
        console.error("Failed to load customer for editing", e);
      }
    })();
  }, [effectiveCustomerId, lang]);

  const country = locationMeta.country?.name ?? "";
  const stateName = locationMeta.state?.name ?? "";
  const districtName = locationMeta.district?.name ?? "";
  const city = locationMeta.city?.name ?? "";
  const areaName = locationMeta.area?.name ?? "";

  // Sync utilities for dynamic prefilling
  useEffect(() => {
    const fullName = customerType === "Business" ? businessName : `${firstName} ${lastName}`.trim();
    if (fullName) {
      setAccountName((prev) => prev || fullName);
      if (customerType === "Business") {
        setCompanyName((prev) => prev || fullName);
      }
    }
  }, [customerType, businessName, firstName, lastName]);

  useEffect(() => {
    if (country) {
      setCompanyCountry((prev) => prev || country);
    }
  }, [country]);

  useEffect(() => {
    if (city) {
      setCompanyCity((prev) => prev || city);
      setCityBranch((prev) => prev || city);
    }
  }, [city]);

  useEffect(() => {
    if (stateName) {
      setCompanyState((prev) => prev || stateName);
    }
  }, [stateName]);

  useEffect(() => {
    if (address) {
      setCompanyAddress((prev) => prev || address);
    }
  }, [address]);

  useEffect(() => {
    const emailVal = contacts.find(c => c.type === "Email")?.value || "";
    if (emailVal) {
      setCompanyEmail((prev) => prev || emailVal);
    }
  }, [contacts]);

  useEffect(() => {
    const phoneVal = contacts.find(c => ["Mobile", "WhatsApp", "Landline", "Office"].includes(c.type))?.value || "";
    if (phoneVal) {
      setCompanyPhone((prev) => prev || phoneVal);
    }
  }, [contacts]);

  // Auto-fill City Code when city selects
  useEffect(() => {
    if (locationMeta.city?.zip_code) {
      setCityCode(locationMeta.city.zip_code);
    }
    if (locationMeta.city?.name) {
      setBranchName((prev) => prev || locationMeta.city!.name + " Branch");
      setBranchCode((prev) => prev || locationMeta.city!.name.substring(0, 3).toUpperCase());
    }
  }, [locationMeta.city]);

  // Auto-fill Country phone prefix when country selects
  useEffect(() => {
    if (locationMeta.country?.phone_code) {
      const code = locationMeta.country.phone_code;
      setContacts((prev) =>
        prev.map((c) => {
          if (["Mobile", "WhatsApp", "Landline", "Office"].includes(c.type) && !c.value.trim()) {
            return { ...c, value: code + " " };
          }
          return c;
        })
      );
    }
  }, [locationMeta.country]);

  const ready = Boolean(
    (customerType === "Business" ? businessName.trim() : (firstName.trim() || lastName.trim()))
  );

  const previewLocation = useMemo(() => {
    const parts = [areaName, city, stateName, country].filter(Boolean);
    return parts.length ? parts.join(" \u00b7 ") : "-";
  }, [areaName, city, stateName, country]);

  // Submit/Save
  const submitForm = async () => {
    if (!ready) {
      setMessage(getLabel("completeRequiredFieldsMsg", lang));
      return;
    }

    setSaving(true);
    setMessage("");

    const notesJson = {
      customerType,
      firstName,
      lastName,
      fatherName: customerType === "Business" ? "" : fatherName,
      businessName: customerType === "Business" ? businessName : "",
      country,
      stateProvince: stateName,
      district: districtName,
      city,
      areaName,
      cityCode,
      contacts: contacts.map(c => ({
        type: c.type.startsWith("Custom: ") ? c.type.slice(8).trim() || "Custom" : c.type,
        value: c.value
      })),
      documents: documents.map(d => ({
        type: d.type.startsWith("Custom: ") ? d.type.slice(8).trim() || "Custom" : d.type,
        number: d.number,
        upload: d.upload
      })),
      status,
      remarks,
      
      // Separate Account Details
      accountName,
      accountNumber,
      manualReference,
      branchName,
      branchCode,
      cityBranch,
      
      // Separate Company Details
      companyName,
      companyRegNo,
      companyTaxNo,
      companyBusinessType,
      companyPhone,
      companyEmail,
      companyCountry,
      companyCity,
      companyState,
      companyAddress
    };

    // Keep primary contacts mapped to standard columns for db-level searches
    const firstMobile = contacts.find((c) => ["Mobile", "Landline", "Office"].includes(c.type))?.value || "";
    const firstWhatsapp = contacts.find((c) => c.type === "WhatsApp")?.value || "";
    const firstEmail = contacts.find((c) => c.type === "Email")?.value || "";

    const resolvedCustomerName = customerType === "Business" 
      ? businessName.trim() 
      : ([firstName, lastName].filter(Boolean).join(" ").trim() || "New Person");

    const payload = {
      countryId: location.countryId || null,
      stateProvinceId: location.stateProvinceId || null,
      districtId: location.districtId || null,
      cityId: location.cityId || null,
      areaLocationId: location.areaId || null,
      customerName: resolvedCustomerName,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      fatherName: customerType === "Business" ? null : (fatherName.trim() || null),
      gender: customerType === "Business" ? null : customerType,
      photoUrl: passportPicture || null,
      companyName: customerType === "Business" ? businessName.trim() : (companyName || null),
      contactPerson: customerType === "Business" ? `${firstName} ${lastName}`.trim() : null,
      mobile: firstMobile || null,
      whatsapp: firstWhatsapp || null,
      email: firstEmail || null,
      address: address || (city ? `${city}, ${country || ""}`.trim() : "-"),
      notes: JSON.stringify(notesJson),
      originalLanguage: lang,
      contacts: [],
      registrations: []
    };

    // Duplicate-prevention: only when registering a brand-new Person Master, not when editing
    // an existing one. Search existing people by the resolved name first; if a close match
    // already exists, warn instead of silently creating a second row for the same person.
    if (!initialCustomerId) {
      try {
        const qp = new URLSearchParams();
        qp.set("q", resolvedCustomerName);
        qp.set("limit", "10");
        qp.set("lang", lang);
        const res = await apiGet<{ customers: CustomerRow[] }>(`/api/erp/customers?${qp.toString()}`);
        const matches = (res.customers ?? []).filter((c) => nameMatches(c.customer_name, resolvedCustomerName));
        if (matches.length > 0) {
          setDupCandidates(matches.map((c) => ({
            id: c.id,
            personCode: c.person_code,
            name: c.customer_name,
            fatherName: c.father_name,
            mobile: (c as any).mobile,
            email: (c as any).email
          })));
          setDupSearchedName(resolvedCustomerName);
          setPendingPayload(payload);
          setSaving(false);
          return;
        }
      } catch {
        // If the duplicate-check search itself fails, fall through to save — never block
        // registration on a search-availability issue.
      }
    }

    await performSave(payload);
  };

  const performSave = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (effectiveCustomerId) {
        // Edit mode (explicit edit OR a reviewed draft linked to this record)
        await apiPatch(`/api/erp/customers/${effectiveCustomerId}`, payload);
        setMessage(getLabel("customerUpdatedMsg", lang));
        if (intake.draft) await intake.consume(String(effectiveCustomerId));
        if (mode === "standalone") {
          setTimeout(() => {
            router.push(`/dashboard/settings/customers/view?customerId=${effectiveCustomerId}` as Route);
          }, 1000);
        } else {
          onSave?.(effectiveCustomerId);
        }
      } else {
        // Creation mode
        const res = await apiPost<{ customerId: string }>("/api/erp/customers", payload);
        const newId = res.customerId ?? (res as any)?.data?.customerId ?? (res as any)?.id;
        if (newId && intake.draft) await intake.consume(String(newId));
        setMessage(getLabel("customerCreatedMsg", lang));
        if (mode === "standalone") {
          setTimeout(() => {
            router.push(`/dashboard/settings/customers/view?customerId=${newId}` as Route);
          }, 1000);
        } else {
          onSave?.(newId);
        }
      }
    } catch (e: any) {
      setMessage(e.message || "Save operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const isRtl = lang !== "en";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {intake.draft ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
          ✨ {t(lang, "dintake.wizard_prefilled", "Pre-filled from reviewed document draft")} — {intake.draftNo}.
          {intake.linkedSourceId
            ? " " + t(lang, "dintake.wizard_update_hint", "This will UPDATE the linked existing record. Review every field, then save.")
            : " " + t(lang, "dintake.wizard_prefilled_hint", "Review every field, then save and post as usual.")}
        </div>
      ) : null}
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/dashboard/settings/customers" as Route);
            }}
            className="gap-1.5 h-9 px-3 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold text-xs shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{getLabel("backToCustomers", lang) || "Back"}</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-600">{t(lang, "cusm.settings_management", "Settings / Management")}</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {initialCustomerId ? getLabel("editCustomerDetails", lang) : getLabel("customerDetails", lang)}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {initialCustomerId ? getLabel("updateExistingCustomerSub", lang) : getLabel("createOrUpdateCustomerSub", lang)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={() => setShowSendModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-9 rounded-xl shadow-xs px-3.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{lang === "ur" ? "کسٹمر کو بھیجیں (SEND TO CUSTOMER)" : lang === "ar" ? "إرسال للعميل (SEND TO CUSTOMER)" : lang === "fa" ? "ارسال به مشتری (SEND TO CUSTOMER)" : lang === "ps" ? "پیرودونکي ته لیږل (SEND TO CUSTOMER)" : "SEND TO CUSTOMER"}</span>
          </Button>

          <span
            className={
              ready
                ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200"
                : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200"
            }
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {ready ? getLabel("ready", lang) : getLabel("draftStatus", lang)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-semibold text-slate-500 mb-2">
        {[
          { id: 1, label: getLabel("stepPersonalInfo", lang) },
          { id: 2, label: getLabel("stepLocation", lang) },
          { id: 3, label: getLabel("stepContactsDocs", lang) },
          { id: 4, label: getLabel("stepReviewSave", lang) },
        ].map((s) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as any)}
              className={`flex items-center gap-2.5 border rounded-xl p-3 text-start transition-all w-full justify-start ${
                active
                  ? "border-teal-600 bg-teal-50/80 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-bold shadow-xs ring-2 ring-teal-500/20"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-800 font-bold"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                  active ? "bg-teal-600 text-white shadow-xs" : completed ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className="truncate text-xs font-bold leading-tight">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Form Panels */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
          {currentStep === 1 && (
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden md:col-span-2">
              <div className="border-b px-5 py-4 bg-slate-50 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-teal-600" />
                <h2 className="font-semibold text-slate-800 text-sm">{getLabel("personalInfo", lang)}</h2>
              </div>
              <CardContent className="p-5 space-y-4">
                <VoiceFormFill
                  context="customer"
                  lang={lang}
                  compact
                  onApply={(f) => {
                    const full = (f.customerName || f.fullName || "") as string;
                    if (full) {
                      setFirstName(full.split(" ")[0] || "");
                      setLastName(full.split(" ").slice(1).join(" "));
                    }
                    if (f.address) setAddress(String(f.address));
                    const add: Array<{ type: string; value: string }> = [];
                    if (f.phone) add.push({ type: "Phone", value: String(f.phone) });
                    if (f.email) add.push({ type: "Email", value: String(f.email) });
                    if (add.length) {
                      setContacts((prev) => {
                        const kept = prev.filter((c) => c.value.trim());
                        return [...kept, ...add.filter((a) => !kept.some((c) => c.value === a.value))];
                      });
                    }
                  }}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("customerType", lang)} *</Label>
                  <select
                    value={customerType}
                    onChange={(e) => {
                      setCustomerType(e.target.value);
                      if (e.target.value !== "Business") setBusinessName("");
                    }}
                    className="flex min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 font-sans leading-relaxed"
                  >
                    {[
                      { value: "Country Owner", label: lang === "ur" ? "👑 کنٹری اونر / مین ہیڈ" : lang === "ps" ? "👑 د هیواد مالک / مشر" : lang === "fa" ? "👑 مالک کشوری / رئیس" : lang === "ar" ? "👑 مالك الدولة / رئيس" : "👑 Country Owner / Main Head" },
                      { value: "Branch Owner", label: lang === "ur" ? "🏛️ برانچ اونر / سٹی منیجر" : lang === "ps" ? "🏛️ د څانګې مالک / مدیر" : lang === "fa" ? "🏛️ مالک شعبه / مدیر" : lang === "ar" ? "🏛️ مالك الفرع / مدير" : "🏛️ Branch Owner / Manager" },
                      { value: "Company Owner", label: lang === "ur" ? "🏢 کمپنی اونر / پارٹنر" : lang === "ps" ? "🏢 د شرکت مالک / شریک" : lang === "fa" ? "🏢 مالک شرکت / شریک" : lang === "ar" ? "🏢 مالك الشركة / الشريك" : "🏢 Company Owner / Partner" },
                      { value: "Manager", label: lang === "ur" ? "👔 منیجر / ڈائریکٹر" : lang === "ps" ? "👔 مدیر / لارښود" : lang === "fa" ? "👔 مدیر / دایرکتور" : lang === "ar" ? "👔 مدير / المشرف" : "👔 Manager / Director" },
                      { value: "Employee", label: lang === "ur" ? "💼 ملازم / عملہ" : lang === "ps" ? "💼 کارمند / عمله" : lang === "fa" ? "💼 کارمند / پرسنل" : lang === "ar" ? "💼 موظف / طاقم العمل" : "💼 Employee / Staff" },
                      { value: "Customer", label: lang === "ur" ? "👤 کسٹمر / کلائنٹ" : lang === "ps" ? "👤 پیرودونکی / ګاهک" : lang === "fa" ? "👤 مشتری / خریدار" : lang === "ar" ? "👤 عميل / زبون" : "👤 Customer / Client" },
                      { value: "Vendor", label: lang === "ur" ? "🏭 سپلائر / وینڈر" : lang === "ps" ? "🏭 عرضه کوونکی / وېشونکی" : lang === "fa" ? "🏭 تأمین‌کننده / فروشنده" : lang === "ar" ? "🏭 مورد / بائع" : "🏭 Supplier / Vendor" },
                      { value: "Truck Owner", label: lang === "ur" ? "🚚 مالک ٹرک / ٹرانسپورٹر" : lang === "ps" ? "🚚 د ټرک مالک / ټرانسپورټر" : lang === "fa" ? "🚚 مالک موتربار / ترانسپورت" : lang === "ar" ? "🚚 مالك الشاحنة / ناقل" : "🚚 Truck Owner / Transporter" },
                      { value: "Driver", label: lang === "ur" ? "🚛 ٹرک ڈرائیور" : lang === "ps" ? "🚛 د ټرک چلوونکی" : lang === "fa" ? "🚛 راننده موتربار" : lang === "ar" ? "🚛 سائق الشاحنة" : "🚛 Truck Driver" },
                      { value: "Clearing Agent", label: lang === "ur" ? "🛃 کسٹم / کلیئرنگ ایجنٹ" : lang === "ps" ? "🛃 ګمرکي ایجنټ" : lang === "fa" ? "🛃 کارگزار گمرکی" : lang === "ar" ? "🛃 مخلص جمركي" : "🛃 Customs / Clearing Agent" },
                      { value: "Business", label: lang === "ur" ? "🏢 کارپوریٹ کمپنی" : lang === "ps" ? "🏢 کارپوریټ شرکت" : lang === "fa" ? "🏢 شرکت تجاری" : lang === "ar" ? "🏢 شركة أعمال" : "🏢 Corporate / Business Company" }
                    ].map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Save Banner for fast person creation */}
                <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl p-3">
                  <div className="text-xs text-teal-800">
                    <span className="font-bold">⚡ {getLabel("quickSaveAvailableLabel", lang)}</span> {getLabel("quickSaveAvailableMsg", lang)}
                  </div>
                  <Button
                    type="button"
                    onClick={submitForm}
                    disabled={!ready || saving}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 px-4 rounded-lg shadow-xs"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? "Saving..." : "Save Person Master"}
                  </Button>
                </div>

                {customerType === "Business" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">{getLabel("businessNameCompanyName", lang)} *</Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={getLabel("companyNamePlaceholderExample", lang)}
                      className="bg-white text-slate-900 border-slate-200 text-xs h-10"
                    />
                  </div>
                )}

                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {customerType === "Business" ? `${getLabel("representativeFirstName", lang)} *` : `${getLabel("firstName", lang)} *`}
                    </Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={getLabel("firstName", lang)} className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {customerType === "Business" ? `${getLabel("representativeLastName", lang)} *` : `${getLabel("lastName", lang)} *`}
                    </Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={getLabel("lastName", lang)} className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                </div>

                {customerType !== "Business" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">{getLabel("fatherNameRepresentative", lang)}</Label>
                    <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder={getLabel("fatherName", lang)} className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("passportSizePicture", lang)} *</Label>
                  <div className="flex flex-col items-center w-max gap-2 mt-2">
                    {passportPicture ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border shadow-sm">
                        <img src={passportPicture} alt={getLabel("passportSizePicture", lang)} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPassportPicture("")}
                          className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white shadow-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-50 border-2 border-dashed border-slate-300">
                        <User className="h-6 w-6 text-slate-300" />
                      </div>
                    )}

                    <Label className="cursor-pointer flex items-center justify-center h-7 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                      <Paperclip className="h-3 w-3" />
                      <span>{getLabel("attach", lang)}</span>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setPassportPicture(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden md:col-span-2">
              <div className="border-b px-5 py-4 bg-slate-50 flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-teal-600" />
                <h2 className="font-semibold text-slate-800 text-sm">{getLabel("locationInfo", lang)}</h2>
              </div>
              <CardContent className="p-5 space-y-4">
                <LocationHierarchySelect
                  value={location}
                  onChange={(next, meta) => {
                    setLocation(next);
                    setLocationMeta(meta);
                  }}
                  showDistrict={false}
                  showArea={true}
                />
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">{getLabel("cityCode", lang)}</Label>
                    <Input value={cityCode} onChange={(e) => setCityCode(e.target.value)} placeholder={getLabel("cityZipCodePlaceholder", lang)} className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("fullAddress", lang)} *</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t(lang, "company_form.enter_full_address", "Enter full address")} className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                </div>
              </CardContent>
            </Card>
          )}


          {currentStep === 3 && (
            <div className="space-y-6 md:col-span-2">
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
              <div className="border-b px-5 py-3.5 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4.5 w-4.5 text-teal-600" />
                  <h2 className="font-semibold text-slate-800 text-sm">{getLabel("contactInfo", lang)}</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContacts([...contacts, { type: "Mobile", value: "" }])}
                  className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50 px-2.5 rounded-md font-semibold"
                >
                  {getLabel("addContact", lang)}
                </Button>
              </div>
              <CardContent className="p-5 space-y-4">
                {contacts.map((contact, idx) => {
                  const isCustom = !["Mobile", "WhatsApp", "Email", "Landline", "Office"].includes(contact.type);
                  return (
                    <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="w-1/3 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">{getLabel("typeLabel", lang)}</Label>
                          <select
                            value={isCustom ? "Custom" : contact.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...contacts];
                              if (val === "Custom") {
                                updated[idx].type = "Custom: ";
                              } else {
                                updated[idx].type = val;
                              }
                              setContacts(updated);
                            }}
                            className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-500"
                          >
                            <option value="Mobile">{t(lang, "cbs.mobile_word", "Mobile")}</option>
                            <option value="WhatsApp">{t(lang, "purchase.dd_whatsapp", "WhatsApp")}</option>
                            <option value="Email">{t(lang, "purchase.dd_email", "Email")}</option>
                            <option value="Landline">{t(lang, "whf.landline", "Landline")}</option>
                            <option value="Office">{getLabel("officeContactType", lang)}</option>
                            <option value="Custom">{getLabel("customType", lang)}</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-semibold text-slate-500">{getLabel("contactValue", lang)}</Label>
                            {contact.type !== "Email" && (
                              <div className="flex items-center gap-1" dir="ltr">
                                {["+92", "+971", "+93", "+966"].map((cc) => (
                                  <button
                                    key={cc}
                                    type="button"
                                    onClick={() => {
                                      const updated = [...contacts];
                                      const cur = updated[idx].value.trim();
                                      if (!cur.startsWith("+")) {
                                        updated[idx].value = `${cc} ${cur}`;
                                      } else {
                                        updated[idx].value = `${cc} ${cur.replace(/^\+\d+\s*/, "")}`;
                                      }
                                      setContacts(updated);
                                    }}
                                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 font-mono font-bold border border-slate-200"
                                  >
                                    {cc}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Input
                            value={contact.value}
                            onChange={(e) => {
                              const updated = [...contacts];
                              updated[idx].value = e.target.value;
                              setContacts(updated);
                            }}
                            placeholder={
                              contact.type === "Email"
                                ? "name@company.com"
                                : contact.type === "WhatsApp"
                                ? "+92 300 1234567"
                                : "+92 333 1234567"
                            }
                            dir="ltr"
                            className="h-9 text-xs bg-white text-slate-900 border-slate-200 font-mono text-left"
                          />
                        </div>
                        {contacts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = contacts.filter((_, i) => i !== idx);
                              setContacts(updated);
                            }}
                            className="h-9 w-9 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {isCustom && (
                        <div className="w-full space-y-1 pl-1 border-l-2 border-teal-500/30">
                          <Label className="text-[9px] font-bold text-teal-700">{getLabel("typeCustomContactLabelName", lang)}</Label>
                          <Input
                            value={contact.type.startsWith("Custom: ") ? contact.type.slice(8) : contact.type}
                            onChange={(e) => {
                              const updated = [...contacts];
                              updated[idx].type = "Custom: " + e.target.value;
                              setContacts(updated);
                            }}
                            placeholder={getLabel("faxOrSkypeIdPlaceholder", lang)}
                            className="h-8 text-xs bg-white text-slate-900 border-slate-200"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Document Info (Dynamic) */}
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden">
              <div className="border-b px-5 py-3.5 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-teal-600" />
                  <h2 className="font-semibold text-slate-800 text-sm">{getLabel("documentInfo", lang)}</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDocuments([...documents, { type: "CNIC", number: "", upload: "" }])}
                  className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50 px-2.5 rounded-md font-semibold"
                >
                  {getLabel("addDocument", lang)}
                </Button>
              </div>
              <CardContent className="p-5 space-y-4">
                {documents.map((doc, idx) => {
                  const isCustom = !["CNIC", "Passport", "National ID", "Trade License"].includes(doc.type);
                  return (
                    <div key={idx} className="border-b pb-4 last:border-b-0 last:pb-0 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Document #{idx + 1}</span>
                        {documents.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = documents.filter((_, i) => i !== idx);
                              setDocuments(updated);
                            }}
                            className="h-7 text-xs text-rose-600 hover:bg-rose-50 px-2 rounded-md font-semibold"
                          >
                            {getLabel("removeAction", lang)}
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">{getLabel("documentType", lang)}</Label>
                          <select
                            value={isCustom ? "Custom" : doc.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...documents];
                              if (val === "Custom") {
                                updated[idx].type = "Custom: ";
                              } else {
                                updated[idx].type = val;
                              }
                              setDocuments(updated);
                            }}
                            className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-500"
                          >
                            <option value="CNIC">CNIC</option>
                            <option value="Passport">{getLabel("passportDocType", lang)}</option>
                            <option value="National ID">{getLabel("nationalIdDocType", lang)}</option>
                            <option value="Trade License">{getLabel("tradeLicenseDocType", lang)}</option>
                            <option value="Custom">{getLabel("customType", lang)}</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">{getLabel("documentNumber", lang)}</Label>
                          <Input
                            value={doc.number}
                            onChange={(e) => {
                              const updated = [...documents];
                              updated[idx].number = e.target.value;
                              setDocuments(updated);
                            }}
                            placeholder={getLabel("documentNumber", lang)}
                            className="h-9 text-xs bg-white text-slate-900 border-slate-200 font-mono"
                          />
                        </div>
                      </div>

                      {isCustom && (
                        <div className="w-full space-y-1 border-l-2 border-teal-500/30 pl-2">
                          <Label className="text-[9px] font-bold text-teal-700">{getLabel("typeCustomDocumentLabelName", lang)}</Label>
                          <Input
                            value={doc.type.startsWith("Custom: ") ? doc.type.slice(8) : doc.type}
                            onChange={(e) => {
                              const updated = [...documents];
                              updated[idx].type = "Custom: " + e.target.value;
                              setDocuments(updated);
                            }}
                            placeholder={getLabel("taxCertificateTradeLicensePlaceholder", lang)}
                            className="h-8 text-xs bg-white text-slate-900 border-slate-200"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500">{getLabel("documentUpload", lang)}</Label>
                        <div className="flex items-center gap-2">
                          <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                            <Paperclip className="h-3 w-3" />
                            <span>{getLabel("attach", lang)}</span>
                            <Input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const updated = [...documents];
                                  updated[idx].upload = file.name;
                                  setDocuments(updated);
                                }
                              }}
                              className="hidden"
                            />
                          </Label>
                          {doc.upload && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[200px]">{doc.upload}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </div>
          )}

          {currentStep === 4 && (
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden md:col-span-2">
              <div className="border-b px-5 py-4 bg-slate-50 flex items-center gap-2">
                <Info className="h-4.5 w-4.5 text-teal-600" />
                <h2 className="font-semibold text-slate-800 text-sm">{getLabel("additionalInfo", lang)}</h2>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("status", lang)} *</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                  >
                    <option value="Active">{getLabel("activeStatus", lang)}</option>
                    <option value="Inactive">{getLabel("inactiveStatus", lang)}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("remarksNotes", lang)}</Label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={getLabel("enterRemarksNotesPlaceholder", lang)}
                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                  />
                </div>
              </CardContent>
            </Card>
          )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as any)}
              disabled={currentStep === 1}
              className="border-slate-200 text-slate-700 font-medium h-10 px-4"
            >
              {getLabel("backButton", lang)}
            </Button>

            <div className="flex gap-2">
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as any)}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-8 gap-2"
                >
                  {getLabel("nextButton", lang)}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={submitForm}
                  disabled={!ready || saving}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-5 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? getLabel("savingLabel", lang) : getLabel("saveCustomer", lang)}
                </Button>
              )}
            </div>
          </div>

          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {message}
            </div>
          ) : null}
        </div>

        {/* Right Preview Panel */}
        <aside className="lg:col-span-5 xl:col-span-5 h-fit rounded-xl border bg-card p-6 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-teal-600" />
              <h2 className="font-semibold text-slate-800 text-sm">{getLabel("livePreview", lang)}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {getLabel("draftPreview", lang)}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {customerType === "Business" && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("businessCompanyName", lang)}</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{businessName || getLabel("newBusiness", lang)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {customerType === "Business" ? getLabel("representativeName", lang) : getLabel("customerName", lang)}
              </p>
              <div className="flex items-center gap-3">
                {passportPicture && (
                  <img src={passportPicture} alt={getLabel("passportSizePicture", lang)} className="h-10 w-10 rounded-full border shadow-sm object-cover" />
                )}
                <p className="text-sm font-extrabold text-slate-900">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : getLabel("newCustomer", lang)}
                </p>
              </div>
            </div>
            {customerType !== "Business" && fatherName && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("fatherName", lang)}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{fatherName}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("customerType", lang)}</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{customerType}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("location", lang)}</p>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">{previewLocation}</p>
              {cityCode && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono" dir="ltr">{getLabel("zipCode", lang)}: {cityCode}</p>}
            </div>
            {address && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("fullAddress", lang)}</p>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{address}</p>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("contacts", lang)} ({contacts.filter(c => c.value.trim()).length})</p>
              {contacts.filter(c => c.value.trim()).map((c, idx) => {
                const label = c.type.startsWith("Custom: ") ? c.type.slice(8) : c.type;
                return (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">{label || "Custom"}:</span>
                    <span className="font-bold text-slate-800 font-mono text-left" dir="ltr">{c.value}</span>
                  </div>
                );
              })}
              {contacts.filter(c => c.value.trim()).length === 0 && (
                <p className="text-[10px] italic text-muted-foreground">{getLabel("noContactsEntered", lang)}</p>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getLabel("documents", lang)} ({documents.filter(d => d.number.trim()).length})</p>
              {documents.filter(d => d.number.trim()).map((d, idx) => {
                const label = d.type.startsWith("Custom: ") ? d.type.slice(8) : d.type;
                return (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">{label || "Custom"}:</span>
                    <span className="font-bold text-slate-800 font-mono text-left" dir="ltr">{d.number}</span>
                  </div>
                );
              })}
              {documents.filter(d => d.number.trim()).length === 0 && (
                <p className="text-[10px] italic text-muted-foreground">{getLabel("noDocumentsEntered", lang)}</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {dupCandidates.length > 0 ? (
        <PersonDuplicateWarningModal
          lang={lang}
          searchedName={dupSearchedName}
          candidates={dupCandidates}
          onUseExisting={(personId) => {
            setDupCandidates([]);
            setPendingPayload(null);
            if (mode === "standalone") {
              router.push(`/dashboard/settings/customers/view?customerId=${personId}` as Route);
            } else {
              onSave?.(personId);
            }
          }}
          onCreateAnyway={() => {
            const payload = pendingPayload;
            setDupCandidates([]);
            setPendingPayload(null);
            if (payload) void performSave(payload);
          }}
          onCancel={() => {
            setDupCandidates([]);
            setPendingPayload(null);
          }}
        />
      ) : null}

      {/* Send to Customer External Link Modal */}
      <SendToCustomerModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        lang={lang}
        defaultFormType="customer"
      />
    </div>
  );
}
