"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ArrowRight, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { CUSTOMS_STATUSES } from "@/lib/services/clearing-country-customs-config";

type WorkspaceLeg = {
  id: string;
  order_id: string;
  order_no: string;
  customer_name: string;
  leg_no: number;
  from_country_name: string | null;
  to_country_name: string | null;
  customs_country_name: string | null;
  clearance_type: string | null;
  duty_treatment: string | null;
  customs_status: string;
  bill_of_entry_no: string | null;
  pgm_number: string | null;
  declaration_reference: string | null;
  customs_receipt_ref: string | null;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cleared") return "default";
  if (status === "held" || status === "rejected") return "destructive";
  if (status === "submitted") return "outline";
  return "secondary";
}

export function ClearingWorkspaceView({ lang }: { lang?: string | null }) {
  const s = useErpScreen("cwk", lang);
  const [countries, setCountries] = useState<any[]>([]);
  const [countryId, setCountryId] = useState("");
  const [status, setStatus] = useState("");
  const [legs, setLegs] = useState<WorkspaceLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ countries: any[] }>("/api/erp/locations/countries").then((c) => setCountries(c.countries || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (countryId) params.set("countryId", countryId);
      if (status) params.set("status", status);
      const data = await apiGet<{ legs: WorkspaceLeg[] }>(`/api/erp/clearing-agent/clearing-workspace?${params.toString()}`);
      setLegs(data.legs || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load the clearing workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, status]);

  return (
    <div dir={s.dir} className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{s.t("title", "Clearing & Customs Workspace")}</h2>
            <p className="text-sm text-slate-500">{s.t("subtitle", "Legs across every Customer Order currently needing clearing attention, by country.")}</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin text-slate-400" : "h-4 w-4 text-slate-500"} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("all_countries", "All Customs Countries")}</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("all_statuses", "All Statuses")}</option>
            {CUSTOMS_STATUSES.filter((st) => st !== "not_applicable").map((st) => <option key={st} value={st}>{s.t(`status_${st}`, st)}</option>)}
          </select>
        </div>
      </Card>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_order", "Order")}</th>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_route", "Route")}</th>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_customs_country", "Customs Country")}</th>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_clearance_type", "Clearance Type")}</th>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_reference", "Reference")}</th>
              <th className="p-2 text-start text-xs font-bold text-slate-500">{s.t("col_status", "Status")}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
            ) : legs.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-400">{s.t("empty", "Nothing needs clearing attention right now.")}</td></tr>
            ) : (
              legs.map((leg) => (
                <tr key={leg.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2">
                    <div className="font-bold text-slate-800 dark:text-slate-100">{leg.order_no}</div>
                    <div className="text-xs text-slate-500">{leg.customer_name}</div>
                  </td>
                  <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                    {leg.from_country_name || "—"} <ArrowRight className="inline h-3 w-3" /> {leg.to_country_name || "—"}
                  </td>
                  <td className="p-2 text-xs">{leg.customs_country_name || "—"}</td>
                  <td className="p-2 text-xs">{leg.clearance_type ? s.t(`clearance_${leg.clearance_type}`, leg.clearance_type) : "—"}</td>
                  <td className="p-2 text-xs">{leg.bill_of_entry_no || leg.pgm_number || leg.declaration_reference || leg.customs_receipt_ref || "—"}</td>
                  <td className="p-2"><Badge variant={statusVariant(leg.customs_status)} className="text-[10px]">{s.t(`status_${leg.customs_status}`, leg.customs_status)}</Badge></td>
                  <td className="p-2">
                    <a href={`/dashboard/clearing-agent/customer-order/${leg.order_id}/workflow`} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      {s.t("open", "Open")} <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
