// features/whatsapp/api.ts
// Client-side fetch helpers for WhatsApp module API routes.

import type {
  WhatsAppAccount,
  WhatsAppConversation,
  WhatsAppMessage,
  ConversationDetail,
  ConversationFilters,
  SendMessagePayload
} from "./types";

const BASE = "/api/erp/whatsapp";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers }
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message ?? "API error");
  }
  return json.data as T;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function fetchWhatsAppAccounts(): Promise<WhatsAppAccount[]> {
  return apiFetch<WhatsAppAccount[]>(`${BASE}/accounts`);
}

export async function createWhatsAppAccount(data: {
  scope: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}): Promise<{ accountId: string }> {
  return apiFetch(`${BASE}/accounts`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateWhatsAppAccount(
  id: string,
  data: { displayName?: string; isActive?: boolean; accessToken?: string }
): Promise<{ accountId: string }> {
  return apiFetch(`${BASE}/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export async function deleteWhatsAppAccount(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`${BASE}/accounts/${id}`, { method: "DELETE" });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function fetchConversations(filters: ConversationFilters = {}): Promise<{
  conversations: WhatsAppConversation[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
  if (filters.countryId) params.set("countryId", filters.countryId);
  if (filters.cityBranchId) params.set("cityBranchId", filters.cityBranchId);
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return apiFetch(`${BASE}/conversations?${params.toString()}`);
}

export async function fetchConversationDetail(id: string): Promise<ConversationDetail> {
  return apiFetch(`${BASE}/conversations/${id}`);
}

export async function updateConversation(
  id: string,
  data: { status?: string; assignedUserId?: string | null; labels?: string[] }
): Promise<{ conversationId: string; updated: boolean }> {
  return apiFetch(`${BASE}/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  page = 1,
  limit = 50
): Promise<{ messages: WhatsAppMessage[]; pagination: { page: number; total: number; pages: number } }> {
  return apiFetch(`${BASE}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
}

export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload
): Promise<{ messageId: string; wamid?: string }> {
  return apiFetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function fetchContactByPhone(phone: string, countryId?: string) {
  const params = new URLSearchParams({ phone });
  if (countryId) params.set("countryId", countryId);
  return apiFetch(`${BASE}/contacts?${params.toString()}`);
}

export async function startNewConversation(phone: string): Promise<{ conversationId: string }> {
  return apiFetch(`${BASE}/conversations`, {
    method: "POST",
    body: JSON.stringify({ phone })
  });
}
