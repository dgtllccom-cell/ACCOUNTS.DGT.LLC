import { PurchaseTransitLaneView } from "@/features/purchases/components/purchase-transit-lane-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Purchase Transit & Lane" };

export const dynamic = "force-dynamic";

/** Shared report: reachable from the Purchase Booking menu AND the Local Purchase menu (?source=local_purchase pre-filters). */
export default async function PurchaseTransitLanePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const src = sp.source === "local_purchase" || sp.source === "purchase_booking" ? (sp.source as "local_purchase" | "purchase_booking") : null;
  return <PurchaseTransitLaneView lang={session.preferredLanguage ?? "en"} source={src} />;
}
