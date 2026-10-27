import { dashboardForRoles } from "@/lib/permissions/enterprise-roles";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Which store app is calling: "DGT.llc B" (Business) or "DGT.llc BS" (Business Shipping). Both are thin native shells around the
 * ONE ERP; the shell tags its web view with a User-Agent suffix (see scripts/mobile-env.mjs → appendUserAgent).
 *
 * This is a CHANNEL (which front door was used), not a security boundary: what a login may read or change is still decided only by
 * its role, permissions, operational domain and country/branch scope (route policy, domain guard, scope middleware). The channel just
 * keeps the two store apps clearly separated for the user — a shipping-only login opened in the Business app is told to use the
 * Shipping app, and a Shipping-app login lands on the shipping / clearing dashboards.
 */
export type AppChannel = "b" | "bs";

export function appChannelFromUserAgent(userAgent: string | null | undefined): AppChannel | null {
  const m = /\bDGTllc-(BS|B)\/\d/i.exec(userAgent ?? "");
  if (!m) return null;
  return m[1].toUpperCase() === "BS" ? "bs" : "b";
}

type ChannelSession = Pick<ErpSession, "isSuperAdmin" | "operationalDomains" | "isShippingScoped">;

/** True when this login belongs in the given app. Super Admin may use both. */
export function channelAllowsSession(channel: AppChannel, session: ChannelSession): boolean {
  if (session.isSuperAdmin) return true;
  const domains = session.operationalDomains ?? ["business"];
  if (domains.includes("both")) return true;
  if (channel === "bs") return domains.includes("shipping") || session.isShippingScoped === true;
  return domains.includes("business");
}

/** Where the Shipping app sends a login after sign-in (the Business app keeps the normal role dashboard). */
export function landingForChannel(channel: AppChannel | null, session: Pick<ErpSession, "roles" | "isSuperAdmin" | "isShippingScoped" | "operationalDomains">): string {
  const normal = dashboardForRoles(session.roles, {
    isSuperAdmin: session.isSuperAdmin,
    isShippingScoped: session.isShippingScoped,
    operationalDomains: session.operationalDomains
  });
  if (channel !== "bs") return normal;
  // a shipping / clearing login already gets a shipping-side dashboard; a Super Admin or a "both" login gets the shipping home
  const shippingSide = /\/(logistics|shipping-line|clearing-agent|agent|city\/shipping-line|country\/shipping-line|super-admin\/shipping-line)/.test(normal);
  if (shippingSide) return normal;
  // the shipping home of the login's own management level (a Super Admin on the city page only meets "branch permission required")
  const roles = session.roles as readonly string[];
  if (session.isSuperAdmin || roles.some((r) => ["super_admin", "shipping_super_admin", "global_operations_admin"].includes(r))) return "/dashboard/super-admin/shipping-line";
  if (roles.some((r) => ["country_admin", "country_operations_admin"].includes(r))) return "/dashboard/country/shipping-line";
  return "/dashboard/city/shipping-line";
}
