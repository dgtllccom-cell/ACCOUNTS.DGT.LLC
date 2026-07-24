"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Save, X, RefreshCcw, CheckCircle2, User, MapPin, Phone, FileText, Info, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
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
};

export function CustomerForm({
  lang,
  initialCustomerId,
  mode = "standalone",
  onSave
}: {
  lang: SupportedLanguage;
  initialCustomerId?: string;
  mode?: "standalone" | "embedded";
  onSave?: (customerId: string) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  // Load details if editing
  useEffect(() => {
    if (initialCustomerId && savedCompanies.length > 0) {
      const c = savedCompanies.find((item) => item.id === initialCustomerId);
      if (c) {
        setAddress(c.address || "");
        setLocation({
          countryId: c.country_id || "",
          stateProvinceId: c.state_province_id || "",
          districtId: c.district_id || "",
          cityId: c.city_id || "",
          areaId: c.area_location_id || ""
        });

        if (c.notes) {
          try {
            const parsed = JSON.parse(c.notes);
            if (parsed && typeof parsed === "object") {
              if (parsed.customerType) setCustomerType(parsed.customerType);
              if (parsed.cityCode) setCityCode(parsed.cityCode);
              if (parsed.status) setStatus(parsed.status);
              if (parsed.remarks) setRemarks(parsed.remarks);

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

              // Backwards compatibility for dynamic lists
              if (parsed.contacts && Array.isArray(parsed.contacts)) {
                setContacts(parsed.contacts);
              } else {
                const legacyContacts = [];
                if (c.mobile) legacyContacts.push({ type: "Mobile", value: c.mobile });
                if (c.whatsapp) legacyContacts.push({ type: "WhatsApp", value: c.whatsapp });
                if (c.email) legacyContacts.push({ type: "Email", value: c.email });
                if (legacyContacts.length === 0) legacyContacts.push({ type: "Mobile", value: "" });
                setContacts(legacyContacts);
              }

              if (parsed.documents && Array.isArray(parsed.documents)) {
                setDocuments(parsed.documents);
              } else {
                setDocuments([
                  {
                    type: parsed.documentType || "CNIC",
                    number: parsed.documentNumber || "",
                    upload: parsed.documentUpload || ""
                  }
                ]);
              }

              // Load business details
              if (parsed.customerType === "Business") {
                setBusinessName(parsed.businessName || c.company_name || c.customer_name || "");
                setFirstName(parsed.firstName || c.contact_person?.split(" ")[0] || "");
                setLastName(parsed.lastName || c.contact_person?.split(" ").slice(1).join(" ") || "");
              } else {
                setFirstName(parsed.firstName || c.customer_name.split(" ")[0] || c.customer_name || "");
                setLastName(parsed.lastName || c.customer_name.split(" ").slice(1).join(" ") || "");
                setFatherName(parsed.fatherName || c.contact_person || "");
              }
            }
          } catch {
            // Notes parsing error fallback
          }
        }
      }
    }
  }, [initialCustomerId, savedCompanies]);

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
    (customerType === "Business" ? businessName.trim() : true) &&
    firstName.trim() &&
    lastName.trim() &&
    location.countryId &&
    address.trim()
  );

  const previewLocation = useMemo(() => {
    const parts = [areaName, city, stateName, country].filter(Boolean);
    return parts.length ? parts.join(" \u00b7 ") : "-";
  }, [areaName, city, stateName, country]);

  // Submit/Save
  const submitForm = async () => {
    if (!ready) {
      setMessage("Please complete all required fields first.");
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

    const payload = {
      countryId: location.countryId,
      stateProvinceId: location.stateProvinceId || null,
      districtId: location.districtId || null,
      cityId: location.cityId || null,
      areaLocationId: location.areaId || null,
      customerName: customerType === "Business" ? businessName.trim() : `${firstName} ${lastName}`.trim(),
      companyName: customerType === "Business" ? businessName.trim() : null,
      contactPerson: customerType === "Business" ? `${firstName} ${lastName}`.trim() : (fatherName || null),
      mobile: firstMobile || null,
      whatsapp: firstWhatsapp || null,
      email: firstEmail || null,
      address: address || null,
      notes: JSON.stringify(notesJson),
      originalLanguage: lang,
      contacts: [],
      registrations: []
    };

    try {
      if (initialCustomerId) {
        // Edit mode
        await apiPatch(`/api/erp/customers/${initialCustomerId}`, payload);
        setMessage("Customer details updated successfully.");
        if (mode === "standalone") {
          setTimeout(() => {
            router.push(`/dashboard/settings/customers/view?customerId=${initialCustomerId}` as Route);
          }, 1000);
        } else {
          onSave?.(initialCustomerId);
        }
      } else {
        // Creation mode
        const res = await apiPost<{ customerId: string }>("/api/erp/customers", payload);
        setMessage("Customer profile incorporated successfully.");
        if (mode === "standalone") {
          setTimeout(() => {
            router.push(`/dashboard/settings/customers/view?customerId=${res.customerId}` as Route);
          }, 1000);
        } else {
          onSave?.(res.customerId);
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
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Settings / Management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {initialCustomerId ? "Edit Customer Details" : getLabel("customerDetails", lang)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {initialCustomerId ? "Update existing customer registry records" : getLabel("createOrUpdateCustomerSub", lang)}
          </p>
        </div>
        <span
          className={
            ready
              ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200"
              : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200"
          }
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {ready ? "Ready" : "Draft"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-semibold text-slate-500 mb-2">
        {[
          { id: 1, label: "1. Personal Info" },
          { id: 2, label: "2. Location" },
          { id: 3, label: "3. Contacts & Docs" },
          { id: 4, label: "4. Review & Save" },
        ].map((s) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as any)}
              className={`flex items-center gap-2 border rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "border-teal-500 bg-teal-50/50 text-teal-700 font-bold shadow-sm"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-teal-500 text-white" : completed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Form Panels */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
          {currentStep === 1 && (
            <Card className="rounded-xl border shadow-sm bg-white overflow-hidden md:col-span-2">
              <div className="border-b px-5 py-4 bg-slate-50 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-teal-600" />
                <h2 className="font-semibold text-slate-800 text-sm">{getLabel("personalInfo", lang)}</h2>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("customerType", lang)} *</Label>
                  <select
                    value={customerType}
                    onChange={(e) => {
                      setCustomerType(e.target.value);
                      if (e.target.value !== "Business") setBusinessName("");
                    }}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Business">Business</option>
                  </select>
                </div>

                {customerType === "Business" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Business Name / Company Name *</Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. ABC Traders (Pvt) Ltd."
                      className="bg-white text-slate-900 border-slate-200 text-xs h-10"
                    />
                  </div>
                )}

                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {customerType === "Business" ? "Representative First Name *" : `${getLabel("firstName", lang)} *`}
                    </Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {customerType === "Business" ? "Representative Last Name *" : `${getLabel("lastName", lang)} *`}
                    </Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                </div>

                {customerType !== "Business" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">{getLabel("fatherNameRepresentative", lang)}</Label>
                    <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father Name" className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Passport Size Picture *</Label>
                  <div className="flex flex-col items-center w-max gap-2 mt-2">
                    {passportPicture ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border shadow-sm">
                        <img src={passportPicture} alt="Passport" className="h-full w-full object-cover" />
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
                      <span>Attach</span>
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
                    <Input value={cityCode} onChange={(e) => setCityCode(e.target.value)} placeholder="City / Zip Code" className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("fullAddress", lang)} *</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter full address" className="bg-white text-slate-900 border-slate-200 text-xs h-10" />
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
                  + Add Contact
                </Button>
              </div>
              <CardContent className="p-5 space-y-4">
                {contacts.map((contact, idx) => {
                  const isCustom = !["Mobile", "WhatsApp", "Email", "Landline", "Office"].includes(contact.type);
                  return (
                    <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="w-1/3 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">Type</Label>
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
                            <option value="Mobile">Mobile</option>
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Email">Email</option>
                            <option value="Landline">Landline</option>
                            <option value="Office">Office</option>
                            <option value="Custom">+ Custom Type</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">Contact Value</Label>
                          <Input
                            value={contact.value}
                            onChange={(e) => {
                              const updated = [...contacts];
                              updated[idx].value = e.target.value;
                              setContacts(updated);
                            }}
                            placeholder={
                              contact.type === "Email"
                                ? "email@example.com"
                                : contact.type === "WhatsApp"
                                ? "+92 300 1234567"
                                : "Contact Number"
                            }
                            className="h-9 text-xs bg-white text-slate-900 border-slate-200 font-mono"
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
                          <Label className="text-[9px] font-bold text-teal-700">Type Custom Contact Label Name</Label>
                          <Input
                            value={contact.type.startsWith("Custom: ") ? contact.type.slice(8) : contact.type}
                            onChange={(e) => {
                              const updated = [...contacts];
                              updated[idx].type = "Custom: " + e.target.value;
                              setContacts(updated);
                            }}
                            placeholder="e.g. Fax or Skype ID"
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
                  + Add Document
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
                            Remove
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
                            <option value="Passport">Passport</option>
                            <option value="National ID">National ID</option>
                            <option value="Trade License">Trade License</option>
                            <option value="Custom">+ Custom Type</option>
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
                            placeholder="Document Number"
                            className="h-9 text-xs bg-white text-slate-900 border-slate-200 font-mono"
                          />
                        </div>
                      </div>

                      {isCustom && (
                        <div className="w-full space-y-1 border-l-2 border-teal-500/30 pl-2">
                          <Label className="text-[9px] font-bold text-teal-700">Type Custom Document Label Name</Label>
                          <Input
                            value={doc.type.startsWith("Custom: ") ? doc.type.slice(8) : doc.type}
                            onChange={(e) => {
                              const updated = [...documents];
                              updated[idx].type = "Custom: " + e.target.value;
                              setDocuments(updated);
                            }}
                            placeholder="e.g. Tax Certificate or Trade License"
                            className="h-8 text-xs bg-white text-slate-900 border-slate-200"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-500">{getLabel("documentUpload", lang)}</Label>
                        <div className="flex items-center gap-2">
                          <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                            <Paperclip className="h-3 w-3" />
                            <span>Attach</span>
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
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">{getLabel("remarksNotes", lang)}</Label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks or additional notes here..."
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
              Back
            </Button>
            
            <div className="flex gap-2">
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as any)}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-8 gap-2"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={submitForm}
                  disabled={!ready || saving}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-5 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : getLabel("saveCustomer", lang)}
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
        <aside className="h-fit rounded-lg border bg-card p-5 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-teal-600" />
              <h2 className="font-semibold text-slate-800 text-sm">Live Preview</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Draft Preview
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {customerType === "Business" && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Business / Company Name</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{businessName || "New Business"}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {customerType === "Business" ? "Representative Name" : "Customer Name"}
              </p>
              <div className="flex items-center gap-3">
                {passportPicture && (
                  <img src={passportPicture} alt="Passport" className="h-10 w-10 rounded-full border shadow-sm object-cover" />
                )}
                <p className="text-sm font-extrabold text-slate-900">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : "New Customer"}
                </p>
              </div>
            </div>
            {customerType !== "Business" && fatherName && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Father Name</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{fatherName}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Type</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{customerType}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</p>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">{previewLocation}</p>
              {cityCode && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Zip Code: {cityCode}</p>}
            </div>
            {address && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Address</p>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{address}</p>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contacts ({contacts.filter(c => c.value.trim()).length})</p>
              {contacts.filter(c => c.value.trim()).map((c, idx) => {
                const label = c.type.startsWith("Custom: ") ? c.type.slice(8) : c.type;
                return (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-500 font-semibold">{label || "Custom"}:</span>
                    <span className="font-bold text-slate-800 font-mono">{c.value}</span>
                  </div>
                );
              })}
              {contacts.filter(c => c.value.trim()).length === 0 && (
                <p className="text-[10px] italic text-muted-foreground">No contacts entered</p>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documents ({documents.filter(d => d.number.trim()).length})</p>
              {documents.filter(d => d.number.trim()).map((d, idx) => {
                const label = d.type.startsWith("Custom: ") ? d.type.slice(8) : d.type;
                return (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-500 font-semibold">{label || "Custom"}:</span>
                    <span className="font-bold text-slate-800 font-mono">{d.number}</span>
                  </div>
                );
              })}
              {documents.filter(d => d.number.trim()).length === 0 && (
                <p className="text-[10px] italic text-muted-foreground">No documents entered</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
