/**
 * Hostinger Mail API client — real mailbox provisioning on the existing
 * Titan/dgt.llc order, confirmed against Hostinger's own published OpenAPI
 * spec (https://developers.hostinger.com/openapi/openapi.json):
 *   POST   /api/mail/v1/orders/{orderId}/mailboxes         create
 *   GET    /api/mail/v1/orders/{orderId}/mailboxes         list
 *   PATCH  /api/mail/v1/orders/{orderId}/mailboxes/{id}    change password
 *   DELETE /api/mail/v1/orders/{orderId}/mailboxes/{id}    delete
 * Auth: `Authorization: Bearer <token>`, token created in hPanel's API area,
 * scoped to a single order (the dgt.llc Titan Email order).
 *
 * This is intentionally never called unless both HOSTINGER_MAIL_API_TOKEN
 * and HOSTINGER_MAIL_ORDER_ID are set — see isHostingerProvisioningEnabled().
 * Until the owner provides those, registration falls back to the mailbox
 * pool (see assign-pool-mailbox.ts). No credential is hardcoded here.
 */

const HOSTINGER_API_BASE = "https://developers.hostinger.com/api/mail/v1";

function getConfig() {
  const token = process.env.HOSTINGER_MAIL_API_TOKEN;
  const orderId = process.env.HOSTINGER_MAIL_ORDER_ID;
  return { token, orderId };
}

export function isHostingerProvisioningEnabled(): boolean {
  const { token, orderId } = getConfig();
  return Boolean(token && orderId);
}

async function hostingerRequest(path: string, init: RequestInit) {
  const { token, orderId } = getConfig();
  if (!token || !orderId) {
    throw new Error("Hostinger Mail API is not configured (HOSTINGER_MAIL_API_TOKEN / HOSTINGER_MAIL_ORDER_ID missing).");
  }
  const res = await fetch(`${HOSTINGER_API_BASE}/orders/${orderId}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`Hostinger Mail API ${init.method || "GET"} ${path} failed (${res.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Generates a random, strong password for a newly-provisioned real mailbox.
 * Encrypted and stored the same way as every other erp_email_accounts
 * password — never logged, never returned to the browser.
 */
export function generateMailboxPassword(): string {
  const crypto = require("crypto") as typeof import("crypto");
  const bytes = crypto.randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `${bytes.slice(0, 20)}!Aa1`;
}

/**
 * Creates a real mailbox on the existing Titan order for the given local
 * part (e.g. "jsmith" -> jsmith@dgt.llc). Returns the mailbox id Hostinger
 * assigns and the password that was set, or throws if provisioning failed
 * (e.g. seat limit reached on the order's plan).
 */
export async function createHostingerMailbox(localPart: string): Promise<{ hostingerMailboxId: string; password: string }> {
  const password = generateMailboxPassword();
  const data = await hostingerRequest("/mailboxes", {
    method: "POST",
    body: JSON.stringify({ mailbox: localPart, password }),
  });
  const hostingerMailboxId = data?.id || data?.mailbox_id || data?.data?.id;
  if (!hostingerMailboxId) {
    throw new Error("Hostinger Mail API did not return a mailbox id on creation.");
  }
  return { hostingerMailboxId: String(hostingerMailboxId), password };
}

export async function deleteHostingerMailbox(hostingerMailboxId: string): Promise<void> {
  await hostingerRequest(`/mailboxes/${hostingerMailboxId}`, { method: "DELETE" });
}

export async function changeHostingerMailboxPassword(hostingerMailboxId: string, newPassword: string): Promise<void> {
  await hostingerRequest(`/mailboxes/${hostingerMailboxId}`, {
    method: "PATCH",
    body: JSON.stringify({ password: newPassword }),
  });
}

export async function listHostingerMailboxes(): Promise<any[]> {
  const data = await hostingerRequest("/mailboxes", { method: "GET" });
  return Array.isArray(data) ? data : data?.data || [];
}
