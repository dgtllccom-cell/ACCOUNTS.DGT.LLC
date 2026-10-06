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
  const factory = REGISTRY[key] ?? REGISTRY.mock;
  return factory();
}

export function listAspProviders(): string[] {
  return Object.keys(REGISTRY);
}
