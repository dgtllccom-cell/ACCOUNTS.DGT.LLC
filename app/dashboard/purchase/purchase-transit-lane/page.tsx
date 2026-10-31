import { PurchaseTransitLaneView } from "@/features/purchases/components/purchase-transit-lane-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase & Sales — P/S General Transfer" };

export const dynamic = "force-dynamic";

/** Central register for all four bill types: Purchase Booking, Local Purchase, Sales Booking, Local Sales. */
export default async function PurchaseTransitLanePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireErpSession();
  const sp = searchParams ? await searchParams : {};
  const src =
    sp.source === "local_purchase" ||
    sp.source === "purchase_booking" ||
    sp.source === "sales_booking" ||
    sp.source === "local_sales"
      ? (sp.source as "local_purchase" | "purchase_booking" | "sales_booking" | "local_sales")
      : null;
  return <PurchaseTransitLaneView lang={session.preferredLanguage ?? "en"} source={src} />;
}
