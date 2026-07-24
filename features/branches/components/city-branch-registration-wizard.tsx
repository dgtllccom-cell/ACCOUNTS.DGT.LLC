"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { PermissionAssignmentSection } from "@/features/users/components/permission-assignment-section";
import { apiGet, apiPost } from "@/lib/api/client";
import { getPermissionKeysForTemplate } from "@/lib/permissions/catalog";
import { cn } from "@/lib/utils";

type CountryBranchRow = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  local_currency?: string | null;
  permission_grants?: string[] | null;
};

type StepKey = "branch" | "permissions" | "admin" | "communication" | "review";

const steps: Array<{ key: StepKey; title: string; subtitle: string; icon: typeof Building2 }> = [
  { key: "branch", title: "Branch Information", subtitle: "Country, main branch, state and city", icon: Building2 },
  { key: "permissions", title: "Roles & Permissions", subtitle: "Access scope and operational rights", icon: ShieldCheck },
  { key: "admin", title: "User Account Setup", subtitle: "Default city branch admin login", icon: UserRound },
  { key: "communication", title: "AI Communication Setup", subtitle: "Email, WhatsApp, SMS and alerts", icon: MessageSquareText },
  { key: "review", title: "Review & PDF Summary", subtitle: "Confirm, download and submit", icon: FileText }
];

const defaultLocation: LocationHierarchyValue = {
  countryId: "",
  stateProvinceId: "",
  districtId: "",
  cityId: "",
  areaId: ""
};

const defaultMeta: LocationHierarchyMeta = {
  country: null,
  state: null,
  district: null,
  city: null,
  area: null
};

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildBranchCode(mainBranch?: CountryBranchRow | null, cityName?: string | null) {
  const base = normalizeCode(mainBranch?.code || "CITY");
  const city = normalizeCode((cityName || "BR").slice(0, 10));
  return `${base}-${city || "BR"}-001`;
}

function selectedBranchOption(branch: CountryBranchRow): SearchSelectOption {
  return {
    value: branch.id,
    label: `${branch.name} (${branch.code})`,
    keywords: [branch.name, branch.code, branch.local_currency].filter(Boolean).join(" ")
  };
}

function printWizardSummary() {
  window.print();
}

