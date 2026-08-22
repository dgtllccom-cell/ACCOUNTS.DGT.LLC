export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

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
  if (anyBody?.error?.message) return anyBody.error.message;
  if (typeof anyBody?.error === "string") return anyBody.error;
  if (anyBody?.message) return anyBody.message;
  return null;
}

function getActiveLanguage(): string {
  if (typeof document === "undefined") return "en";
  try {
    return localStorage.getItem("erp_lang") || document.documentElement.lang || "en";
  } catch {
    return "en";
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number; retries?: number }
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = init?.retries ?? (init?.method === "POST" || init?.method === "PUT" || init?.method === "DELETE" ? 0 : MAX_RETRIES);

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        credentials: "include",
        signal: controller.signal,
        ...init
      });

      clearTimeout(timer);

      // If server returned 502/503/504, retry if we have attempts left
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, attempt * 400));
        continue;
      }

      const body = (await parseJsonSafe(res)) as ApiOk<T> | ApiErr | unknown;

      if (!res.ok) {
        throw new Error(messageFromBody(body) || `Request failed: ${res.status}`);
      }

      if (body && typeof body === "object" && (body as any).ok === false) {
        throw new Error(messageFromBody(body) || "Request failed");
      }

      if (body && typeof body === "object" && (body as any).ok === true) {
        return (body as ApiOk<T>).data;
      }

      return body as T;
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err?.name === "AbortError" || err?.message?.includes("aborted");
      const isNetwork = !window.navigator.onLine || err?.message?.includes("Failed to fetch") || isAbort;

      lastError = isAbort ? new Error("Network request timed out. Please verify your connection.") : err;

      if (attempt < maxRetries && isNetwork) {
        attempt++;
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }

      break;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

export async function apiGet<T>(url: string, options?: { timeoutMs?: number; retries?: number }) {
  const lang = getActiveLanguage();
  const separator = url.includes("?") ? "&" : "?";
  const hasLang = url.includes("lang=");
  const fullUrl = `${url}${separator}_t=${Date.now()}${hasLang ? "" : `&lang=${lang}`}`;
  return apiFetch<T>(fullUrl, { cache: "no-store", ...options });
}

export async function apiPost<T>(url: string, payload: unknown, options?: { timeoutMs?: number }) {
  const lang = getActiveLanguage();
  const separator = url.includes("?") ? "&" : "?";
  const hasLang = url.includes("lang=");
  const fullUrl = `${url}${hasLang ? "" : `${separator}lang=${lang}`}`;
  return apiFetch<T>(fullUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...options
  });
}

export async function apiPatch<T>(url: string, payload: unknown, options?: { timeoutMs?: number }) {
  const lang = getActiveLanguage();
  const separator = url.includes("?") ? "&" : "?";
  const hasLang = url.includes("lang=");
  const fullUrl = `${url}${hasLang ? "" : `${separator}lang=${lang}`}`;
  return apiFetch<T>(fullUrl, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...options
  });
}

export async function apiPut<T>(url: string, payload: unknown, options?: { timeoutMs?: number }) {
  const lang = getActiveLanguage();
  const separator = url.includes("?") ? "&" : "?";
  const hasLang = url.includes("lang=");
  const fullUrl = `${url}${hasLang ? "" : `${separator}lang=${lang}`}`;
  return apiFetch<T>(fullUrl, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...options
  });
}

export async function apiDelete<T>(url: string, options?: { timeoutMs?: number }) {
  return apiFetch<T>(url, {
    method: "DELETE",
    ...options
  });
}

export function dispatchErpPostingSaved() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("erp:posting-saved"));
  }
}
