import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { SalesLoadingView } from "@/features/sales/components/sales-loading-view";

export const metadata = { title: "Sales Loading" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ orderId?: string; action?: string; report?: string }> }) {
  const session = await requireErpSession();
  authorizeApiScope(session, { resource: "sales", action: "read" });
  const params = await searchParams;
  return <SalesLoadingView initialOrderId={params.orderId} initialAction={params.action} initialReport={params.report}/>;
}
