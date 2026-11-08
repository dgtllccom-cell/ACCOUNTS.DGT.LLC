"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { translateHeader } from "@/lib/i18n/table-headers";
import { parseJsonish } from "@/lib/stock-journal/model";

export type LoadingReceivingDetail = {
  loadingCountry: string;
  loadingPort: string;
  loadingDate: string;
  receivingCountry: string;
  receivingPort: string;
  receivingDate: string;
  loadingRef?: string;
};

const cleanText = (...values: any[]): string => {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "-" || s === "—" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined" || s.toLowerCase() === "n/a") continue;
    return s;
  }
  return "—";
};

const cleanDate = (...values: any[]): string => {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s === "-" || s === "—" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined" || s.toLowerCase() === "n/a") continue;
    const dateStr = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return s;
  }
  return "—";
};

/**
 * Extracts authentic Loading and Receiving details for both Purchase Booking and Local Purchase records.
 * Supports Sea, Road, Air, and Train transport.
 * If multiple loadings exist, returns an entry for each without duplicating parent bills.
 */
export function extractLoadingReceivingDetails(row: any, loadingRecords: any[] = []): LoadingReceivingDetail[] {
  if (!row) return [];

  const isLocal = Boolean(
    row.is_local_purchase ||
    row.order_type === "local_purchase" ||
    row.source_type === "local_purchase" ||
    row.local_purchase_id
  );

  const form = row.form_data?.form || {};
  const transport = row.form_data?.transportDetails || row.form_data?.transport || {};
  const workflow = row.form_data?.workflow || {};
  const payload = (typeof row.report_payload === "object" && row.report_payload !== null)
    ? row.report_payload
    : (parseJsonish(row.report_payload) || {});

  // ── 1. Local Purchase Extraction ──
  if (isLocal) {
    const lCountry = cleanText(
      row.origin_country_name,
      form.loadingCountry,
      form.originCountry,
      row.country_name,
      row.countries?.name
    );

    // Support Truck, Driver, Border, Port, or loading location
    let lPort = cleanText(
      row.truck_no ? `Truck ${row.truck_no}` : null,
      row.loading_location,
      row.loading_details?.loadingPort,
      row.loading_details?.loadingBorder,
      form.loadingPort,
      form.loadingBorder,
      row.driver_name ? `Driver: ${row.driver_name}` : null
    );

    const lDate = cleanDate(
      row.loading_date,
      row.transfer_date,
      form.loadingDate,
      row.created_at
    );

    const rCountry = cleanText(
      row.country_name,
      row.countries?.name,
      form.receivingCountry,
      form.destinationCountry,
      row.origin_country_name
    );

    // Support Warehouse name, plot number, entry border, or receiving port
    let rPort = cleanText(
      row.warehouse_name ? `${row.warehouse_name}${row.warehouse_plot_no ? ` (${row.warehouse_plot_no})` : ""}` : null,
      row.receiving_location,
      row.loading_details?.destinationPort,
      row.loading_details?.receivingBorder,
      form.receivingPort,
      form.destinationPort,
      form.warehouseName
    );

    const rDate = cleanDate(
      row.warehouse_transferred_at,
      row.transfer_date,
      row.loading_date,
      form.receivedDate,
      form.arrivalDate
    );

    return [{
      loadingCountry: lCountry,
      loadingPort: lPort,
      loadingDate: lDate,
      receivingCountry: rCountry,
      receivingPort: rPort,
      receivingDate: rDate,
    }];
  }

  // ── 2. Purchase Booking Extraction ──
  // Check for linked physical loading records
  const matches = (record: any) => record && (
    (record.purchase_order_id && String(record.purchase_order_id) === String(row.id)) ||
    (record.purchase_order_no && row.purchase_order_no && String(record.purchase_order_no) === String(row.purchase_order_no))
  ) && !record.deleted_at && !String(record.id || "").startsWith("synthetic-");

  const attached = Array.isArray(row.loading_records) ? row.loading_records : [];
  const fromProps = (loadingRecords || []).filter(matches);
  const single = row.__loadingRecord ? [row.__loadingRecord] : [];
  const linked = [...attached, ...fromProps, ...single].filter(matches);
  const uniqueLoadings = [...new Map(linked.map(rec => [String(rec.id), rec])).values()];

  if (uniqueLoadings.length > 0) {
    return uniqueLoadings.map((rec, index) => {
      const p = (typeof rec.report_payload === "object" && rec.report_payload !== null)
        ? rec.report_payload
        : (parseJsonish(rec.report_payload) || {});
      const pForm = p.form || {};

      const lCountry = cleanText(
        p.loadingCountry,
        pForm.loadingCountry,
        rec.loading_country,
        rec.countries?.name,
        form.loadingCountry,
        form.originCountry,
        transport.loadingCountry
      );

      // Support Sea (port), Road (border), Air (airport), Rail (station)
      const lPort = cleanText(
        p.loadingPort,
        p.loadingBorder,
        p.exitBorder,
        p.loadingStation,
        p.loadingAirport,
        p.airportName,
        pForm.loadingPort,
        rec.loading_location,
        form.loadingPort,
        form.loadingBorder,
        form.exitBorder,
        form.exitPort,
        form.airportName,
        transport.loadingPort,
        transport.loadingBorder,
        transport.exitBorder
      );

      const lDate = cleanDate(
        rec.loaded_at,
        p.loadingDate,
        pForm.loadingDate,
        p.loadedAt,
        form.loadingDate,
        form.shipmentDate,
        transport.loadingDate
      );

      const rCountry = cleanText(
        p.receivingCountry,
        p.receivedCountry,
        p.destinationCountry,
        pForm.receivingCountry,
        pForm.receivedCountry,
        rec.dest_countries?.name,
        form.receivedCountry,
        form.receivingCountry,
        form.destinationCountry,
        transport.receivingCountry
      );

      const rPort = cleanText(
        p.receivingPort,
        p.receivedPort,
        p.destinationPort,
        p.receivingBorder,
        p.receivedBorder,
        p.entryBorder,
        p.receivingStation,
        p.receivedStation,
        p.destinationAirport,
        p.receivedAirport,
        pForm.receivingPort,
        rec.receiving_location,
        form.receivedPort,
        form.receivingPort,
        form.destinationPort,
        form.receivedBorder,
        form.entryBorder,
        form.destinationAirport,
        transport.receivedPort,
        transport.destinationPort,
        transport.entryBorder
      );

      const rDate = cleanDate(
        rec.received_at,
        rec.actual_arrival_date,
        p.receivedDate,
        p.receivingDate,
        p.arrivalDate,
        pForm.receivedDate,
        form.receivedDate,
        form.receivingDate,
        form.arrivalDate,
        transport.receivedDate
      );

      const loadingRef = cleanText(
        rec.loading_record_no,
        rec.loadingNo,
        rec.container_number ? `Cont: ${rec.container_number}` : null,
        uniqueLoadings.length > 1 ? `#${index + 1}` : null
      );

      return {
        loadingCountry: lCountry,
        loadingPort: lPort,
        loadingDate: lDate,
        receivingCountry: rCountry,
        receivingPort: rPort,
        receivingDate: rDate,
        loadingRef: loadingRef !== "—" ? loadingRef : undefined
      };
    });
  }

  // Fallback: Read directly from original saved booking form / transport details
  const lCountry = cleanText(
    payload.loadingCountry,
    form.loadingCountry,
    form.originCountry,
    form.origin_country,
    transport.loadingCountry,
    transport.originCountry
  );

  const lPort = cleanText(
    payload.loadingPort,
    payload.loadingBorder,
    payload.exitBorder,
    form.loadingPort,
    form.loadingBorder,
    form.exitBorder,
    form.exitPort,
    form.airportName,
    form.loadingAirport,
    form.loadingStation,
    transport.loadingPort,
    transport.loadingBorder,
    transport.exitBorder
  );

  const lDate = cleanDate(
    form.loadingDate,
    form.shipmentDate,
    transport.loadingDate,
    payload.loadingDate
  );

  const rCountry = cleanText(
    payload.receivingCountry,
    payload.receivedCountry,
    form.receivedCountry,
    form.receivingCountry,
    form.destinationCountry,
    form.dest_country,
    transport.receivingCountry,
    transport.destinationCountry
  );

  const rPort = cleanText(
    payload.receivingPort,
    payload.receivedPort,
    payload.destinationPort,
    payload.receivingBorder,
    payload.entryBorder,
    form.receivedPort,
    form.receivingPort,
    form.destinationPort,
    form.receivedBorder,
    form.entryBorder,
    form.receivingBorder,
    form.destinationAirport,
    form.receivedAirport,
    form.receivedStation,
    transport.receivedPort,
    transport.destinationPort,
    transport.entryBorder
  );

  const rDate = cleanDate(
    form.receivedDate,
    form.receivingDate,
    form.arrivalDate,
    form.destinationDate,
    transport.receivedDate,
    transport.arrivalDate,
    payload.receivedDate
  );

  return [{
    loadingCountry: lCountry,
    loadingPort: lPort,
    loadingDate: lDate,
    receivingCountry: rCountry,
    receivingPort: rPort,
    receivingDate: rDate,
  }];
}

