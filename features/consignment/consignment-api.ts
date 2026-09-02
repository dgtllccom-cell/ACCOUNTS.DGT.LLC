"use client";

import type { ConsignmentReport, ConsignmentRow } from "@/lib/consignment/types";

function activeLang(): string {
  if (typeof document === "undefined") return "en";
  const raw = (localStorage.getItem("erp_lang") || document.documentElement.lang || "en").trim();
  const base = raw.split("-")[0].toLowerCase();
  return ["en", "ur", "ar", "fa", "ps"].includes(base) ? base : "en";
}

async function j<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error?.message || body?.error || `Request failed (${res.status})`);
  }
  return (body.data ?? body) as T;
}

export type ConsignmentListRow = ConsignmentRow & {
  container_count: number;
  total_sales: number;
  total_receipts: number;
};

export async function fetchConsignments(opts: { q?: string; status?: string } = {}) {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.status) p.set("status", opts.status);
  p.set("lang", activeLang());
  return j<{ rows: ConsignmentListRow[]; summary: Record<string, number>; setupPending?: boolean }>(
    await fetch(`/api/erp/consignment?${p.toString()}`, { credentials: "same-origin" }),
  );
}

export async function createConsignmentReq(input: Record<string, unknown>) {
  return j<{ id: string; consignmentNo: string }>(
    await fetch(`/api/erp/consignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ...input, originalLanguage: activeLang() }),
    }),
  );
}

export async function updateConsignmentReq(id: string, patch: Record<string, unknown>) {
  return j<{ id: string }>(
    await fetch(`/api/erp/consignment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteConsignmentReq(id: string) {
  return j<{ id: string }>(await fetch(`/api/erp/consignment/${id}`, { method: "DELETE", credentials: "same-origin" }));
}

export async function fetchConsignmentReport(id: string) {
  const p = new URLSearchParams({ lang: activeLang() });
  return j<{ report: ConsignmentReport; setupPending?: boolean }>(
    await fetch(`/api/erp/consignment/${id}?${p.toString()}`, { credentials: "same-origin" }),
  );
}

export async function addEntryReq(id: string, payload: Record<string, unknown>) {
  return j<{ id: string }>(
    await fetch(`/api/erp/consignment/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteEntryReq(id: string, kind: string, childId: string) {
  const p = new URLSearchParams({ kind, childId });
  return j<{ id: string }>(
    await fetch(`/api/erp/consignment/${id}/entries?${p.toString()}`, { method: "DELETE", credentials: "same-origin" }),
  );
}
