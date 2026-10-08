/**
 * DESIGN/PROTOTYPE ONLY.
 *
 * This flag is intentionally isolated to the prototype branch. It must never
 * be enabled on Production. In prototype mode the UI renders with a synthetic
 * Super Admin session and all data writes are intercepted/no-op.
 */
export function isPrototypeMode(): boolean {
  return process.env.DGT_PROTOTYPE_MODE === "1" ||
    process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE === "1";
}

export function buildPrototypeSession() {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "prototype@dgt.local",
    fullName: "DGT ERP Prototype",
    preferredLanguage: "en",
    roles: ["super_admin"],
    permissions: ["*:*"],
    assignments: [],
    countryIds: [],
    countryBranchIds: [],
    cityBranchIds: [],
    isSuperAdmin: true,
    clearingAgentIds: [],
    ledgerVisibility: "full",
    isShippingScoped: false,
    operationalDomains: ["business", "shipping"],
    mobileProfile: "standard",
    mustChangePassword: false,
    isGlobalScope: true,
    shippingLineIds: [],
    canViewFinancials: true,
  } as const;
}
