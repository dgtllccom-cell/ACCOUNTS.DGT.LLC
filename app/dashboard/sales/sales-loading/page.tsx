import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { SalesLoadingView } from "@/features/sales/components/sales-loading-view";

export const metadata = { title: "Sales Loading" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ source?: string; orderId?: string; action?: string; report?: string }> }) {
  const session = await requireErpSession();
  authorizeApiScope(session, { resource: "sales", action: "read" });
  const params = await searchParams;
  const source = params.source === "local" ? "local" : "booking";
  return <SalesLoadingView key={source} source={source} initialOrderId={params.orderId} initialAction={params.action} initialReport={params.report}/>;
}
