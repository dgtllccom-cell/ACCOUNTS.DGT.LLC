"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2, Loader2, PackageSearch, RefreshCcw } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { WarehousePicker } from "@/features/warehouses/components/warehouse-picker";
import { GoodsPicker, type GoodsPickerValue } from "@/features/goods-master/components/goods-picker";

/**
 * Cross-Stuffing — records a physical transfer of goods from one or more
 * trucks into a container at a warehouse. Table-first: the events list is
 * the landing view; "New Cross-Stuffing Event" opens a compact entry form.
 * Reuses the Container Master (new/search), WarehousePicker, GoodsPicker,
 * and the real trucks master (via /api/erp/master-data/trucks) — no
 * duplicate pickers or masters.
 */

type ContainerOption = { id: string; container_number: string; container_type: string | null; status: string | null };
type TruckOption = { id: string; truck_number: string; driver_name: string | null };
type EventRow = {
  id: string;
  container_id: string;
  container_number: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  event_date: string;
  status: string;
  line_count: number;
  total_quantity: number;
};

type LineDraft = {
  key: string;
  source_truck_id: string;
  goods_id: string;
  goods_variation_id: string;
  goods_name: string;
  quantity: string;
  unit: string;
};

function emptyLine(): LineDraft {
  return { key: Math.random().toString(36).slice(2), source_truck_id: "", goods_id: "", goods_variation_id: "", goods_name: "", quantity: "", unit: "Bags" };
}

