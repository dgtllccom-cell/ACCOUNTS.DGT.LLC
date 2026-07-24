export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function messageFromBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const anyBody = body as any;
  // Standard format: { error: { message: "..." } }
  if (anyBody?.error?.message) return anyBody.error.message;
  // Legacy format: { error: "..." }
  if (typeof anyBody?.error === "string") return anyBody.error;
  // Fallback: top-level message
  if (anyBody?.message) return anyBody.message;
  return null;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  const body = (await parseJsonSafe(res)) as ApiOk<T> | ApiErr | unknown;

  if (!res.ok) {
    throw new Error(messageFromBody(body) || `Request failed: ${res.status}`);
  }

  if (body && typeof body === "object" && (body as any).ok === false) {
    throw new Error(messageFromBody(body) || "Request failed");
  }

  // Our ERP APIs usually wrap payload in { ok: true, data }, but some legacy routes return raw JSON.
  if (body && typeof body === "object" && (body as any).ok === true) {
    return (body as ApiOk<T>).data;
  }

  return body as T;
}

export async function apiGet<T>(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  const cacheBustUrl = `${url}${separator}_t=${Date.now()}`;
  return apiFetch<T>(cacheBustUrl, { cache: "no-store" });
}

export async function apiPost<T>(url: string, payload: unknown) {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function apiPatch<T>(url: string, payload: unknown) {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function apiPut<T>(url: string, payload: unknown) {
  return apiFetch<T>(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function apiDelete<T>(url: string) {
  return apiFetch<T>(url, {
    method: "DELETE"
  });
}

export function dispatchErpPostingSaved() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("erp:posting-saved"));
  }
}
