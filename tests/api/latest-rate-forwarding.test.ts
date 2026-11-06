// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => ({ userId: "authorized" }) }));
vi.mock("@/lib/api/response", () => ({ rethrowIfNextControlFlow: () => {} }));
import { GET } from "@/app/api/erp/currency/latest-rate/route";
afterEach(() => vi.unstubAllGlobals());
it("keeps transaction date, currency and branch in the authoritative request", async () => {
  const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => Response.json({ data: { found: true, rateDate: "2026-10-28", buyingRate: 288, sellingRate: 287, creditRate: 287, debitRate: 288 } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new NextRequest("http://localhost/api/erp/currency/latest-rate?countryId=pk&countryBranchId=main&cityBranchId=chaman&branchCurrency=PKR&date=2026-10-28"));
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(Object.fromEntries(url.searchParams)).toEqual({ countryId: "pk", countryBranchId: "main", cityBranchId: "chaman", currency: "PKR", date: "2026-10-28" });
  expect(await response.json()).toMatchObject({ found: true, debitRate: 288, creditRate: 287 });
});
it("never invents a 1:1 quote when the exact date has no approved rate", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { found: false, status: "PENDING_MISSING" } })));
  const response = await GET(new NextRequest("http://localhost/api/erp/currency/latest-rate?countryId=pk&currency=PKR"));
  expect(await response.json()).toMatchObject({ found: false, rate: 0, effectiveDate: null, source: "pending_missing" });
});
it("preserves delegated permission failures", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Forbidden" }, { status: 403 })));
  expect((await GET(new NextRequest("http://localhost/api/erp/currency/latest-rate?countryId=other"))).status).toBe(403);
});
