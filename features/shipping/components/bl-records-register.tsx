"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Search, ScanLine, Ship, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { BlEntryView } from "./bl-entry-view";

type BlRecordRow = {
  id: string;
  bl_number: string | null;
  shipping_line_name: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  container_number: string | null;
  loading_port: string | null;
  discharge_port: string | null;
  eta: string | null;
  etd: string | null;
  shipment_status: string | null;
  currency_code: string | null;
  created_at: string;
  countries?: { name?: string } | null;
  city_branches?: { name?: string; code?: string } | null;
};

/**
 * Table-first wrapper for BL Entry: shows the real B/L register on load
 * (matching the sidebar menu expectation), and only reveals the existing
 * BlEntryView creation wizard after "+ New BL Entry" is clicked. BlEntryView
 * itself has no load-existing-record capability yet, so this register is
 * browse/search-only for now — editing a past BL remains a future addition.
 */
export function BlRecordsRegister({ context = "shipping", lang: langProp }: { context?: "shipping" | "purchase"; lang?: SupportedLanguage }) {
  const router = useRouter();
  const lang = langProp ?? "en";
  const isRtl = getLanguageDirection(lang) === "rtl";
  const _ = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const [rows, setRows] = useState<BlRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");

  const loadRows = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "200");
      const res = await fetch(`/api/erp/shipping/bl-records?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      const records = json?.data?.records ?? [];
      setRows(Array.isArray(records) ? records : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (viewMode === "form") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            setViewMode("list");
            void loadRows(query);
          }}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {_("bler.back_to_register", "Back to B/L Register")}
        </Button>
        <BlEntryView context={context} />
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-[1680px] space-y-3 p-3">
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b py-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            <Ship className="h-4 w-4" />
            {_("bler.title", "Bill of Lading Register")} ({rows.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadRows(query);
                }}
                placeholder={_("bler.search_ph", "Search B/L, container, vessel...")}
                className="h-9 pl-9 text-xs"
              />
            </div>
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void loadRows(query)} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <JournalPrintButton
              title={_("bler.title", "Bill of Lading Register")}
              columns={[
                { key: "bl_number", label: _("bler.col_bl_no", "BL No"), align: "center" },
                { key: "shipping_line_name", label: _("bler.col_shipping_line", "Shipping Line") },
                { key: (r) => `${(r as any).vessel_name ?? ""} / ${(r as any).voyage_number ?? ""}`, label: _("bler.col_vessel_voyage", "Vessel / Voyage") },
                { key: (r) => `${(r as any).loading_port ?? ""} -> ${(r as any).discharge_port ?? ""}`, label: _("bler.col_route", "Route") },
                { key: "eta", label: "ETA", align: "center", format: "date" },
                { key: "etd", label: "ETD", align: "center", format: "date" },
                { key: "shipment_status", label: _("bler.col_status", "Status"), align: "center", format: "status" },
                { key: (r) => String((r as any).city_branches?.name || (r as any).city_branches?.code || ""), label: _("bler.col_branch", "Branch") },
              ]}
              rows={rows as unknown as Record<string, unknown>[]}
              fetchFullData={async () => {
                const params = new URLSearchParams();
                if (query.trim()) params.set("q", query.trim());
                params.set("limit", "300");
                const res = await fetch(`/api/erp/shipping/bl-records?${params.toString()}`, { cache: "no-store" });
                const json = await res.json();
                const records = json?.data?.records ?? [];
                return (Array.isArray(records) ? records : []) as Record<string, unknown>[];
              }}
              filters={query.trim() ? [{ label: _("common.search", "Search"), value: query.trim() }] : []}
              orientation="landscape"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => router.push(`/dashboard/document-intelligence?domain=${context}&module=shipping_bl_records`)}
            >
              <ScanLine className="mr-1.5 h-3.5 w-3.5" />
              {_("bler.scan_upload", "Scan / Upload")}
            </Button>
            <Button type="button" size="sm" className="h-9 bg-cyan-600 text-white hover:bg-cyan-500" onClick={() => setViewMode("form")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {_("bler.new_entry", "New B/L Entry")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b bg-muted/50">
                <tr>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_bl_no", "BL No")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_shipping_line", "Shipping Line")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_vessel_voyage", "Vessel / Voyage")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_route", "Route")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_eta_etd", "ETA / ETD")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_status", "Status")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_branch", "Branch")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      {_("common.loading", "Loading...")}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      {_("bler.empty", "No B/L records found. Click \"New B/L Entry\" to create one.")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-semibold text-cyan-700 dark:text-cyan-300">{r.bl_number || "-"}</td>
                      <td className="px-3 py-2">{r.shipping_line_name || "-"}</td>
                      <td className="px-3 py-2">{r.vessel_name || "-"} / {r.voyage_number || "-"}</td>
                      <td className="px-3 py-2">{r.loading_port || "-"} &rarr; {r.discharge_port || "-"}</td>
                      <td className="px-3 py-2 tabular-nums">{r.eta || "-"} / {r.etd || "-"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {r.shipment_status || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.city_branches?.name || r.city_branches?.code || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
