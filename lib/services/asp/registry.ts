import { MockAspAdapter } from "@/lib/services/asp/providers/mock-asp";
import type { AspAdapter } from "@/lib/services/asp/asp-adapter";

/**
 * Provider registry. Add an accredited provider by implementing AspAdapter and
 * registering it here — no other ERP code changes. `mock` is always available.
 */
const REGISTRY: Record<string, () => AspAdapter> = {
  mock: () => new MockAspAdapter(),
};

export function getAspAdapter(provider: string | null | undefined): AspAdapter {
  const key = (provider || "mock").toLowerCase();
  const isProduction = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  // Never report a simulated ASP acceptance as a real UAE e-invoice submission.
  if (isProduction && key === "mock") {
    throw new Error("A real accredited ASP must be configured before submitting production e-invoices.");
  }
  const factory = REGISTRY[key];
  if (!factory) {
    if (isProduction) throw new Error("The configured ASP is not registered; submission was not sent.");
    return REGISTRY.mock();
  }
  return factory();
}

export function listAspProviders(): string[] {
  return Object.keys(REGISTRY);
}
