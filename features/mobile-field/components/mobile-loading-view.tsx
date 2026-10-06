"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Truck, Check, X } from "lucide-react";
import { apiGet, apiFetch } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileFieldShell } from "./mobile-field-shell";

type TruckLoading = {
  id: string;
  loading_serial?: string;
  loading_date?: string;
  truck_number?: string;
  driver_name?: string;
  driver_mobile_1?: string;
  goods_name?: string;
  quantity?: number;
  unit?: string;
  gross_weight?: number;
  destination?: string;
  remarks?: string;
};

export function MobileLoadingView({ langProp }: { langProp?: SupportedLanguage }) {
  const s = useErpScreen("mfield", langProp);

  const [records, setRecords] = useState<TruckLoading[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [truckNumber, setTruckNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [goodsName, setGoodsName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Bags");
  const [grossWeight, setGrossWeight] = useState("");
  const [destination, setDestination] = useState("");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const url = search.trim()
        ? `/api/erp/clearing-agent/truck-loading?search=${encodeURIComponent(search.trim())}`
        : "/api/erp/clearing-agent/truck-loading";
      const res = await apiGet<{ records: TruckLoading[] }>(url);
      setRecords(res.records ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!truckNumber.trim() || !goodsName.trim()) return;

    setSaving(true);
    setMsg(null);
    try {
      await apiFetch("/api/erp/clearing-agent/truck-loading", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          truck_number: truckNumber.trim(),
          driver_name: driverName.trim() || undefined,
          driver_mobile_1: driverMobile.trim() || undefined,
          goods_name: goodsName.trim(),
          quantity: quantity ? Number(quantity) : undefined,
          unit: unit.trim() || undefined,
          gross_weight: grossWeight ? Number(grossWeight) : undefined,
          destination: destination.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      setMsg({ tone: "ok", text: s.t("saved_ok", "Saved successfully") });
      // Reset form
      setTruckNumber("");
      setDriverName("");
      setDriverMobile("");
      setGoodsName("");
      setQuantity("");
      setGrossWeight("");
      setDestination("");
      setRemarks("");
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setMsg({ tone: "err", text: err?.message || "Failed to save inspection" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileFieldShell title={s.t("menu_loading", "Loading & Vehicle Check")} langProp={langProp} showBack>
      {msg ? (
        <div
          className={`mb-3 flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
            msg.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!showForm ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={s.t("search", "Search inspections or trucks…")}
                className="w-full bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>{s.t("new_inspection", "New Inspection")}</span>
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-center text-sm text-slate-400">{s.t("loading", "Loading…")}</p>
          ) : records.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
              <Truck className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">{s.t("no_records", "No inspections recorded yet")}</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              >
                + {s.t("new_inspection", "New Loading Inspection")}
              </button>
            </div>
          ) : (
            <ul className="grid gap-2.5">
              {records.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.truck_number || "—"}
                    </span>
                    <span className="font-mono text-slate-400">
                      {r.loading_date ? String(r.loading_date).slice(0, 10) : ""}
                    </span>
                  </div>

                  <div className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                    {r.goods_name || "—"}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {r.driver_name ? (
                      <span>
                        👤 {r.driver_name} {r.driver_mobile_1 ? `(${r.driver_mobile_1})` : ""}
                      </span>
                    ) : null}
                    {r.quantity != null ? (
                      <span>
                        📦 {r.quantity} {r.unit || ""}
                      </span>
                    ) : null}
                    {r.gross_weight != null ? (
                      <span>⚖️ {r.gross_weight} kg</span>
                    ) : null}
                    {r.destination ? (
                      <span>📍 {r.destination}</span>
                    ) : null}
                  </div>

                  {r.remarks ? (
                    <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                      “{r.remarks}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">
              {s.t("new_inspection", "New Loading Inspection")}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-slate-500"
            >
              {s.t("back", "Back")}
            </button>
          </div>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {s.t("truck_number", "Truck / Vehicle No.")} *
            <input
              required
              value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}
              placeholder="e.g. TL-8842"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            />
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {s.t("goods_name", "Goods / Cargo Description")} *
            <input
              required
              value={goodsName}
              onChange={(e) => setGoodsName(e.target.value)}
              placeholder="e.g. Basmati Rice 50kg"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("driver_name", "Driver Name")}
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Driver full name"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("driver_mobile", "Driver Mobile")}
              <input
                value={driverMobile}
                onChange={(e) => setDriverMobile(e.target.value)}
                placeholder="Phone number"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("quantity", "Quantity")}
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("unit", "Unit")}
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Bags, Tons, Cartons"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("gross_weight", "Gross Weight (kg)")}
              <input
                type="number"
                min="0"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {s.t("destination", "Destination")}
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City or Warehouse"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </label>
          </div>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {s.t("remarks", "Inspection Remarks")}
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Seal intact, tarpaulin tied, cargo verified…"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
            />
          </label>

          <button
            type="submit"
            disabled={saving || !truckNumber.trim() || !goodsName.trim()}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <span>{s.t("saving", "Saving…")}</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{s.t("save", "Save Inspection")}</span>
              </>
            )}
          </button>
        </form>
      )}
    </MobileFieldShell>
  );
}
