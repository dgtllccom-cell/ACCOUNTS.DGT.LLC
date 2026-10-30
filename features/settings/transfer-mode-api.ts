import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api/client";

export type TransferMode = {
  id: string;
  code: string;
  name: string;
  reference_label: string;
  reference_placeholder: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export async function listTransferModes(params?: { search?: string; includeInactive?: boolean }): Promise<TransferMode[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.includeInactive) query.set("includeInactive", "true");
  const qs = query.toString() ? `?${query.toString()}` : "";
  const res: any = await apiGet(`/api/erp/transfer-modes${qs}`);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.modes)) return res.modes;
  return [];
}

export async function createTransferMode(data: {
  name: string;
  code?: string;
  referenceLabel?: string;
  referencePlaceholder?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<TransferMode> {
  const res: any = await apiPost("/api/erp/transfer-modes", data);
  return res?.data ?? res?.mode ?? res;
}

export async function updateTransferMode(id: string, data: {
  name: string;
  code?: string;
  referenceLabel?: string;
  referencePlaceholder?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<TransferMode> {
  const res: any = await apiPut(`/api/erp/transfer-modes/${id}`, data);
  return res?.data ?? res?.mode ?? res;
}

export async function deleteTransferMode(id: string): Promise<boolean> {
  const res: any = await apiDelete(`/api/erp/transfer-modes/${id}`);
  return res?.ok ?? true;
}
