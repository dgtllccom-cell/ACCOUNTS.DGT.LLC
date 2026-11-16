import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readBrowserLanguage } from "@/lib/i18n/browser-language";
import { apiFetch } from "@/lib/api/client";

beforeEach(() => { localStorage.clear(); document.documentElement.lang = "en"; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("shared viewer language", () => {
  it.each(["en", "ur", "ar", "fa", "ps"])("uses the selected %s language before stale HTML", (lang) => {
    localStorage.setItem("erp_lang", lang);
    document.documentElement.lang = lang === "en" ? "ur" : "en";
    expect(readBrowserLanguage()).toBe(lang);
  });
  it("normalizes regional tags", () => {
    localStorage.setItem("erp_lang", " ur-PK ");
    expect(readBrowserLanguage()).toBe("ur");
  });
  it("uses valid HTML when storage is unsupported", () => {
    localStorage.setItem("erp_lang", "xx");
    document.documentElement.lang = "fa";
    expect(readBrowserLanguage()).toBe("fa");
  });
  it("keeps language available when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    document.documentElement.lang = "ar";
    expect(readBrowserLanguage()).toBe("ar");
  });
});

describe("API language header preserves request headers", () => {
  it.each(["en", "ur", "ar", "fa", "ps"])("sends %s with Headers instances", async (lang) => {
    localStorage.setItem("erp_lang", lang);
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ok: true, data: {}}) });
    vi.stubGlobal("fetch", fetch);
    await apiFetch("/api/example", { headers: new Headers({ authorization: "test-token", "content-type": "application/json" }) });
    const sent = new Headers(fetch.mock.calls[0][1].headers);
    expect(sent.get("x-erp-lang")).toBe(lang);
    expect(sent.get("authorization")).toBe("test-token");
    expect(sent.get("content-type")).toBe("application/json");
  });
  it("preserves tuple headers and overrides a stale language header", async () => {
    localStorage.setItem("erp_lang", "ps");
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ok: true, data: {}}) });
    vi.stubGlobal("fetch", fetch);
    await apiFetch("/api/example", { headers: [["x-erp-lang", "ur"], ["x-request-id", "test-id"]] });
    const sent = new Headers(fetch.mock.calls[0][1].headers);
    expect(sent.get("x-erp-lang")).toBe("ps");
    expect(sent.get("x-request-id")).toBe("test-id");
  });
  it("preserves headers inherited from Request input", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ok: true, data: {}}) });
    vi.stubGlobal("fetch", fetch);
    await apiFetch(new Request("https://example.test/api", {headers: {authorization: "test-token"}}));
    const sent = new Headers(fetch.mock.calls[0][1].headers);
    expect(sent.get("authorization")).toBe("test-token");
    expect(sent.get("x-erp-lang")).toBe("en");
  });
});