export function CityBranchRegistrationWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [location, setLocation] = useState<LocationHierarchyValue>(defaultLocation);
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>(defaultMeta);
  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [currency, setCurrency] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [permissionTemplate, setPermissionTemplate] = useState("city-standard");
  const [permissionGrants, setPermissionGrants] = useState<string[]>(() => getPermissionKeysForTemplate("city-standard"));
  const [adminUser, setAdminUser] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: ""
  });
  const [communication, setCommunication] = useState({
    branchEmail: "",
    mailServerName: "City Branch Mail Server",
    smtpHost: "",
    smtpPort: "587",
    imapHost: "",
    imapPort: "993",
    sslSecure: true,
    smtpUser: "",
    smtpPass: "",
    whatsappNumber: "",
    smsNumber: "",
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    notifyEmail: true,
    notifyWhatsapp: true,
    notifySms: false,
    aiAutoReply: true
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedMainBranch = useMemo(
    () => mainBranches.find((branch) => branch.id === countryBranchId) ?? null,
    [mainBranches, countryBranchId]
  );

  const mainBranchOptions = useMemo(() => mainBranches.map(selectedBranchOption), [mainBranches]);
  const branchUnlocked = Boolean(location.countryId && countryBranchId);
  const activeStep = steps[stepIndex];
  const generatedEmail = communication.branchEmail || adminUser.email || (branchCode ? `${branchCode.toLowerCase()}@dgt.llc` : "");

  useEffect(() => {
    if (!location.countryId) {
      setMainBranches([]);
      setCountryBranchId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ countryBranches: CountryBranchRow[] }>(
          `/api/branch-management/country-branches?countryId=${encodeURIComponent(location.countryId)}`
        );
        if (cancelled) return;
        setMainBranches(res.countryBranches ?? []);
      } catch (error) {
        if (!cancelled) {
          setBanner({ type: "error", message: error instanceof Error ? error.message : "Unable to load main branches." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.countryId]);

  useEffect(() => {
    if (selectedMainBranch?.local_currency) setCurrency(selectedMainBranch.local_currency.toUpperCase());
  }, [selectedMainBranch]);

  useEffect(() => {
    if (!branchUnlocked || branchCode) return;
    setBranchCode(buildBranchCode(selectedMainBranch, locationMeta.city?.name));
  }, [branchUnlocked, branchCode, locationMeta.city?.name, selectedMainBranch]);

  useEffect(() => {
    if (!branchUnlocked || branchName) return;
    const cityName = locationMeta.city?.name;
    if (cityName) setBranchName(`${cityName} City Branch`);
  }, [branchUnlocked, branchName, locationMeta.city?.name]);

  useEffect(() => {
    const pieces = [locationMeta.area?.name, locationMeta.city?.name, locationMeta.state?.name, locationMeta.country?.name].filter(Boolean);
    if (!fullAddress && pieces.length) setFullAddress(pieces.join(", "));
  }, [fullAddress, locationMeta]);

  useEffect(() => {
    if (adminUser.email && !communication.branchEmail) {
      setCommunication((current) => ({ ...current, branchEmail: adminUser.email }));
    }
  }, [adminUser.email, communication.branchEmail]);

  function updateAdmin(field: keyof typeof adminUser, value: string) {
    setAdminUser((current) => ({ ...current, [field]: value }));
  }

  function updateCommunication(field: keyof typeof communication, value: string | boolean) {
    setCommunication((current) => ({ ...current, [field]: value }));
  }

  function stepError(index = stepIndex) {
    if (index === 0) {
      if (!location.countryId) return "Select Country first.";
      if (!countryBranchId) return "Select Main Branch before State and City.";
      if (!location.stateProvinceId) return "Select State / Province from Location Management.";
      if (!location.cityId) return "Select City from Location Management.";
      if (!branchName.trim()) return "Enter Branch Name.";
      if (!branchCode.trim()) return "Enter Branch Code.";
      if (!currency.trim()) return "Currency is required.";
    }
    if (index === 1 && !permissionGrants.length) return "Select at least one permission.";
    if (index === 2) {
      if (!adminUser.fullName.trim()) return "Enter Branch Admin full name.";
      if (!adminUser.username.trim()) return "Enter Username.";
      if (!adminUser.email.includes("@")) return "Enter a valid Admin email.";
      if (adminUser.password.length < 8) return "Password must be at least 8 characters.";
      if (adminUser.password !== adminUser.confirmPassword) return "Password and Confirm Password do not match.";
    }
    if (index === 3 && !generatedEmail.includes("@")) return "Official branch email is required.";
    return "";
  }

  function goNext() {
    const error = stepError();
    if (error) {
      setBanner({ type: "error", message: error });
      return;
    }
    setBanner(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleSubmit() {
    const firstError = steps.map((_, index) => stepError(index)).find(Boolean);
    if (firstError) {
      setBanner({ type: "error", message: firstError });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      const cityRes = await apiPost<{ id: string }>("/api/branch-management/city-branches", {
        countryId: location.countryId,
        countryBranchId,
        stateProvinceId: location.stateProvinceId || null,
        districtId: location.districtId || null,
        cityId: location.cityId || null,
        areaLocationId: location.areaId || null,
        cityName: locationMeta.city?.name ?? "",
        name: branchName,
        code: branchCode,
        currencyCode: currency,
        address: fullAddress,
        phone: phone || adminUser.phone,
        email: generatedEmail,
        whatsappNumber: communication.whatsappNumber,
        companyId: companyId || null,
        ownerName: ownerName || adminUser.fullName,
        contacts: [
          adminUser.phone ? { type: "Mobile", value: adminUser.phone } : null,
          generatedEmail ? { type: "Email", value: generatedEmail } : null,
          communication.whatsappNumber ? { type: "WhatsApp", value: communication.whatsappNumber } : null
        ].filter(Boolean),
        documents: [],
        permissionTemplate,
        permissionGrants,
        emailPrefix: branchCode.toLowerCase(),
        emailServerSettings: {
          mailServerName: communication.mailServerName,
          smtpHost: communication.smtpHost,
          smtpPort: communication.smtpPort,
          imapHost: communication.imapHost,
          imapPort: communication.imapPort,
          sslSecure: communication.sslSecure,
          smtpUser: communication.smtpUser,
          smtpPass: communication.smtpPass
        },
        whatsappConfig: {
          whatsappNumber: communication.whatsappNumber,
          wabaId: communication.wabaId,
          phoneNumberId: communication.phoneNumberId,
          accessToken: communication.accessToken,
          isActive: Boolean(communication.whatsappNumber)
        }
      });

      await apiPost<{ userId: string; userCode: string }>("/api/erp/users", {
        role: "city_branch_admin",
        fullName: adminUser.fullName,
        email: adminUser.email,
        password: adminUser.password,
        preferredLanguage: "en",
        userCode: adminUser.username,
        permissions: permissionGrants,
        phone: adminUser.phone,
        companyId: companyId || null,
        countryId: location.countryId,
        countryBranchId,
        cityBranchId: cityRes.id
      });

      setBanner({ type: "success", message: "City Branch, default Branch Admin, permissions and communication settings were saved successfully." });
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Unable to save City Branch wizard." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 print:px-0">
      <header className="rounded-2xl border bg-card p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">New Entry</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">City Branch Registration Wizard</h1>
            <p className="text-sm text-muted-foreground">
              Create a city branch with location hierarchy, permissions, branch admin login, AI communication and PDF-style review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button variant="outline" onClick={printWizardSummary}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 print:hidden lg:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = index === stepIndex;
          const done = index < stepIndex;
          return (
            <button
              key={step.key}
              type="button"
              className={cn(
                "rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/50",
                active && "border-primary bg-primary/5",
                done && "border-emerald-200 bg-emerald-50"
              )}
              onClick={() => {
                if (index <= stepIndex) setStepIndex(index);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-muted", active && "bg-primary text-primary-foreground", done && "bg-emerald-600 text-white")}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="text-xs font-bold text-muted-foreground">Step {index + 1}</span>
              </div>
              <div className="mt-3 text-sm font-bold">{step.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{step.subtitle}</div>
            </button>
          );
        })}
      </section>

      {banner ? (
        <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", banner.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
          {banner.message}
        </div>
      ) : null}

      <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{activeStep.title}</p>
              <h2 className="mt-1 text-lg font-bold">{activeStep.subtitle}</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{stepIndex + 1} / {steps.length}</span>
          </div>

          {activeStep.key === "branch" ? (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-3">
                <LocationHierarchySelect
                  value={location}
                  onChange={(next, meta) => {
                    setLocation(next);
                    setLocationMeta(meta);
                    if (next.countryId !== location.countryId) {
                      setCountryBranchId("");
                      setBranchCode("");
                      setCurrency("");
                    }
                  }}
                  showCountry
                  showState={branchUnlocked}
                  showDistrict={false}
                  showCity={branchUnlocked}
                  showArea={false}
                />
                {!branchUnlocked ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Select Country, then Main Branch. State and City dropdowns unlock after Main Branch is selected.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SearchSelect
                  label="Country Main Branch"
                  value={countryBranchId}
                  placeholder={location.countryId ? "Select Main Branch" : "Select Country first"}
                  disabled={!location.countryId}
                  options={mainBranchOptions}
                  onValueChange={(value) => {
                    setCountryBranchId(value);
                    setBranchCode("");
                  }}
                />
                <InputField label="Currency" value={currency} onChange={setCurrency} placeholder="PKR / AED / USD" />
                <InputField label="City Branch Name" value={branchName} onChange={setBranchName} placeholder="e.g. Chaman City Branch" />
                <InputField label="City Branch Code" value={branchCode} onChange={(value) => setBranchCode(normalizeCode(value))} placeholder="e.g. PAK-CH-001" />
                <InputField label="Phone Number" value={phone} onChange={setPhone} placeholder="+92..." />
                <CompanyPicker label="Linked Company / Owner Master" value={companyId} onValueChange={setCompanyId} placeholder="Search company master..." />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputField label="Owner / Manager Name" value={ownerName} onChange={setOwnerName} placeholder="Branch owner or manager" />
                <div />
              </div>
              <label className="block space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Full Address</Label>
                <textarea
                  className="min-h-[110px] w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  value={fullAddress}
                  onChange={(event) => setFullAddress(event.target.value)}
                  placeholder="Full branch address..."
                />
              </label>
            </div>
          ) : null}

          {activeStep.key === "permissions" ? (
            <PermissionAssignmentSection
              title="City Branch Roles, Permissions & Operational Rights"
              level="city_branch"
              template={permissionTemplate}
              selected={permissionGrants}
              onTemplateChange={setPermissionTemplate}
              onSelectedChange={setPermissionGrants}
              parentPermissions={selectedMainBranch?.permission_grants ?? undefined}
              required
              note="The city branch can only receive permissions allowed by the selected country main branch."
            />
          ) : null}

          {activeStep.key === "admin" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Full Name" value={adminUser.fullName} onChange={(value) => updateAdmin("fullName", value)} />
              <InputField label="Username / Login ID" value={adminUser.username} onChange={(value) => updateAdmin("username", value)} />
              <InputField label="Email" value={adminUser.email} onChange={(value) => updateAdmin("email", value)} />
              <InputField label="Phone Number" value={adminUser.phone} onChange={(value) => updateAdmin("phone", value)} />
              <PasswordField label="Password" value={adminUser.password} onChange={(value) => updateAdmin("password", value)} />
              <PasswordField label="Confirm Password" value={adminUser.confirmPassword} onChange={(value) => updateAdmin("confirmPassword", value)} />
              <div className="md:col-span-2 rounded-xl border bg-blue-50 p-3 text-sm text-blue-900">
                This step creates the default <strong>City Branch Admin</strong> account after the branch is saved. The account receives the selected permissions and branch scope automatically.
              </div>
            </div>
          ) : null}

          {activeStep.key === "communication" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Official Branch Email" value={communication.branchEmail} onChange={(value) => updateCommunication("branchEmail", value)} />
                <InputField label="Mail Server Name" value={communication.mailServerName} onChange={(value) => updateCommunication("mailServerName", value)} />
                <InputField label="SMTP Host" value={communication.smtpHost} onChange={(value) => updateCommunication("smtpHost", value)} />
                <InputField label="SMTP Port" value={communication.smtpPort} onChange={(value) => updateCommunication("smtpPort", value)} />
                <InputField label="IMAP Host" value={communication.imapHost} onChange={(value) => updateCommunication("imapHost", value)} />
                <InputField label="IMAP Port" value={communication.imapPort} onChange={(value) => updateCommunication("imapPort", value)} />
                <InputField label="SMTP User" value={communication.smtpUser} onChange={(value) => updateCommunication("smtpUser", value)} />
                <PasswordField label="SMTP Password / App Password" value={communication.smtpPass} onChange={(value) => updateCommunication("smtpPass", value)} />
                <InputField label="WhatsApp Business Number" value={communication.whatsappNumber} onChange={(value) => updateCommunication("whatsappNumber", value)} />
                <InputField label="SMS Number" value={communication.smsNumber} onChange={(value) => updateCommunication("smsNumber", value)} />
                <InputField label="WABA ID" value={communication.wabaId} onChange={(value) => updateCommunication("wabaId", value)} />
                <InputField label="Phone Number ID" value={communication.phoneNumberId} onChange={(value) => updateCommunication("phoneNumberId", value)} />
              </div>
              <label className="block space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">WhatsApp Access Token</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  value={communication.accessToken}
                  onChange={(event) => updateCommunication("accessToken", event.target.value)}
                  placeholder="Paste secure token only when ready..."
                />
              </label>
              <div className="grid gap-3 md:grid-cols-4">
                <CheckOption label="Email Alerts" checked={communication.notifyEmail} onChange={(value) => updateCommunication("notifyEmail", value)} />
                <CheckOption label="WhatsApp Alerts" checked={communication.notifyWhatsapp} onChange={(value) => updateCommunication("notifyWhatsapp", value)} />
                <CheckOption label="SMS Alerts" checked={communication.notifySms} onChange={(value) => updateCommunication("notifySms", value)} />
                <CheckOption label="AI Auto Reply" checked={communication.aiAutoReply} onChange={(value) => updateCommunication("aiAutoReply", value)} />
              </div>
            </div>
          ) : null}

          {activeStep.key === "review" ? (
            <PdfPreview
              branchName={branchName}
              branchCode={branchCode}
              currency={currency}
              country={locationMeta.country?.name}
              mainBranch={selectedMainBranch?.name}
              state={locationMeta.state?.name}
              city={locationMeta.city?.name}
              address={fullAddress}
              admin={adminUser}
              permissions={permissionGrants}
              email={generatedEmail}
              whatsapp={communication.whatsappNumber}
              notifications={{
                email: communication.notifyEmail,
                whatsapp: communication.notifyWhatsapp,
                sms: communication.notifySms,
                ai: communication.aiAutoReply
              }}
            />
          ) : null}
        </section>

        <aside className="space-y-4 print:hidden">
          <LivePreview
            branchName={branchName}
            branchCode={branchCode}
            currency={currency}
            country={locationMeta.country?.name}
            mainBranch={selectedMainBranch?.name}
            state={locationMeta.state?.name}
            city={locationMeta.city?.name}
            address={fullAddress}
            admin={adminUser}
            email={generatedEmail}
            whatsapp={communication.whatsappNumber}
          />
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4 text-primary" /> Submission Controls
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="outline" disabled={stepIndex === 0 || saving} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {stepIndex < steps.length - 1 ? (
                <Button onClick={goNext} disabled={saving}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? "Submitting..." : "Submit City Branch"}
                </Button>
              )}
              <Button variant="outline" onClick={printWizardSummary}>
                <Download className="mr-2 h-4 w-4" /> Download PDF Summary
              </Button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-lg text-sm" />
    </label>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <Input type="password" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg text-sm" />
    </label>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold", checked ? "border-primary bg-primary/5" : "bg-background")}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function LivePreview({
  branchName,
  branchCode,
  currency,
  country,
  mainBranch,
  state,
  city,
  address,
  admin,
  email,
  whatsapp
}: {
  branchName: string;
  branchCode: string;
  currency: string;
  country?: string;
  mainBranch?: string;
  state?: string;
  city?: string;
  address: string;
  admin: { fullName: string; username: string; email: string; phone: string };
  email: string;
  whatsapp: string;
}) {
  const rows = [
    ["Country", country || "-"],
    ["Main Branch", mainBranch || "-"],
    ["State / Province", state || "-"],
    ["City", city || "-"],
    ["Branch Name", branchName || "-"],
    ["Branch Code", branchCode || "-"],
    ["Currency", currency || "-"],
    ["Default Admin", admin.fullName || "-"],
    ["Username", admin.username || "-"],
    ["Official Email", email || "-"],
    ["WhatsApp", whatsapp || "-"],
    ["Address", address || "-"]
  ];
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Live Preview</p>
          <h3 className="mt-1 text-lg font-bold">{branchName || "City Branch Draft"}</h3>
        </div>
        <span className="rounded-full border bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Draft</span>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[120px_1fr] gap-3 border-b py-2 text-xs">
            <span className="font-semibold text-muted-foreground">{label}</span>
            <span className="font-bold text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfPreview({
  branchName,
  branchCode,
  currency,
  country,
  mainBranch,
  state,
  city,
  address,
  admin,
  permissions,
  email,
  whatsapp,
  notifications
}: {
  branchName: string;
  branchCode: string;
  currency: string;
  country?: string;
  mainBranch?: string;
  state?: string;
  city?: string;
  address: string;
  admin: { fullName: string; username: string; email: string; phone: string };
  permissions: string[];
  email: string;
  whatsapp: string;
  notifications: { email: boolean; whatsapp: boolean; sms: boolean; ai: boolean };
}) {
  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-6 text-slate-950 shadow-sm print:border-0 print:shadow-none">
      <div className="flex items-start justify-between border-b-4 border-slate-900 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">DAMAAN BUSINESS GROUP ERP</p>
          <h2 className="mt-2 text-3xl font-black">City Branch Registration Summary</h2>
          <p className="mt-1 text-sm text-slate-500">Review & PDF Summary before final submission</p>
        </div>
        <div className="text-right text-xs font-bold">
          <div>Status: Draft</div>
          <div>Generated: {new Date().toLocaleString()}</div>
          <div>Currency: {currency || "-"}</div>
        </div>
      </div>

      <PreviewSection title="1. Branch Information">
        <PreviewGrid
          rows={[
            ["Country", country || "-"],
            ["Main Branch", mainBranch || "-"],
            ["State / Province", state || "-"],
            ["City", city || "-"],
            ["Branch Name", branchName || "-"],
            ["Branch Code", branchCode || "-"],
            ["Currency", currency || "-"],
            ["Full Address", address || "-"]
          ]}
        />
      </PreviewSection>

      <PreviewSection title="2. Roles & Permissions">
        <div className="flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <span key={permission} className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
              {permission}
            </span>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="3. Branch Admin Account">
        <PreviewGrid
          rows={[
            ["Full Name", admin.fullName || "-"],
            ["Username", admin.username || "-"],
            ["Email", admin.email || "-"],
            ["Phone", admin.phone || "-"],
            ["Role", "City Branch Admin"]
          ]}
        />
      </PreviewSection>

      <PreviewSection title="4. AI Branch Communication Setup">
        <PreviewGrid
          rows={[
            ["Official Email", email || "-"],
            ["WhatsApp Business", whatsapp || "-"],
            ["Email Alerts", notifications.email ? "Enabled" : "Disabled"],
            ["WhatsApp Alerts", notifications.whatsapp ? "Enabled" : "Disabled"],
            ["SMS Alerts", notifications.sms ? "Enabled" : "Disabled"],
            ["AI Auto Reply", notifications.ai ? "Enabled" : "Disabled"]
          ]}
        />
      </PreviewSection>

      <div className="mt-8 grid grid-cols-2 gap-8 text-xs font-bold">
        <div className="border-t pt-3">Prepared By</div>
        <div className="border-t pt-3 text-right">Approved By</div>
      </div>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 overflow-hidden rounded-xl border">
      <div className="bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function PreviewGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[140px_1fr] gap-3 border-b py-2 text-xs">
          <span className="font-bold text-slate-500">{label}</span>
          <span className="font-black text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}