/**
 * Clean, compact Loading & Receiving display component.
 * Displays Loading Details and Receiving Details in a 2-column layout without colored quantity boxes.
 */
export function LoadingReceivingCell({
  row,
  loadingRecords = [],
  lang,
}: {
  row: any;
  loadingRecords?: any[];
  lang: string;
}) {
  const detailsList = extractLoadingReceivingDetails(row, loadingRecords);
  const label = (v: string) => translateHeader(lang, v);

  return (
    <div className="flex flex-col gap-1.5 min-w-[320px] max-w-[440px]" data-testid="loading-receiving-cell">
      {detailsList.map((details, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-lg border border-slate-200/90 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-950/70",
            detailsList.length > 1 && "relative"
          )}
        >
          {details.loadingRef && detailsList.length > 1 && (
            <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-850">
              <span className="font-mono text-blue-600 dark:text-blue-400">Loading {details.loadingRef}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5 text-[11px] leading-tight">
            {/* ── Left Column: Loading Details ── */}
            <div className="space-y-1 border-r border-slate-200/80 pr-2 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900/40 pb-0.5">
                {label("Loading Details")}
              </div>
              <div className="space-y-0.5 pt-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Loading Country")}:</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={details.loadingCountry}>
                  {details.loadingCountry}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Loading Port / Border")}:</div>
                <div className="text-slate-700 dark:text-slate-300 truncate" title={details.loadingPort}>
                  {details.loadingPort}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Loading Date")}:</div>
                <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {details.loadingDate}
                </div>
              </div>
            </div>

            {/* ── Right Column: Receiving Details ── */}
            <div className="space-y-1 pl-0.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-900/40 pb-0.5">
                {label("Receiving Details")}
              </div>
              <div className="space-y-0.5 pt-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Receiving Country")}:</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={details.receivingCountry}>
                  {details.receivingCountry}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Receiving Port / Border")}:</div>
                <div className="text-slate-700 dark:text-slate-300 truncate" title={details.receivingPort}>
                  {details.receivingPort}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">{label("Receiving Date")}:</div>
                <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {details.receivingDate}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

