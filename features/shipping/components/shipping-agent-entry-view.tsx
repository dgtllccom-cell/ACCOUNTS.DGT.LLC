"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Search, Loader2, RefreshCw, Ship, CheckCircle2, Building2, User, Phone, Mail, Globe } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Th } from "@/components/ui/translated-th";
import { ClearingAgentPicker, type ClearingAgentRow as ClearingAgentPickerRow } from "@/features/shipping/components/clearing-agent-picker";
import { ShippingLinePicker, type ShippingLineRow as ShippingLinePickerRow } from "@/features/shipping/components/shipping-line-picker";
import { apiGet } from "@/lib/api/client";

type ShippingAgentRow = {
  id: string;
  agent_code: string;
  agent_name: string;
  clearing_agent_id: string | null;
  shipping_line_name: string;
  shipping_line_id: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city_name: string | null;
  country_name: string | null;
  status: "active" | "inactive";
  remarks: string | null;
  created_at: string;
};

const EMPTY_AGENT: any = {
  id: "",
  agent_code: "",
  agent_name: "",
  clearing_agent_id: "",
  shipping_line_name: "",
  shipping_line_id: "",
  contact_person: "",
  email: "",
  phone: "",
  city_name: "",
  country_name: "",
  status: "active",
  remarks: "",
};

