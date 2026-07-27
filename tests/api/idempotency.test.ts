import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getIdempotencyKey,
  hashPayload,
  generateTenantHash,
  buildReplayedResponse
} from "@/lib/api/idempotency";

describe("Idempotency Framework — Core Unit Tests", () => {

  describe("getIdempotencyKey", () => {
    it("should extract x-idempotency-key from headers", () => {
      const req = new NextRequest("http://localhost:3000/api/test", {
        headers: { "x-idempotency-key": "test-key-12345" }
      });
      expect(getIdempotencyKey(req)).toBe("test-key-12345");
    });

    it("should fallback to idempotency-key header if x-idempotency-key is missing", () => {
      const req = new NextRequest("http://localhost:3000/api/test", {
        headers: { "idempotency-key": "fallback-key-999" }
      });
      expect(getIdempotencyKey(req)).toBe("fallback-key-999");
    });

    it("should return null if no idempotency header is present", () => {
      const req = new NextRequest("http://localhost:3000/api/test");
      expect(getIdempotencyKey(req)).toBeNull();
    });
  });

  describe("hashPayload", () => {
    it("should produce deterministic SHA256 hashes for JSON objects", () => {
      const payload1 = { amount: 500, currency: "USD", reference: "VOUCHER-001" };
      const payload2 = { amount: 500, currency: "USD", reference: "VOUCHER-001" };
      
      expect(hashPayload(payload1)).toBe(hashPayload(payload2));
      expect(hashPayload(payload1)).toHaveLength(64); // SHA256 length
    });

    it("should produce different hashes for different payloads", () => {
      const payload1 = { amount: 500, currency: "USD" };
      const payload2 = { amount: 501, currency: "USD" };

      expect(hashPayload(payload1)).not.toBe(hashPayload(payload2));
    });

    it("should handle null or empty payloads safely", () => {
      expect(hashPayload(null)).toBe("EMPTY_PAYLOAD");
      expect(hashPayload(undefined)).toBe("EMPTY_PAYLOAD");
    });
  });

  describe("generateTenantHash", () => {
    it("should generate composite multi-tenant hashes isolating Users, Countries, Branches, and Modules", () => {
      const hashUserA = generateTenantHash({
        userId: "user-111",
        countryId: "country-uae",
        cityBranchId: "branch-dubai",
        scopeModule: "ROZNAMCHA",
        businessReference: "V-100"
      });

      const hashUserB = generateTenantHash({
        userId: "user-222",
        countryId: "country-uae",
        cityBranchId: "branch-dubai",
        scopeModule: "ROZNAMCHA",
        businessReference: "V-100"
      });

      expect(hashUserA).not.toBe(hashUserB); // Cross-user isolation
      expect(hashUserA).toHaveLength(64);
    });

    it("should isolate across different modules for the same user and business reference", () => {
      const hashRoznamcha = generateTenantHash({
        userId: "user-111",
        countryId: "country-uae",
        cityBranchId: "branch-dubai",
        scopeModule: "ROZNAMCHA",
        businessReference: "REF-001"
      });

      const hashPurchase = generateTenantHash({
        userId: "user-111",
        countryId: "country-uae",
        cityBranchId: "branch-dubai",
        scopeModule: "PURCHASE_PAYMENT",
        businessReference: "REF-001"
      });

      expect(hashRoznamcha).not.toBe(hashPurchase); // Cross-module isolation
    });
  });

  describe("buildReplayedResponse", () => {
    it("should inject X-Idempotent-Replayed header into response", () => {
      const body = { ok: true, entryId: "entry-99", isReplayed: true };
      const res = buildReplayedResponse(201, body);

      expect(res.status).toBe(201);
      expect(res.headers.get("X-Idempotent-Replayed")).toBe("true");
    });
  });

});
