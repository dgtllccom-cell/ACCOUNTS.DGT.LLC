"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Save, X, RefreshCcw, CheckCircle2, User, MapPin, Phone, FileText, Info, Paperclip, Send, ArrowLeft, Camera, Upload, ChevronRight, Eye, Bookmark } from "lucide-react";
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
  const [customerType, setCustomerType] = useState("Country Owner / Main Head");
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
        // raw=1: load the ORIGINAL untranslated record — an edit form must never
        // populate its inputs from a display translation (saving would overwrite
        // the source text).
        const res = await apiGet<{ customer: CustomerRow }>(`/api/erp/customers/${effectiveCustomerId}?raw=1`);
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

  const isBusiness = customerType === "Corporate / Business Company" || customerType === "Business";

  // Auto-fill City Code when city selects
  useEffect(() => {
    if (locationMeta.city?.zip_code) {
      setCityCode(locationMeta.city.zip_code);
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
    (isBusiness ? businessName.trim() : (firstName.trim() || lastName.trim()))
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
      fatherName: isBusiness ? "" : fatherName,
      businessName: isBusiness ? businessName : "",
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
      remarks
    };

    // Keep primary contacts mapped to standard columns for db-level searches
    const firstMobile = contacts.find((c) => ["Mobile", "Landline", "Office"].includes(c.type))?.value || "";
    const firstWhatsapp = contacts.find((c) => c.type === "WhatsApp")?.value || "";
    const firstEmail = contacts.find((c) => c.type === "Email")?.value || "";

    const resolvedCustomerName = isBusiness 
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
      fatherName: isBusiness ? null : (fatherName.trim() || null),
      gender: isBusiness ? null : customerType,
      photoUrl: passportPicture || null,
      companyName: isBusiness ? (businessName.trim() || null) : null,
      contactPerson: isBusiness ? `${firstName} ${lastName}`.trim() : null,
      mobile: firstMobile || null,
      whatsapp: firstWhatsapp || null,
      email: firstEmail || null,
      address: address || (city ? `${city}, ${country || ""}`.trim() : "-"),
      notes: JSON.stringify(notesJson),
      // Only stamp the entry language when CREATING. On edit we must not relabel
      // an existing record's original language (or overwrite its source text) just
      // because the person editing it is viewing the ERP in another language.
      ...(effectiveCustomerId ? {} : { originalLanguage: lang }),
      contacts: [],
      registrations: []
    };

    // Duplicate-prevention: only when registering a brand-new Person Master, not when editing
    // an existing one. Search existing people by the resolved name first; if a close match
    // already exists, warn instead of silently creating a second row for the same person.
    if (!effectiveCustomerId) {
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
      } catch (error: unknown) {
        // A failed lookup is not evidence that the person is new. Keep the form intact.
        setMessage(error instanceof Error ? error.message : t(lang, "common.error", "Error"));
        setSaving(false);
        return;
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
      {/* Top Header Bar matching Screenshot 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/dashboard/settings/customers" as Route);
            }}
            className="gap-2 h-9 px-3.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold text-xs shadow-xs"
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            <span>{getLabel("backToCustomers", lang)}</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {t(lang, "cusm.settings_management", "Settings / Management")}
            </p>
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
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-2 h-9 rounded-xl shadow-xs px-4"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{getLabel("sendToCustomer", lang)}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={submitForm}
            disabled={saving}
            className="border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-bold text-xs gap-2 h-9 rounded-xl shadow-xs px-4"
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-600" />
            <span>{getLabel("saveAsDraft", lang)}</span>
          </Button>
        </div>
      </div>

      {/* 4-Step Horizontal Stepper matching Screenshot 3 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        {[
          { id: 1, title: getLabel("stepPersonalInfoTitle", lang), sub: getLabel("stepPersonalInfoSub", lang) },
          { id: 2, title: getLabel("stepLocationTitle", lang), sub: getLabel("stepLocationSub", lang) },
          { id: 3, title: getLabel("stepContactsDocsTitle", lang), sub: getLabel("stepContactsDocsSub", lang) },
          { id: 4, title: getLabel("stepReviewSaveTitle", lang), sub: getLabel("stepReviewSaveSub", lang) },
        ].map((s, idx, arr) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-[190px] gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(s.id as any)}
                className={`flex items-center gap-3 p-2.5 rounded-xl text-start transition-all w-full ${
                  active
                    ? "border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs"
                    : completed
                    ? "border border-emerald-200 bg-emerald-50/40 text-emerald-800"
                    : "border border-transparent bg-transparent text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : completed
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate leading-tight ${active ? "text-blue-950 dark:text-blue-100" : "text-slate-800 dark:text-slate-200"}`}>
                    {s.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-tight">
                    {s.sub}
                  </p>
                </div>
              </button>
              {idx < arr.length - 1 && (
                <ChevronRight className={`h-4 w-4 shrink-0 mx-1 ${isRtl ? "rotate-180" : ""} text-slate-300 dark:text-slate-600`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Form Panels */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {currentStep === 1 && (
            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">{getLabel("personalInfo", lang)}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{getLabel("personalInfoSub", lang)}</p>
                </div>
              </div>
              <CardContent className="p-6 space-y-5">
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

                {/* Customer Type dropdown with emojis matching Screenshot 3 */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getLabel("customerType", lang)} <span className="text-rose-500">*</span>
                  </Label>
                  <select
                    value={customerType}
                    onChange={(e) => {
                      setCustomerType(e.target.value);
                      if (e.target.value !== "Corporate / Business Company") setBusinessName("");
                    }}
                    className="flex min-h-[46px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                  >
                    {[
                      { value: "Country Owner / Main Head", label: "👑 Country Owner / Main Head" },
                      { value: "Branch Owner / Manager", label: "🏛️ Branch Owner / Manager" },
                      { value: "Company Owner / Partner", label: "🏢 Company Owner / Partner" },
                      { value: "Manager / Director", label: "👔 Manager / Director" },
                      { value: "Employee / Staff", label: "💼 Employee / Staff" },
                      { value: "Customer / Client", label: "👤 Customer / Client" },
                      { value: "Supplier / Vendor", label: "🏭 Supplier / Vendor" },
                      { value: "Truck Owner / Transporter", label: "🚚 Truck Owner / Transporter" },
                      { value: "Truck Driver", label: "🚛 Truck Driver" },
                      { value: "Customs / Clearing Agent", label: "📊 Customs / Clearing Agent" },
                      { value: "Corporate / Business Company", label: "🏢 Corporate / Business Company" },
                    ].map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Save Banner */}
                <div className="flex items-center justify-between bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5 gap-3">
                  <div className="text-xs text-teal-800">
                    <p className="font-bold flex items-center gap-1 text-teal-900">
                      <span>⚡</span> {getLabel("quickSaveAvailableLabel", lang)}
                    </p>
                    <p className="text-[11px] text-teal-700 mt-0.5">{getLabel("quickSaveAvailableMsg", lang)}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={submitForm}
                    disabled={!ready || saving}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0 gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{getLabel("savePersonMaster", lang)}</span>
                  </Button>
                </div>

                {/* Names */}
                {isBusiness && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {getLabel("businessNameCompanyName", lang)} <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={getLabel("companyNamePlaceholderExample", lang)}
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-11 rounded-xl"
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isBusiness ? getLabel("representativeFirstName", lang) : getLabel("firstName", lang)} <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`} />
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={getLabel("firstName", lang)}
                        className={`bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-11 rounded-xl ${isRtl ? "pr-9" : "pl-9"}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isBusiness ? getLabel("representativeLastName", lang) : getLabel("lastName", lang)} <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`} />
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={getLabel("lastName", lang)}
                        className={`bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-11 rounded-xl ${isRtl ? "pr-9" : "pl-9"}`}
                      />
                    </div>
                  </div>
                </div>

                {!isBusiness && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {getLabel("fatherNameRepresentative", lang)}
                    </Label>
                    <div className="relative">
                      <User className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`} />
                      <Input
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder={getLabel("fatherName", lang)}
                        className={`bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-11 rounded-xl ${isRtl ? "pr-9" : "pl-9"}`}
                      />
                    </div>
                  </div>
                )}

                {/* Passport Size Picture matching Screenshot 3 */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getLabel("passportSizePicture", lang)} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {passportPicture ? (
                        <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-blue-500 shadow-xs">
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
                        <div className="relative h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          <User className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900">
                            <Camera className="h-3 w-3" />
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="flex-1 cursor-pointer">
                      <input
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
                      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/20 transition-all">
                        <Upload className="h-5 w-5 text-blue-600 mb-1" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {getLabel("clickToUploadPhoto", lang)}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          {getLabel("uploadPhotoHint1", lang)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {getLabel("uploadPhotoHint2", lang)}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    disabled={currentStep === 1}
                    className="border-slate-200 text-slate-600 font-bold text-xs h-10 px-5 rounded-xl"
                  >
                    <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? "rotate-180 ml-1.5" : "mr-1.5"}`} />
                    <span>{getLabel("stepBack", lang)}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <span>{getLabel("stepNext", lang)}</span>
                    <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? "" : "rotate-180"}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">


              {/* Location Hierarchy & Physical Address Card */}
              <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {getLabel("locationInfo", lang)}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getLabel("stepLocationSub", lang)}
                    </p>
                  </div>
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
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{getLabel("cityCode", lang)}</Label>
                      <Input value={cityCode} onChange={(e) => setCityCode(e.target.value)} placeholder={getLabel("cityZipCodePlaceholder", lang)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-10 rounded-xl font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{getLabel("fullAddress", lang)} *</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t(lang, "company_form.enter_full_address", "Enter full address")} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 text-xs h-10 rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            </div>
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
                          <Label className="text-[11px] font-semibold text-slate-500">{getLabel("typeLabel", lang)}</Label>
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
                            <Label className="text-[11px] font-semibold text-slate-500">{getLabel("contactValue", lang)}</Label>
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
                                    className="text-[11px] px-1 py-0.5 rounded bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 font-mono font-bold border border-slate-200"
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
                          <Label className="text-[11px] font-bold text-teal-700">{getLabel("typeCustomContactLabelName", lang)}</Label>
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
                          <Label className="text-[11px] font-semibold text-slate-500">{getLabel("documentType", lang)}</Label>
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
                          <Label className="text-[11px] font-semibold text-slate-500">{getLabel("documentNumber", lang)}</Label>
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
                          <Label className="text-[11px] font-bold text-teal-700">{getLabel("typeCustomDocumentLabelName", lang)}</Label>
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
                        <Label className="text-[11px] font-semibold text-slate-500">{getLabel("documentUpload", lang)}</Label>
                        <div className="flex items-center gap-2">
                          <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[11px] font-semibold">
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
                          {doc.upload && <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[200px]">{doc.upload}</span>}
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
            <div className="space-y-6 md:col-span-2">
              {/* Review & Audit Summary Card */}
              <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <div className="border-b px-5 py-4 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{getLabel("stepReviewSaveTitle", lang)}</h2>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Step 4 / 4</span>
                </div>
                <CardContent className="p-5 space-y-4 text-xs">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-blue-600" />
                        <span>{getLabel("personalInfo", lang)}</span>
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("customerName", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{isBusiness ? businessName : `${firstName} ${lastName}`.trim() || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("customerType", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{customerType}</span>
                        </div>
                        {!isBusiness && fatherName && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">{getLabel("fatherNameRepresentative", lang)}:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{fatherName}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("passportSizePicture", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{passportPicture ? "✓ Attached" : "None"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />
                        <span>{getLabel("locationInfo", lang)}</span>
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("location", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{previewLocation !== "-" ? previewLocation : "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("fullAddress", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[180px]" title={address}>{address || "-"}</span>
                        </div>
                        {cityCode && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">{getLabel("cityCode", lang)}:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{cityCode}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("contacts", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{contacts.filter(c => c.value.trim()).length} recorded</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{getLabel("documents", lang)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{documents.filter(d => d.number.trim() || d.upload.trim()).length} recorded</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden md:col-span-2">
                <div className="border-b px-5 py-4 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                  <Info className="h-4.5 w-4.5 text-teal-600" />
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{getLabel("additionalInfo", lang)}</h2>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{getLabel("status", lang)} *</Label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                    >
                      <option value="Active">{getLabel("activeStatus", lang)}</option>
                      <option value="Inactive">{getLabel("inactiveStatus", lang)}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{getLabel("remarksNotes", lang)}</Label>
                    <textarea
                      rows={4}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder={getLabel("enterRemarksNotesPlaceholder", lang)}
                      className="flex w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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

        {/* Right Preview Panel matching Screenshot 3 */}
        <aside className="lg:col-span-5 xl:col-span-5 h-fit rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-5">
            <div className="flex items-center gap-2">
              <Eye className="h-4.5 w-4.5 text-blue-600" />
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{getLabel("livePreview", lang)}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <Eye className="h-3 w-3" />
              <span>{getLabel("draftPreview", lang)}</span>
            </span>
          </div>

          <div className="space-y-5">
            {/* Avatar & Customer Name/Type matching Screenshot 3 */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                {passportPicture ? (
                  <img src={passportPicture} alt={getLabel("passportSizePicture", lang)} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {getLabel("customerName", lang)}
                </p>
                <p className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                  {isBusiness
                    ? (businessName || getLabel("newBusiness", lang))
                    : (firstName || lastName ? `${firstName} ${lastName}`.trim() : getLabel("newCustomer", lang))}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-2">
                  {getLabel("customerType", lang)}
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {customerType}
                </p>
              </div>
            </div>



            {/* Location Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{getLabel("location", lang)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {getLabel("editBtn", lang)}
                </button>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {previewLocation !== "-" ? previewLocation : "-"}
              </p>
              {address && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {address}
                </p>
              )}
            </div>

            {/* Contacts Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{getLabel("contacts", lang)} ({contacts.filter(c => c.value.trim()).length})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {getLabel("editBtn", lang)}
                </button>
              </div>
              {contacts.filter(c => c.value.trim()).length > 0 ? (
                <div className="space-y-1.5">
                  {contacts.filter(c => c.value.trim()).map((c, idx) => {
                    const label = c.type.startsWith("Custom: ") ? c.type.slice(8) : c.type;
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">{label}:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono" dir="ltr">{c.value}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  {getLabel("noContactsEntered", lang)}
                </p>
              )}
            </div>

            {/* Documents Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{getLabel("documents", lang)} ({documents.filter(d => d.number.trim()).length})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {getLabel("editBtn", lang)}
                </button>
              </div>
              {documents.filter(d => d.number.trim()).length > 0 ? (
                <div className="space-y-1.5">
                  {documents.filter(d => d.number.trim()).map((d, idx) => {
                    const label = d.type.startsWith("Custom: ") ? d.type.slice(8) : d.type;
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">{label}:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono" dir="ltr">{d.number}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  {getLabel("noDocumentsEntered", lang)}
                </p>
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
