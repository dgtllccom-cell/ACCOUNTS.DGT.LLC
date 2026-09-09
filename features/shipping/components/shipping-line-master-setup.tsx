"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ship,
  Plus,
  Search,
  Building2,
  Globe2,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  Layers,
  ArrowRight,
  Printer,
  FileSpreadsheet,
  Edit2,
  CheckSquare,
  Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { localizeTerm } from "@/lib/i18n/transliteration";

export type ShippingLineItem = {
  id: string;
  shipping_line_code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country_id: string | null;
  remarks: string | null;
  linked_countries?: string[] | null;
  is_active: boolean;
  created_at: string;
  account_id?: string | null;
  account_number?: string | null;
};

export function ShippingLineMasterSetup() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const [lines, setLines] = useState<ShippingLineItem[]>([]);
  const [branchCountries, setBranchCountries] = useState<LocationCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [countryId, setCountryId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedLinkedCountries, setSelectedLinkedCountries] = useState<string[]>([]);
  const [autoCreateAccount, setAutoCreateAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [shlRes, countriesRes] = await Promise.all([
        apiGet<{ shippingLines: ShippingLineItem[] }>(`/api/erp/shipping-lines?limit=200&lang=${encodeURIComponent(lang)}`),
        listCountries({ withBranchesOnly: true })
      ]);
      setLines(shlRes.shippingLines ?? []);
      setBranchCountries(countriesRes ?? []);
    } catch (err) {
      console.error("Failed to load shipping lines:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => null);
  }, [lang]);

  function handleOpenNew() {
    setEditingId(null);
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setWebsite("");
    setCountryId(branchCountries[0]?.id || "");
    setRemarks("");
    // Pre-select all operating branch countries by default for maximum connectivity
    setSelectedLinkedCountries(branchCountries.map((c) => c.id));
    setAutoCreateAccount(true);
    setMessage(null);
    setModalOpen(true);
  }

  function handleOpenEdit(item: ShippingLineItem) {
    setEditingId(item.id);
    setName(item.name);
    setContactPerson(item.contact_person || "");
    setPhone(item.phone || "");
    setEmail(item.email || "");
    setWebsite(item.website || "");
    setCountryId(item.country_id || "");
    setRemarks(item.remarks || "");
    setSelectedLinkedCountries(Array.isArray(item.linked_countries) ? item.linked_countries : []);
    setAutoCreateAccount(false);
    setMessage(null);
    setModalOpen(true);
  }

  function toggleLinkedCountry(cId: string) {
    setSelectedLinkedCountries((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  }

  function selectAllLinkedCountries() {
    setSelectedLinkedCountries(branchCountries.map((c) => c.id));
  }

  function clearAllLinkedCountries() {
    setSelectedLinkedCountries([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: "error", text: "Shipping line name is required." });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      if (editingId) {
        await apiPatch(`/api/erp/shipping-lines/${editingId}`, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          countryId: countryId || null,
          remarks: remarks.trim() || null,
          linkedCountries: selectedLinkedCountries
        });
        setMessage({ type: "success", text: "Shipping line updated successfully." });
      } else {
        const createRes = await apiPost<{ shippingLineId: string }>("/api/erp/shipping-lines", {
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          countryId: countryId || null,
          remarks: remarks.trim() || null,
          originalLanguage: lang,
          linkedCountries: selectedLinkedCountries
        });

        const newId = createRes.shippingLineId;

        // Optionally create financial account in Chart of Accounts
        if (autoCreateAccount && newId) {
          try {
            await apiPost("/api/erp/accounting/accounts", {
              scope: "country",
              operationalDomain: "shipping",
              countryId: countryId || branchCountries[0]?.id,
              shippingLineId: newId,
              linkedCountries: selectedLinkedCountries,
              code: "AUTO",
              name: `${name.trim()} (Shipping Line Account)`,
              kind: "asset",
              currency: branchCountries.find((c) => c.id === countryId)?.currency_code || "USD",
              category: "P/S",
              status: "active",
              contacts: [
                ...(phone.trim() ? [{ type: "Phone", value: phone.trim() }] : []),
                ...(email.trim() ? [{ type: "Email", value: email.trim() }] : [])
              ]
            });
          } catch (accErr) {
            console.warn("Auto-create shipping account notice:", accErr);
          }
        }
        setMessage({ type: "success", text: "Shipping Line registered successfully!" });
      }

      await loadData();
      setTimeout(() => {
        setModalOpen(false);
      }, 700);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save shipping line." });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => {
      const code = line.shipping_line_code || "";
      const nm = line.name || "";
      const cp = line.contact_person || "";
      const em = line.email || "";
      return (
        code.toLowerCase().includes(q) ||
        nm.toLowerCase().includes(q) ||
        cp.toLowerCase().includes(q) ||
        em.toLowerCase().includes(q)
      );
    });
  }, [lines, search]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t(lang, "shl.master_title", "Shipping Line Master & Accounts")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t(
                  lang,
                  "shl.master_subtitle",
                  "Register maritime shipping lines, configure inter-country operational links, and create dedicated accounts."
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/accounts/setup?operationalDomain=shipping")}
            className="h-9 gap-2 text-xs font-semibold"
          >
            <Building2 className="h-4 w-4 text-slate-500" />
            {t(lang, "shl.create_account", "New Account Setup")}
          </Button>
          <Button onClick={handleOpenNew} size="sm" className="h-9 gap-2 text-xs font-semibold shadow-xs">
            <Plus className="h-4 w-4" />
            {t(lang, "shl.register_new", "Register Shipping Line")}
          </Button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Shipping Lines
            </CardDescription>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
              {lines.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Registered maritime carriers</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Operating Countries
            </CardDescription>
            <CardTitle className="text-2xl font-black text-primary">
              {branchCountries.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Countries with active branch networks</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Active Inter-Country Routes
            </CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-600">
              {branchCountries.length > 1 ? `${branchCountries.length * (branchCountries.length - 1)} pairs` : "Single"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Cross-border freight linkages</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Chart of Accounts Sync
            </CardDescription>
            <CardTitle className="text-2xl font-black text-blue-600">
              Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Auto-linked general ledgers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & List Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "shl.search_lines", "Search shipping line by name, code, contact...")}
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} className="h-8 text-xs">
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading shipping lines...</div>
          ) : filteredLines.length === 0 ? (
            <div className="p-12 text-center">
              <Ship className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No Shipping Lines Found</h3>
              <p className="mt-1 text-xs text-slate-500">
                Register your first shipping line (e.g. Maersk, MSC, CMA CGM) and link operating countries.
              </p>
              <Button onClick={handleOpenNew} size="sm" className="mt-4 h-8 gap-1.5 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Register Shipping Line
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Shipping Line Name</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Contact Info</th>
                  <th className="px-4 py-3">Linked Operating Countries</th>
                  <th className="px-4 py-3">Financial Account</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLines.map((line) => {
                  const linkedIds = Array.isArray(line.linked_countries) ? line.linked_countries : [];
                  const linkedCountryNames = branchCountries
                    .filter((c) => linkedIds.includes(c.id))
                    .map((c) => c.iso2 || c.name);

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {line.shipping_line_code || "SHL-NEW"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-primary shrink-0" />
                          <span>{localizeTerm(line.name, lang)}</span>
                        </div>
                        {line.website && (
                          <a
                            href={line.website.startsWith("http") ? line.website : `https://${line.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {line.website}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {line.contact_person || "-"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="space-y-0.5">
                          {line.phone && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{line.phone}</span>
                            </div>
                          )}
                          {line.email && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{line.email}</span>
                            </div>
                          )}
                          {!line.phone && !line.email && "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {linkedCountryNames.length > 0 ? (
                            linkedCountryNames.map((cName) => (
                              <span
                                key={cName}
                                className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              >
                                🌐 {cName}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">All Branches</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/accounts/setup?shippingLineId=${line.id}&operationalDomain=shipping`)}
                          className="h-7 gap-1 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          Create / View Account
                        </Button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(line)}
                          className="h-7 gap-1 text-[11px]"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Register / Edit Shipping Line */}
      {modalOpen && (
        <SimpleModal
          title={editingId ? "Edit Shipping Line" : "Register New Shipping Line"}
          onClose={() => setModalOpen(false)}
          className="w-[96vw] max-w-2xl rounded-2xl p-0 font-sans"
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {message && (
              <div
                className={`rounded-lg p-3 text-xs font-semibold ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-800">
                  Shipping Line Name *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maersk Line, MSC Mediterranean Shipping, CMA CGM"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Contact Person</Label>
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Shipping Line Line Manager"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Primary Operating Country *</Label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select country...</option>
                  {branchCountries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localizeTerm(c.name, lang)} ({c.iso2 || "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Official Phone / Mobile</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971 4 1234567"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Official Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operations@maersk.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-800">Website / Tracking Portal</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.maersk.com/tracking"
                  className="h-9 text-xs"
                />
              </div>

              {/* ── Linked Operating Countries (لین دین / Inter-Country Linkage) ── */}
              <div className="sm:col-span-2 space-y-2 rounded-xl bg-blue-50/70 p-4 border border-blue-200/80 dark:bg-blue-950/30 dark:border-blue-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Linked Operating & Dealing Countries (لین دین / Inter-Country Dealing) *
                    </Label>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      Select which countries this Shipping Line operates cargo shipments and fund transfers between (tick mark all that apply):
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllLinkedCountries}
                      className="h-6 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:text-blue-300"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllLinkedCountries}
                      className="h-6 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:text-blue-300"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {branchCountries.map((c) => {
                    const isChecked = selectedLinkedCountries.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleLinkedCountry(c.id)}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs font-semibold text-left transition-all ${
                          isChecked
                            ? "bg-white border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-500 dark:bg-slate-900 dark:text-blue-100"
                            : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{localizeTerm(c.name, lang)} ({c.iso2 || "-"})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Create Account Option */}
              {!editingId && (
                <div className="sm:col-span-2 flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="autoCreateAccount"
                    checked={autoCreateAccount}
                    onChange={(e) => setAutoCreateAccount(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="autoCreateAccount" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Automatically create Financial Account in Chart of Accounts for this Shipping Line
                  </Label>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-800">Remarks / Port Access Notes</Label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Primary ocean carrier for Dubai-Karachi-Bandar Abbas route"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="min-w-[100px]">
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Register Shipping Line"}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}
