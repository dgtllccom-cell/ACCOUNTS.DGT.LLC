import { describe, expect, it } from "vitest";
import { resolveModule } from "@/lib/document-intelligence/intake-modules";
import nextConfig from "../../next.config";

describe("Scan / Upload Document deep links", () => {
  it("the Purchase Booking link and the old ?target=purchase_orders link both open Purchase Booking", () => {
    expect(resolveModule("purchase_booking", null)?.id).toBe("purchase_booking");
    expect(resolveModule(null, "purchase_orders")?.id).toBe("purchase_booking");
    expect(resolveModule(null, null)).toBeNull();
  });

  it("the old /dashboard/smart-operations/intake address forwards to Document Intelligence instead of a 404", async () => {
    const redirects = await (nextConfig as any).redirects();
    expect(redirects).toContainEqual(expect.objectContaining({ source: "/dashboard/smart-operations/intake", destination: "/dashboard/document-intelligence" }));
  });
});
