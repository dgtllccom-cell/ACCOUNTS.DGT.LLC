import { beforeEach, describe, expect, it, vi } from "vitest";

const lang = vi.hoisted(() => ({ current: "en" as string }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async () => lang.current }));
vi.mock("@/lib/auth/session", () => ({
  ErpAuthError: class ErpAuthError extends Error { status = 401; },
  getCurrentErpSession: async () => null
}));

import { handleApiError, invalidIdErrorOf } from "@/lib/api/response";

// What Postgres (postgres.js / PostgREST) raises when an account number reaches a uuid column.
const pgUuidError = Object.assign(new Error('invalid input syntax for type uuid: "ACC-000080"'), { code: "22P02" });

describe("invalidIdErrorOf — non-id values in uuid comparisons", () => {
  beforeEach(() => { lang.current = "en"; });

  it("answers 400 INVALID_ID with the offending value for a 22P02 uuid error", async () => {
    const r = await invalidIdErrorOf(pgUuidError);
    expect(r).toMatchObject({ code: "INVALID_ID", status: 400, value: "ACC-000080" });
    expect(r?.message).toContain('"ACC-000080"');
    expect(r?.message).not.toMatch(/invalid input syntax/i);
  });

  it("also recognises the message alone (Supabase paths rethrow new Error(message)) and plain strings", async () => {
    expect((await invalidIdErrorOf(new Error('invalid input syntax for type uuid: "cust_123"')))?.value).toBe("cust_123");
    expect((await invalidIdErrorOf('invalid input syntax for type uuid: "PK-QUE-GEN-001"'))?.value).toBe("PK-QUE-GEN-001");
  });

  it("leaves every other error alone", async () => {
    expect(await invalidIdErrorOf(new Error("Customer order not found"))).toBeNull();
    expect(await invalidIdErrorOf(new Error('invalid input syntax for type integer: "abc"'))).toBeNull();
    expect(await invalidIdErrorOf({ code: "23505", message: "duplicate key value" })).toBeNull();
    expect(await invalidIdErrorOf(null)).toBeNull();
    expect(await invalidIdErrorOf(undefined)).toBeNull();
  });

  it("renders the message in all five languages, each different from English", async () => {
    const messages: Record<string, string> = {};
    for (const l of ["en", "ur", "ar", "fa", "ps"]) {
      lang.current = l;
      messages[l] = (await invalidIdErrorOf(pgUuidError))!.message;
      expect(messages[l]).toContain("ACC-000080");
    }
    expect(new Set(Object.values(messages)).size).toBe(5);
  });
});

describe("handleApiError — 22P02 is the caller's mistake, not a server error", () => {
  beforeEach(() => { lang.current = "en"; });

  it("maps a thrown uuid error to 400 INVALID_ID instead of 500 SERVER_ERROR", async () => {
    const res = await handleApiError(pgUuidError);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "INVALID_ID", details: { value: "ACC-000080" } } });
  });

  it("also when a route wrapped the raw message in an ApiClientError (400 BAD_REQUEST)", async () => {
    const { ApiClientError } = await import("@/lib/api/response");
    const res = await handleApiError(new ApiClientError('invalid input syntax for type uuid: "ACC-000716"'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_ID");
  });

  it("also when a route threw the PostgREST error object itself (`if (error) throw error`)", async () => {
    const postgrestError = { code: "22P02", details: null, hint: null, message: 'invalid input syntax for type uuid: "ACC-000080"' };
    const res = await handleApiError(postgrestError);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: "INVALID_ID", details: { value: "ACC-000080" } });
  });

  it("still answers 500 for a genuine server error", async () => {
    const res = await handleApiError(new Error("connection terminated unexpectedly"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("SERVER_ERROR");
  });
});
