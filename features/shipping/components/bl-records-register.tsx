"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Search, ScanLine, Ship, ArrowLeft, Edit2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
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
  report_payload?: any;
  created_at: string;
  countries?: { name?: string } | null;
  city_branches?: { name?: string; code?: string } | null;
};

export function BlRecordsRegister({
  context = "shipping",
  lang: langProp
}: {
  context?: "shipping" | "purchase";
  lang?: SupportedLanguage;
}) {
  const router = useRouter();
  const lang = langProp ?? "en";
  const isRtl = getLanguageDirection(lang) === "rtl";
  const _ = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const [rows, setRows] = useState<BlRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editingRecord, setEditingRecord] = useState<BlRecordRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDeleteRecord(id: string) {
    if (!confirm(_("ble.confirm_delete_record", "Are you sure you want to delete this Bill of Lading record? This will soft-delete the record."))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/erp/shipping/bl-records?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json?.error?.message || _("ble.err_load", "Failed to delete record"));
      } else {
        await loadRows(query);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : _("ble.err_load", "Failed to delete record"));
    } finally {
      setDeletingId(null);
    }
  }

  if (viewMode === "form") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          onClick={() => {
            setViewMode("list");
            setEditingRecord(null);
            void loadRows(query);
          }}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {_("bler.back_to_register", "Back to B/L Register")}
        </Button>
        <BlEntryView
          context={context}
          initialRecord={editingRecord}
          onBack={() => {
            setViewMode("list");
            setEditingRecord(null);
            void loadRows(query);
          }}
        />
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
            <Button
              type="button"
              size="sm"
              className="h-9 bg-cyan-600 text-white hover:bg-cyan-500 font-bold"
              onClick={() => {
                setEditingRecord(null);
                setViewMode("form");
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {_("bler.new_entry", "New B/L Entry")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b bg-muted/50">
                <tr>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_bl_no", "BL No")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_shipping_line", "Shipping Line")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_vessel_voyage", "Vessel / Voyage")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_route", "Route")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_eta_etd", "ETA / ETD")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_status", "Status")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("bler.col_branch", "Branch")}</Th>
                  <Th className="px-3 py-2 text-right font-black uppercase">{_("common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      {_("common.loading", "Loading...")}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      {_("bler.empty", "No B/L records found. Click \"New B/L Entry\" to create one.")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition">
                      <td className="px-3 py-2 font-mono font-semibold text-cyan-700 dark:text-cyan-300">
                        {r.bl_number || "-"}
                      </td>
                      <td className="px-3 py-2">{r.shipping_line_name || "-"}</td>
                      <td className="px-3 py-2">
                        {r.vessel_name || "-"} / {r.voyage_number || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {r.loading_port || "-"} &rarr; {r.discharge_port || "-"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.eta || "-"} / {r.etd || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {r.shipment_status || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.city_branches?.name || r.city_branches?.code || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs font-semibold text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40"
                            onClick={() => {
                              setEditingRecord(r);
                              setViewMode("form");
                            }}
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            {_("ble.act_edit", "Edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() => handleDeleteRecord(r.id)}
                            disabled={deletingId === r.id}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            {_("ble.act_delete", "Delete")}
                          </Button>
                        </div>
                      </td>
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
