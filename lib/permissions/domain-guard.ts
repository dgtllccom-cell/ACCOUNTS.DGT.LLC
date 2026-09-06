import { redirect } from "next/navigation";
import { getCurrentErpSession, type OperationalDomain } from "@/lib/auth/session";

/**
 * Server-side page/layout guard for operational-domain confidentiality.
 *
 * Mirrors `assertResourceDomain()` (which protects the APIs): a Clearing Agent /
 * Shipping-ONLY login must not even render a Business-confidential module page
 * (Purchase, Sales, Ledger, Roznamcha, Accounting). Hiding the sidebar item is
 * not enough — a pasted URL has to fail too.
 *
 * The reverse direction (a Business login opening a shipping page) stays
 * permission-governed so existing Business admins that legitimately manage
 * shipping keep working; create such a user with operational_domain='both'.
 */
export async function requirePageDomain(needed: OperationalDomain): Promise<void> {
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }
  if (session.isSuperAdmin) return;

  const domains = session.operationalDomains ?? ["business"];
  if (domains.includes("both") || domains.includes(needed)) return;

  // The only enforced case for now: shipping-only → business page.
  const shippingOnly = domains.length === 1 && domains[0] === "shipping";
  if (needed === "business" && shippingOnly) {
    redirect("/dashboard?denied=domain");
  }
}
