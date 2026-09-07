"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/ui";
import { CONTAINER_STATUSES, EXPENSE_TYPES, RECEIPT_METHODS } from "@/lib/consignment/types";
import { MasterCombo } from "@/features/consignment/components/master-combo";

const mInput = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none";

function ModalShell({
  title,
  isRtl,
  onClose,
  children,
  onSave,
  saveLabel,
  lang,
}: {
  title: string;
  isRtl: boolean;
  onClose: () => void;
  children: React.ReactNode;
  onSave: () => void;
  saveLabel: string;
  lang: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-black text-foreground">{title}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            {t(lang, "cns.cancel", "Cancel")}
          </button>
          <button type="button" onClick={onSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children, full }: { children: React.ReactNode; full?: boolean }) {
  return <label className={`block text-xs font-semibold text-muted-foreground ${full ? "sm:col-span-2" : ""}`}>{children}</label>;
}

export function HeadEditModal({
  lang,
  isRtl,
  row,
  onClose,
  onSaved,
}: {
  lang: string;
  isRtl: boolean;
  row: any;
  onClose: () => void;
  onSaved: (patch: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    partyName: row.party_name || "",
    partyCustomerId: (row.party_customer_id as string | null) || null,
    referenceNo: row.reference_no || "",
    tenderNo: row.tender_no || "",
    title: row.title || "",
    consignmentDate: String(row.consignment_date || "").slice(0, 10),
    loadingFromDate: String(row.loading_from_date || "").slice(0, 10),
    loadingToDate: String(row.loading_to_date || "").slice(0, 10),
    referenceValue: row.reference_value ?? "",
    baseCurrency: row.base_currency || "USD",
    partyContact: row.party_contact || "",
    partyPhone: row.party_phone || "",
    notes: row.notes || "",
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <ModalShell
      title={t(lang, "cns.edit_details", "Edit Details")}
      isRtl={isRtl}
      lang={lang}
      onClose={onClose}
      saveLabel={t(lang, "cns.save", "Save")}
      onSave={() => {
        if (!f.partyName.trim()) return;
        onSaved({
          partyName: f.partyName,
          partyCustomerId: f.partyCustomerId,
          referenceNo: f.referenceNo || null,
          tenderNo: f.tenderNo || null,
          title: f.title || null,
          consignmentDate: f.consignmentDate || null,
          loadingFromDate: f.loadingFromDate || null,
          loadingToDate: f.loadingToDate || null,
          referenceValue: f.referenceValue === "" ? null : Number(f.referenceValue),
          baseCurrency: f.baseCurrency,
          partyContact: f.partyContact || null,
          partyPhone: f.partyPhone || null,
          notes: f.notes || null,
        });
      }}
    >
      <Lbl full>
        {t(lang, "cns.party_name", "Party / Account")} *
        <MasterCombo
          source="customer"
          lang={lang}
          value={f.partyName}
          linkedId={f.partyCustomerId}
          onChange={(name, linkedId) => setF((p) => ({ ...p, partyName: name, partyCustomerId: linkedId }))}
        />
      </Lbl>
      <Lbl>{t(lang, "cns.reference_no", "Reference No")}<input className={mInput} value={f.referenceNo} onChange={(e) => set("referenceNo", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.tender_no", "Tender / Contract No")}<input className={mInput} value={f.tenderNo} onChange={(e) => set("tenderNo", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.f_title", "Title / Description")}<input className={mInput} value={f.title} onChange={(e) => set("title", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.consignment_date", "Consignment Date")}<input type="date" className={mInput} value={f.consignmentDate} onChange={(e) => set("consignmentDate", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.loading_from", "Loading Date From")}<input type="date" className={mInput} value={f.loadingFromDate} onChange={(e) => set("loadingFromDate", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.loading_to", "Loading Date To")}<input type="date" className={mInput} value={f.loadingToDate} onChange={(e) => set("loadingToDate", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.reference_value", "Reference Value")}<input type="number" className={mInput} value={f.referenceValue} onChange={(e) => set("referenceValue", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.base_currency", "Base Currency")}<input className={mInput} value={f.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value.toUpperCase())} /></Lbl>
      <Lbl>{t(lang, "cns.party_contact", "Contact Person")}<input className={mInput} value={f.partyContact} onChange={(e) => set("partyContact", e.target.value)} /></Lbl>
      <Lbl>{t(lang, "cns.party_phone", "Phone")}<input className={mInput} value={f.partyPhone} onChange={(e) => set("partyPhone", e.target.value)} /></Lbl>
      <Lbl full>{t(lang, "cns.notes", "Notes / Remarks")}<textarea rows={2} className={mInput} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Lbl>
    </ModalShell>
  );
}

type FieldSpec = { key: string; label: string; type?: "text" | "number" | "date" | "select"; opts?: readonly string[]; optKeyPrefix?: string; full?: boolean };

const EDIT_SPECS: Record<string, FieldSpec[]> = {
  container: [
    { key: "container_no", label: "container_no" },
    { key: "bl_no", label: "bl_no" },
    { key: "loading_date", label: "loading_date", type: "date" },
    { key: "arrival_date", label: "arrival_date", type: "date" },
    { key: "vessel_name", label: "vessel_name" },
    { key: "shipping_line", label: "shipping_line" },
    { key: "seal_no", label: "seal_no" },
    { key: "total_cartons", label: "total_cartons", type: "number" },
    { key: "total_gross_weight", label: "gross_weight", type: "number" },
    { key: "total_net_weight", label: "net_weight", type: "number" },
    { key: "reference_rate", label: "reference_rate", type: "number" },
    { key: "reference_value", label: "reference_value", type: "number" },
    { key: "status", label: "container_status", type: "select", opts: CONTAINER_STATUSES, optKeyPrefix: "cs_" },
    { key: "notes", label: "notes", full: true },
  ],
  good: [
    { key: "cartons", label: "cartons", type: "number" },
    { key: "quantity", label: "quantity", type: "number" },
    { key: "unit_label", label: "unit" },
    { key: "net_weight", label: "net_weight", type: "number" },
    { key: "rate", label: "rate", type: "number" },
    { key: "amount", label: "amount", type: "number" },
    { key: "currency", label: "currency" },
    { key: "notes", label: "notes", full: true },
  ],
  expense: [
    { key: "expense_type", label: "expense_type", type: "select", opts: EXPENSE_TYPES, optKeyPrefix: "et_" },
    { key: "expense_date", label: "expense_date", type: "date" },
    { key: "description", label: "description", full: true },
    { key: "currency", label: "currency" },
    { key: "amount", label: "amount", type: "number" },
    { key: "paid_by", label: "paid_by" },
    { key: "reference_no", label: "reference_no" },
    { key: "notes", label: "notes", full: true },
  ],
  sale: [
    { key: "sale_date", label: "sale_date", type: "date" },
    { key: "cartons", label: "cartons", type: "number" },
    { key: "quantity", label: "quantity", type: "number" },
    { key: "net_weight", label: "net_weight", type: "number" },
    { key: "rate", label: "rate", type: "number" },
    { key: "amount", label: "amount", type: "number" },
    { key: "currency", label: "currency" },
    { key: "reference_no", label: "reference_no" },
    { key: "notes", label: "notes", full: true },
  ],
  receipt: [
    { key: "receipt_date", label: "receipt_date", type: "date" },
    { key: "method", label: "method", type: "select", opts: RECEIPT_METHODS, optKeyPrefix: "m_" },
    { key: "currency", label: "currency" },
    { key: "amount", label: "amount", type: "number" },
    { key: "reference_no", label: "reference_no" },
    { key: "notes", label: "notes", full: true },
  ],
};

export function EditRowModal({
  lang,
  isRtl,
  kind,
  row,
  containers,
  onClose,
  onSave,
}: {
  lang: string;
  isRtl: boolean;
  kind: string;
  row: any;
  containers: { id: string; label: string }[];
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const specs = EDIT_SPECS[kind] || [];
  const [f, setF] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const sp of specs) init[sp.key] = sp.type === "date" ? String(row[sp.key] || "").slice(0, 10) : (row[sp.key] ?? "");
    if (kind === "good" || kind === "sale") {
      init.goods_name = row.goods_name ?? "";
      init.goods_id = row.goods_id ?? null;
    }
    if (kind === "sale") {
      init.buyer_name = row.buyer_name ?? "";
      init.buyer_customer_id = row.buyer_customer_id ?? null;
    }
    if (kind === "expense" || kind === "sale") init.container_id = row.container_id ?? "";
    return init;
  });
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  return (
    <ModalShell
      title={t(lang, "cns.edit", "Edit")}
      isRtl={isRtl}
      lang={lang}
      onClose={onClose}
      saveLabel={t(lang, "cns.save", "Save")}
      onSave={() => {
        const patch: Record<string, unknown> = {};
        for (const sp of specs) patch[sp.key] = f[sp.key] === "" ? null : f[sp.key];
        if (kind === "good") {
          patch.goods_id = f.goods_id ?? null;
          patch.goods_name = f.goods_name;
        }
        if (kind === "sale") {
          patch.goods_id = f.goods_id ?? null;
          patch.goods_name = f.goods_name;
          patch.buyer_name = f.buyer_name || null;
          patch.buyer_customer_id = f.buyer_customer_id || null;
          patch.container_id = f.container_id || null;
        }
        if (kind === "expense") patch.container_id = f.container_id || null;
        onSave(patch);
      }}
    >
      {(kind === "good" || kind === "sale") && (
        <Lbl full>
          {t(lang, "cns.goods_name", "Goods Name")}
          <MasterCombo
            source="goods"
            lang={lang}
            value={f.goods_name || ""}
            linkedId={f.goods_id}
            onChange={(name, linkedId) => setF((p) => ({ ...p, goods_name: name, goods_id: linkedId }))}
          />
        </Lbl>
      )}
      {kind === "sale" && (
        <Lbl full>
          {t(lang, "cns.buyer_name", "Buyer / Customer")}
          <MasterCombo
            source="customer"
            lang={lang}
            value={f.buyer_name || ""}
            linkedId={f.buyer_customer_id}
            onChange={(name, linkedId) => setF((p) => ({ ...p, buyer_name: name, buyer_customer_id: linkedId }))}
          />
        </Lbl>
      )}
      {(kind === "expense" || kind === "sale") && containers.length > 0 && (
        <Lbl>
          {t(lang, "cns.containers", "Container")}
          <select className={mInput} value={f.container_id || ""} onChange={(e) => set("container_id", e.target.value)}>
            <option value="">—</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Lbl>
      )}
      {specs.map((sp) => (
        <Lbl key={sp.key} full={sp.full}>
          {t(lang, `cns.${sp.label}`, sp.label)}
          {sp.type === "select" ? (
            <select className={mInput} value={f[sp.key] ?? ""} onChange={(e) => set(sp.key, e.target.value)}>
              {(sp.opts || []).map((o) => (
                <option key={o} value={o}>
                  {t(lang, `cns.${sp.optKeyPrefix || ""}${o}`, o)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={sp.type === "number" ? "number" : sp.type === "date" ? "date" : "text"}
              className={mInput}
              value={f[sp.key] ?? ""}
              onChange={(e) => set(sp.key, sp.key === "currency" ? e.target.value.toUpperCase() : e.target.value)}
            />
          )}
        </Lbl>
      ))}
    </ModalShell>
  );
}
