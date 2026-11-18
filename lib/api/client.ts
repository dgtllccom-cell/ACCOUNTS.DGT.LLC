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

/**
 * The live ERP UI language (localStorage `erp_lang` → <html lang> → "en"). Sent as the
 * `x-erp-lang` header on every API call so server routes localise master data / labels to
 * exactly what the user is looking at, even before the `erp_lang` cookie has round-tripped
 * (see lib/i18n/server.ts getRequestLanguage). Browser-only; no-ops on the server.
 */
function clientErpLang(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = (localStorage.getItem("erp_lang") || document.documentElement.lang || "").trim();
    const base = raw.split("-")[0].toLowerCase();
    return ["en", "ur", "ar", "fa", "ps"].includes(base) ? base : null;
  } catch {
    return null;
  }
}

/** Error thrown for a non-OK ERP API response. Keeps the server's machine `code` so screens can show a localized message. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function apiRequestError(body: unknown, status: number, fallback: string): ApiRequestError {
  const code = (body as any)?.error?.code;
  return new ApiRequestError(messageFromBody(body) || fallback, status, typeof code === "string" ? code : null);
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const lang = clientErpLang();
  const mergedInit: RequestInit = { credentials: "include", ...init };
  if (lang) {
    mergedInit.headers = { ...(init?.headers as Record<string, string> | undefined), "x-erp-lang": lang };
  }
  const res = await fetch(input, mergedInit);
  const body = (await parseJsonSafe(res)) as ApiOk<T> | ApiErr | unknown;

  if (!res.ok) {
    throw apiRequestError(body, res.status, `Request failed: ${res.status}`);
  }

  if (body && typeof body === "object" && (body as any).ok === false) {
    throw apiRequestError(body, res.status, "Request failed");
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