export function CrossStuffingManagement({ lang: langProp }: { lang?: string }) {
  const activeLang = useActiveLanguage();
  const lang = (activeLang && activeLang !== "en" ? activeLang : langProp || "en") as any;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const dir = getLanguageDirection(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [containerQuery, setContainerQuery] = useState("");
  const [containerId, setContainerId] = useState("");
  const [newContainerNumber, setNewContainerNumber] = useState("");
  const [newContainerType, setNewContainerType] = useState("Dry Container 20FT");

  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/cross-stuffing");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setEvents(json.events || []);
    } catch (e: any) {
      setError(e.message || tt("cs.err_load", "Unable to load cross-stuffing events"));
    } finally {
      setLoading(false);
    }
  }

  async function loadContainers(search: string) {
    try {
      const res = await fetch(`/api/erp/containers?search=${encodeURIComponent(search)}&limit=25`);
      const json = await res.json();
      setContainers(json.containers || []);
    } catch {
      setContainers([]);
    }
  }

  async function loadTrucks() {
    try {
      const res = await fetch("/api/erp/master-data/trucks?selectable=true&limit=200");
      const json = await res.json();
      setTrucks((json.trucks || []).map((r: any) => ({ id: r.id, truck_number: r.truck_number, driver_name: r.driver_name })));
    } catch {
      setTrucks([]);
    }
  }

  useEffect(() => {
    void loadEvents();
    void loadContainers("");
    void loadTrucks();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadContainers(containerQuery), 300);
    return () => window.clearTimeout(timeout);
  }, [containerQuery]);

  function openNew() {
    setContainerId("");
    setNewContainerNumber("");
    setNewContainerType("Dry Container 20FT");
    setWarehouseId("");
    setEventDate(new Date().toISOString().slice(0, 10));
    setRemarks("");
    setLines([emptyLine()]);
    setError(null);
    setEditing(true);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSave() {
    setError(null);
    let resolvedContainerId = containerId;
    setSaving(true);
    try {
      if (!resolvedContainerId) {
        if (!newContainerNumber.trim()) {
          setError(tt("cs.err_container_required", "Select an existing container or enter a new container number."));
          setSaving(false);
          return;
        }
        const res = await fetch("/api/erp/containers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ container_number: newContainerNumber.trim(), container_type: newContainerType, warehouse_id: warehouseId || null }),
        });
        const json = await res.json();
        if (res.status === 409 && json.container?.id) {
          resolvedContainerId = json.container.id;
        } else if (!res.ok) {
          throw new Error(json?.error || "Failed to create container");
        } else {
          resolvedContainerId = json.container.id;
        }
      }

      const validLines = lines.filter((l) => l.source_truck_id && l.goods_id && Number(l.quantity) > 0);
      if (validLines.length === 0) {
        setError(tt("cs.err_line_required", "Add at least one line with a truck, goods, and quantity."));
        setSaving(false);
        return;
      }

      const res = await fetch("/api/erp/cross-stuffing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_id: resolvedContainerId,
          warehouse_id: warehouseId || null,
          event_date: eventDate,
          remarks: remarks.trim() || null,
          lines: validLines.map((l) => ({
            source_truck_id: l.source_truck_id,
            goods_id: l.goods_id,
            goods_variation_id: l.goods_variation_id || null,
            quantity: Number(l.quantity),
            unit: l.unit || null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");

      setEditing(false);
      await loadEvents();
    } catch (e: any) {
      setError(e.message || tt("cs.err_save", "Unable to save cross-stuffing event"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(tt("cs.confirm_delete", "Delete this cross-stuffing event?"))) return;
    try {
      const res = await fetch(`/api/erp/cross-stuffing/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await loadEvents();
    } catch {
      setError(tt("cs.err_delete", "Unable to delete cross-stuffing event"));
    }
  }

  return (
    <div dir={dir} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-sm font-black uppercase text-slate-900 dark:text-slate-100">
            <PackageSearch className="h-4 w-4 text-cyan-600" /> {tt("cs.title", "Cross-Stuffing")}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{tt("cs.subtitle", "Record goods transferred from trucks into a container at a warehouse")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadEvents()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <RefreshCcw className="h-3.5 w-3.5" /> {tt("common.refresh", "Refresh")}
          </button>
          <JournalPrintButton
            title={tt("cs.title", "Cross-Stuffing")}
            columns={[
              { key: "container_number", label: tt("cs.col_container", "Container"), align: "center" },
              { key: "warehouse_name", label: tt("cs.col_warehouse", "Warehouse") },
              { key: "event_date", label: tt("cs.col_date", "Date"), align: "center", format: "date" },
              { key: "status", label: tt("cs.col_status", "Status"), align: "center", format: "status" },
              { key: "line_count", label: tt("cs.col_lines", "Lines"), align: "right", format: "number" },
              { key: "total_quantity", label: tt("cs.col_total_qty", "Total Qty"), align: "right", format: "number" },
            ]}
            rows={events as unknown as Record<string, unknown>[]}
            fetchFullData={async () => {
              const res = await fetch("/api/erp/cross-stuffing?limit=500");
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error || "Failed to load");
              return (json.events || []) as Record<string, unknown>[];
            }}
            orientation="landscape"
          />
          <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500">
            <Plus className="h-3.5 w-3.5" /> {tt("cs.new_event", "New Cross-Stuffing Event")}
          </button>
        </div>
      </div>

      {error && !editing ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <Th className="px-3 py-2 text-start">{tt("cs.col_container", "Container")}</Th>
              <Th className="px-3 py-2 text-start">{tt("cs.col_warehouse", "Warehouse")}</Th>
              <Th className="px-3 py-2 text-start">{tt("cs.col_date", "Date")}</Th>
              <Th className="px-3 py-2 text-start">{tt("cs.col_status", "Status")}</Th>
              <Th className="px-3 py-2 text-end">{tt("cs.col_lines", "Lines")}</Th>
              <Th className="px-3 py-2 text-end">{tt("cs.col_total_qty", "Total Qty")}</Th>
              <Th className="px-3 py-2 text-end">{tt("common.actions", "Actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{tt("cs.empty", "No cross-stuffing events recorded yet.")}</td></tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{ev.container_number || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{ev.warehouse_name || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{ev.event_date}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300">{ev.status}</span>
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{ev.line_count}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(ev.total_quantity || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-end">
                    <button type="button" onClick={() => handleDelete(ev.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <h2 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">{tt("cs.new_event", "New Cross-Stuffing Event")}</h2>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>

            {error ? <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : null}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500">{tt("cs.container", "Container")}</label>
              <select
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="">{tt("cs.container_new", "-- Create a new container below --")}</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>{c.container_number} {c.container_type ? `(${c.container_type})` : ""}</option>
                ))}
              </select>
              {!containerId ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    value={newContainerNumber}
                    onChange={(e) => setNewContainerNumber(e.target.value)}
                    placeholder={tt("cs.new_container_number_ph", "New container number")}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                  />
                  <select
                    value={newContainerType}
                    onChange={(e) => setNewContainerType(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="Dry Container 20FT">Dry Container 20FT</option>
                    <option value="Dry Container 40FT">Dry Container 40FT</option>
                    <option value="Reefer Container 40FT">Reefer Container 40FT</option>
                  </select>
                </div>
              ) : null}
            </div>

            <WarehousePicker value={warehouseId} onValueChange={setWarehouseId} label={tt("cs.warehouse", "Warehouse")} />

            <label className="block space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">{tt("cs.event_date", "Event Date")}</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-950" />
            </label>

            <div className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">{tt("cs.lines", "Goods Lines (from truck)")}</span>
                <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300">
                  <Plus className="h-3 w-3" /> {tt("cs.add_line", "Add Line")}
                </button>
              </div>
              {lines.map((line) => (
                <div key={line.key} className="space-y-1.5 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={line.source_truck_id}
                      onChange={(e) => updateLine(line.key, { source_truck_id: e.target.value })}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">{tt("cs.select_truck", "Select truck")}</option>
                      {trucks.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.truck_number}{tr.driver_name ? ` (${tr.driver_name})` : ""}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        placeholder={tt("cs.quantity", "Quantity")}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950"
                      />
                      <button type="button" onClick={() => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== line.key) : p))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <GoodsPicker
                    value={line.goods_id}
                    variationValue={line.goods_variation_id}
                    label={tt("cs.goods", "Goods")}
                    onSelect={(v: GoodsPickerValue) => updateLine(line.key, { goods_id: v.goodsId, goods_variation_id: v.goodsVariationId || "", goods_name: v.goodsName })}
                  />
                </div>
              ))}
            </div>

            <label className="block space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">{tt("common.remarks", "Remarks")}</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950" />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                {tt("common.cancel", "Cancel")}
              </button>
              <button type="button" disabled={saving} onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {tt("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
