"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  Key,
  Mail,
  MailPlus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

type EmailAccountRow = {
  id: string;
  emailAddress: string;
  displayName: string;
  scope: string;
  isActive: boolean;
  isDefault: boolean;
  countryId: string | null;
  countryName: string | null;
  countryIso2: string | null;
  countryBranchId: string | null;
  countryBranchName: string | null;
  cityBranchId: string | null;
  cityBranchName: string | null;
  companyName: string;
  providerName: string;
  smtpHost: string;
  smtpPort: number | string;
  smtpUser: string;
  smtpSecure: boolean;
  hasPassword: boolean;
  smtpStatus: string;
  emailStatus: string;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountsResponse = {
  accounts: EmailAccountRow[];
  summary: {
    total: number;
    active: number;
    connected: number;
    failed: number;
  };
  countries: Array<{ id: string; name: string; iso2: string | null }>;
  countryBranches: Array<{ id: string; name: string; code: string; country_id: string }>;
  cityBranches: Array<{ id: string; name: string; code: string; city_name: string; country_id: string; country_branch_id: string }>;
  companies: Array<{ id: string; name: string }>;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

const FLAG_MAP: Record<string, string> = {
  PK: "🇵🇰", AE: "🇦🇪", US: "🇺🇸", GB: "🇬🇧", SA: "🇸🇦", IN: "🇮🇳",
  AF: "🇦🇫", TR: "🇹🇷", CN: "🇨🇳", IR: "🇮🇷", IQ: "🇮🇶", OM: "🇴🇲"
};

function countryFlag(iso2: string | null) {
  if (!iso2) return "🌍";
  return FLAG_MAP[iso2.toUpperCase()] || "🌍";
}

export function EmailAccountsManagement() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccountRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordAccountId, setPasswordAccountId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formCountryId, setFormCountryId] = useState("");
  const [formCityBranchId, setFormCityBranchId] = useState("");
  const [formScope, setFormScope] = useState("city_branch");
  const [formSmtpHost, setFormSmtpHost] = useState("");
  const [formSmtpPort, setFormSmtpPort] = useState("465");
  const [formSmtpUser, setFormSmtpUser] = useState("");
  const [formSmtpPass, setFormSmtpPass] = useState("");
  const [formSmtpSecure, setFormSmtpSecure] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formShowPass, setFormShowPass] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<AccountsResponse>("/api/erp/email/accounts");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load email accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredAccounts = (data?.accounts || []).filter((acc) => {
    if (filterStatus === "active" && !acc.isActive) return false;
    if (filterStatus === "inactive" && acc.isActive) return false;
    if (filterStatus === "connected" && !acc.smtpStatus.includes("Connected")) return false;
    if (filterStatus === "failed" && !acc.smtpStatus.includes("Failed") && !acc.smtpStatus.includes("Incomplete")) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      acc.emailAddress.toLowerCase().includes(q) ||
      acc.displayName.toLowerCase().includes(q) ||
      (acc.countryName || "").toLowerCase().includes(q) ||
      (acc.cityBranchName || "").toLowerCase().includes(q) ||
      acc.companyName.toLowerCase().includes(q) ||
      acc.providerName.toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditingAccount(null);
    setFormEmail("");
    setFormDisplayName("");
    setFormCountryId(data?.countries?.[0]?.id || "");
    setFormCityBranchId("");
    setFormScope("city_branch");
    setFormSmtpHost("");
    setFormSmtpPort("465");
    setFormSmtpUser("");
    setFormSmtpPass("");
    setFormSmtpSecure(true);
    setFormIsActive(true);
    setFormShowPass(false);
    setModalOpen(true);
  }

  function openEdit(acc: EmailAccountRow) {
    setEditingAccount(acc);
    setFormEmail(acc.emailAddress);
    setFormDisplayName(acc.displayName);
    setFormCountryId(acc.countryId || "");
    setFormCityBranchId(acc.cityBranchId || "");
    setFormScope(acc.scope || "city_branch");
    setFormSmtpHost(acc.smtpHost);
    setFormSmtpPort(String(acc.smtpPort || "465"));
    setFormSmtpUser(acc.smtpUser);
    setFormSmtpPass("");
    setFormSmtpSecure(acc.smtpSecure);
    setFormIsActive(acc.isActive);
    setFormShowPass(false);
    setModalOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      if (editingAccount) {
        const payload: any = {
          id: editingAccount.id,
          emailAddress: formEmail,
          displayName: formDisplayName,
          countryId: formCountryId || undefined,
          cityBranchId: formCityBranchId || null,
          scope: formScope,
          smtpHost: formSmtpHost,
          smtpPort: Number(formSmtpPort),
          smtpUser: formSmtpUser,
          smtpSecure: formSmtpSecure,
          isActive: formIsActive
        };
        if (formSmtpPass) payload.smtpPass = formSmtpPass;
        await apiPut("/api/erp/email/accounts", payload);
      } else {
        await apiPost("/api/erp/email/accounts", {
          emailAddress: formEmail,
          displayName: formDisplayName,
          countryId: formCountryId,
          cityBranchId: formCityBranchId || null,
          scope: formScope,
          smtpHost: formSmtpHost,
          smtpPort: Number(formSmtpPort),
          smtpUser: formSmtpUser,
          smtpPass: formSmtpPass,
          smtpSecure: formSmtpSecure,
          isActive: formIsActive
        });
      }
      setModalOpen(false);
      refresh();
    } catch (err: any) {
      alert(err.message || "Failed to save email account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(accountId: string) {
    try {
      setTestingId(accountId);
      await apiPost(`/api/erp/email/accounts/${accountId}/test`, {});
      alert("✅ SMTP connection verified successfully!");
      refresh();
    } catch (err: any) {
      alert(`❌ SMTP test failed: ${err.message}`);
      refresh();
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleActive(acc: EmailAccountRow) {
    try {
      await apiPut("/api/erp/email/accounts", {
        id: acc.id,
        isActive: !acc.isActive
      });
      refresh();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status.");
    }
  }

  async function handleChangePassword() {
    if (!passwordAccountId || !newPassword) return;
    try {
      setSaving(true);
      await apiPut("/api/erp/email/accounts", {
        id: passwordAccountId,
        smtpPass: newPassword
      });
      setPasswordModalOpen(false);
      setNewPassword("");
      setPasswordAccountId(null);
      alert("✅ Password updated and encrypted successfully.");
      refresh();
    } catch (err: any) {
      alert(err.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/erp/email/accounts?id=${id}`);
      setDeleteConfirmId(null);
      refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete account.");
    }
  }

  const summary = data?.summary || { total: 0, active: 0, connected: 0, failed: 0 };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{tt("nav.settings", "Settings")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tt("email_acct.title", "Email Accounts")}</h1>
          <p className="text-sm text-muted-foreground">
            {tt("email_acct.security_notice", "Manage official branch email accounts, SMTP settings, passwords, and connection status.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
            {tt("common.refresh", "Refresh")}
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-blue-600 text-white shadow-sm hover:bg-blue-700">
            <Plus className="mr-2 h-3.5 w-3.5" />
            {tt("email_acct.create", "Create Email Account")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Mail} label={tt("email_acct.total_accounts", "Total Accounts")} value={summary.total} color="text-blue-600 bg-blue-50 dark:bg-blue-950/30" />
        <SummaryCard icon={Zap} label={tt("common.active", "Active")} value={summary.active} color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" />
        <SummaryCard icon={Wifi} label={tt("email_acct.connected", "Connected")} value={summary.connected} color="text-green-600 bg-green-50 dark:bg-green-950/30" />
        <SummaryCard icon={WifiOff} label={tt("email_acct.failed_incomplete", "Failed / Incomplete")} value={summary.failed} color="text-red-600 bg-red-50 dark:bg-red-950/30" />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tt("common.search", "Search accounts...")}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "all", label: tt("common.all", "All") },
            { key: "active", label: tt("common.active", "Active") },
            { key: "inactive", label: tt("common.inactive", "Inactive") },
            { key: "connected", label: tt("email_acct.smtp_status", "Connected") },
            { key: "failed", label: tt("email_acct.email_status", "Failed") }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                filterStatus === f.key
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">{tt("email_acct.loading", "Loading email accounts...")}</span>
        </div>
      )}

      {/* Accounts Table */}
      {data && (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Country</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Company</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Branch</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.official_email", "Official Email")}</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.provider", "Provider")}</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.smtp_status", "SMTP Status")}</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.email_status", "Email Status")}</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.last_tested", "Last Tested")}</Th>
                  <Th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("email_acct.last_sent", "Last Sent")}</Th>
                  <Th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tt("common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="font-medium">{tt("email_acct.empty", "No email accounts found")}</p>
                      <p className="text-xs mt-1">{tt("email_acct.no_accounts", "Create a new email account to get started.")}</p>
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="mr-1.5">{countryFlag(acc.countryIso2)}</span>
                        <span className="font-medium text-foreground">{acc.countryName || "—"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{acc.companyName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-foreground">{acc.cityBranchName || acc.countryBranchName || "Global"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs font-medium text-foreground">{acc.emailAddress}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium">
                          {acc.providerName}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">{acc.smtpStatus}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">{acc.emailStatus}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(acc.lastTestedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(acc.lastSentAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title={tt("common.edit", "Edit")}
                            onClick={() => openEdit(acc)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title={tt("email_acct.test_smtp", "Test SMTP")}
                            onClick={() => handleTest(acc.id)}
                            disabled={testingId === acc.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 transition-colors disabled:opacity-50"
                          >
                            {testingId === acc.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Activity className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            title={tt("email_acct.change_password", "Change Password")}
                            onClick={() => {
                              setPasswordAccountId(acc.id);
                              setNewPassword("");
                              setShowPassword(false);
                              setPasswordModalOpen(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 transition-colors"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title={acc.isActive ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(acc)}
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                              acc.isActive
                                ? "text-green-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                : "text-muted-foreground hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/30"
                            )}
                          >
                            {acc.isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            title={tt("common.delete", "Delete")}
                            onClick={() => setDeleteConfirmId(acc.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{tt("email_acct.security_notice", "Security Notice")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
              {tt("email_acct.security_notice", "All SMTP passwords and API tokens are encrypted using AES-256-CBC before saving to the database. Passwords are never displayed in plain text.")}
            </p>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <SimpleModal
          title={editingAccount ? tt("email_acct.update", "Edit Email Account") : tt("email_acct.create", "Create Email Account")}
          onClose={() => setModalOpen(false)}
          className="max-w-xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address *</Label>
                <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="dgtllc@dgt.llc" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("ema.display_name", "Display Name")} *</Label>
                <Input value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} placeholder={tt("ema.display_name_ph", "e.g. Company / Department name")} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Country *</Label>
                <select
                  value={formCountryId}
                  onChange={(e) => { setFormCountryId(e.target.value); setFormCityBranchId(""); }}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
                >
                  <option value="">-- Select Country --</option>
                  {data?.countries?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Branch</Label>
                <select
                  value={formCityBranchId}
                  onChange={(e) => setFormCityBranchId(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
                  disabled={!formCountryId}
                >
                  <option value="">-- Select Branch --</option>
                  {data?.cityBranches
                    ?.filter((b) => b.country_id === formCountryId)
                    ?.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scope</Label>
              <select
                value={formScope}
                onChange={(e) => setFormScope(e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
              >
                <option value="city_branch">{tt("email_acct.scope_city_branch", "City Branch")}</option>
                <option value="country_branch">{tt("email_acct.scope_country_branch", "Country Branch")}</option>
                <option value="country">{tt("email_acct.scope_country", "Country")}</option>
                <option value="super_admin">{tt("email_acct.scope_super_admin", "Super Admin (Global)")}</option>
              </select>
            </div>

            <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Server className="h-3.5 w-3.5 text-primary" />
                {tt("ema.smtp_config", "SMTP Configuration")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SMTP Host *</Label>
                  <Input value={formSmtpHost} onChange={(e) => setFormSmtpHost(e.target.value)} placeholder="mail.dgt.llc" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SMTP Port *</Label>
                  <Input value={formSmtpPort} onChange={(e) => setFormSmtpPort(e.target.value)} placeholder="465" type="number" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Username *</Label>
                  <Input value={formSmtpUser} onChange={(e) => setFormSmtpUser(e.target.value)} placeholder="dgtllc@dgt.llc" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{editingAccount ? "New Password (leave blank to keep)" : "Password *"}</Label>
                  <div className="relative">
                    <Input
                      type={formShowPass ? "text" : "password"}
                      value={formSmtpPass}
                      onChange={(e) => setFormSmtpPass(e.target.value)}
                      placeholder={editingAccount ? "••••••••" : "App Password or SMTP Password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setFormShowPass(!formShowPass)}
                    >
                      {formShowPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSmtpSecure}
                    onChange={(e) => setFormSmtpSecure(e.target.checked)}
                    className="rounded border-input"
                  />
                  {tt("ema.ssl_tls", "SSL/TLS Secure Connection")}
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-input"
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !formEmail || !formSmtpHost} className="flex-1">
                {saving ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {tt("email_acct.saving", "Saving...")}</>
                ) : editingAccount ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> {tt("email_acct.update", "Update Account")}</>
                ) : (
                  <><MailPlus className="mr-2 h-4 w-4" /> {tt("email_acct.create", "Create Account")}</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)}>{tt("common.cancel", "Cancel")}</Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <SimpleModal
          title={tt("email_acct.change_password", "Change SMTP Password")}
          onClose={() => setPasswordModalOpen(false)}
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
              <Shield className="mr-1.5 inline h-3.5 w-3.5" />
              {tt("ema.pwd_encrypt_notice", "Password will be encrypted with AES-256-CBC before saving. It will never be displayed again.")}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tt("ema.new_password", "New Password / App Password")}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={tt("email_acct.new_password_ph", "Enter new password")}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleChangePassword} disabled={saving || !newPassword} className="flex-1">
                {saving ? tt("email_acct.saving", "Encrypting...") : tt("email_acct.change_password", "Update Password")}
              </Button>
              <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>{tt("common.cancel", "Cancel")}</Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <SimpleModal
          title={tt("common.confirm_delete", "Delete Email Account")}
          onClose={() => setDeleteConfirmId(null)}
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
              {tt("email_acct.empty", "This will deactivate and soft-delete this email account.")}
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirmId)} className="flex-1">
                <Trash2 className="mr-2 h-4 w-4" />
                {tt("common.delete", "Delete Account")}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>{tt("common.cancel", "Cancel")}</Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