export function ShippingAgentEntryView({ lang: langProp }: { lang: SupportedLanguage }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const dir = getLanguageDirection(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [rows, setRows] = useState<ShippingAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<any>(EMPTY_AGENT);
  const [isEditing, setIsEditing] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/shipping-line/agent-entry");
      const json = await res.json();
      if (json.success) {
        setRows(json.data || []);
      } else {
        throw new Error(json.error || "Failed to load shipping agents");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = query.trim().toLowerCase();
      return (
        !q ||
        (r.agent_code && r.agent_code.toLowerCase().includes(q)) ||
        (r.agent_name && r.agent_name.toLowerCase().includes(q)) ||
        (r.shipping_line_name && r.shipping_line_name.toLowerCase().includes(q)) ||
        (r.contact_person && r.contact_person.toLowerCase().includes(q)) ||
        (r.city_name && r.city_name.toLowerCase().includes(q))
      );
    });
  }, [rows, query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/erp/shipping-line/agent-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save shipping agent");

      setSuccessMessage(`Shipping Agent ${json.data.agent_name || "saved"} created successfully!`);
      setForm(EMPTY_AGENT);
      setIsEditing(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(row: ShippingAgentRow) {
    setForm(row);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div dir={dir} className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Ribbon Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-indigo-500/30">
                  {tt("sae.shipping_line_module", "Shipping Line Module")}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/30">
                  {tt("sae.lang_sync", "5-Language Translation Sync")}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{tt("sag.title", "Shipping Agent Master Entry")}</h1>
              <p className="text-slate-400 text-sm">
                {tt("sag.subtitle", "Register authorized shipping line agents, port representatives, and booking partners.")}
              </p>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {tt("common.refresh", "Refresh")}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Shipping Agent Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-6 text-card-foreground">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Ship className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {isEditing ? tt("sag.edit_title", "Edit Shipping Agent Registration") : tt("sag.new_title", "New Shipping Agent Registration")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.agent_code", "Agent Code")}</label>
              <input
                type="text"
                placeholder={tt("sae.ph_agent_code", "Auto-generated (e.g. SHIP-AGT-001)")}
                value={form.agent_code}
                onChange={(e) => setForm({ ...form, agent_code: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.agent_name", "Agent / Agency Name")} *</label>
              <ClearingAgentPicker
                value={form.clearing_agent_id || ""}
                onValueChange={async (clearingAgentId) => {
                  setForm((prev: any) => ({ ...prev, clearing_agent_id: clearingAgentId }));
                  if (!clearingAgentId) return;
                  try {
                    const res = await apiGet<{ clearingAgent: ClearingAgentPickerRow }>(`/api/erp/clearing-agents/${encodeURIComponent(clearingAgentId)}`);
                    const agent = res.clearingAgent;
                    setForm((prev: any) => ({
                      ...prev,
                      agent_name: agent?.name || prev.agent_name,
                      contact_person: agent?.contact_person || prev.contact_person,
                      phone: agent?.phone || prev.phone,
                      email: agent?.email || prev.email
                    }));
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.shipping_line", "Associated Shipping Line")}</label>
              <ShippingLinePicker
                value={form.shipping_line_id || ""}
                onValueChange={async (shippingLineId) => {
                  setForm((prev: any) => ({ ...prev, shipping_line_id: shippingLineId }));
                  if (!shippingLineId) return;
                  try {
                    const res = await apiGet<{ shippingLine: ShippingLinePickerRow }>(`/api/erp/shipping-lines/${encodeURIComponent(shippingLineId)}`);
                    const line = res.shippingLine;
                    setForm((prev: any) => ({ ...prev, shipping_line_name: line?.name || prev.shipping_line_name }));
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.contact_person", "Contact Person")}</label>
              <input
                type="text"
                placeholder={tt("sag.contact_person_ph", "e.g. Tariq Khan")}
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.email", "Email Address")}</label>
              <input
                type="email"
                placeholder="agent@shipping.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("sag.phone", "Phone Number")}</label>
              <input
                type="text"
                placeholder="+92 300 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("common.status", "Status")}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="active font-semibold">{tt("common.active", "Active")}</option>
                <option value="inactive font-semibold">{tt("common.inactive", "Inactive")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("common.city", "City")}</label>
              <input
                type="text"
                placeholder={tt("sag.city_ph", "e.g. Karachi / Dubai")}
                value={form.city_name}
                onChange={(e) => setForm({ ...form, city_name: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("common.country", "Country")}</label>
              <input
                type="text"
                placeholder={tt("sag.country_ph", "e.g. Pakistan / United Arab Emirates")}
                value={form.country_name}
                onChange={(e) => setForm({ ...form, country_name: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">{tt("common.remarks", "Remarks")}</label>
            <textarea
              rows={2}
              placeholder={tt("sae.ph_remarks", "Additional contact details, agency terms...")}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {tt("sag.save", "Save Shipping Agent")}
            </button>
          </div>
        </form>

        {/* Shipping Agents Table */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-4 text-card-foreground">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <h2 className="text-lg font-bold text-foreground">{tt("sag.registered", "Registered Shipping Agents")} ({filteredRows.length})</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={tt("sae.ph_search", "Search agent code, name, city...")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-background border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {tt("common.loading", "Loading...")}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">{tt("sag.empty", "No shipping agents registered yet.")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-bold border-b border-border/60">
                  <tr>
                    <Th className="px-4 py-3">{tt("sag.agent_code", "Agent Code")}</Th>
                    <Th className="px-4 py-3">{tt("sag.agent_name", "Agent Name")}</Th>
                    <Th className="px-4 py-3">{tt("sag.shipping_line", "Shipping Line")}</Th>
                    <Th className="px-4 py-3">{tt("sag.contact_person", "Contact Person")}</Th>
                    <Th className="px-4 py-3">{tt("sag.location", "Location")}</Th>
                    <Th className="px-4 py-3">{tt("common.status", "Status")}</Th>
                    <Th className="px-4 py-3 text-right">{tt("common.actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">{r.agent_code}</td>
                      <td className="px-4 py-3 font-bold text-foreground">{r.agent_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.shipping_line_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.contact_person || "-"}
                        {r.phone && <span className="block font-mono text-muted-foreground/80">{r.phone}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.city_name ? `${r.city_name}, ${r.country_name || ""}` : r.country_name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase border ${
                            r.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-muted text-muted-foreground border-border/60"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-card hover:bg-muted text-foreground rounded-lg text-xs font-medium border border-border/80 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {tt("common.edit", "Edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}
