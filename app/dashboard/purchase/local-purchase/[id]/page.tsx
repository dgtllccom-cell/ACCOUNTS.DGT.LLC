import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { LocalPurchaseLifecycleView } from "@/features/purchases/components/local-purchase-lifecycle-view";

export const metadata = { title: "Purchase — Local Purchase Lifecycle" };
export const dynamic = "force-dynamic";

export default async function LocalPurchaseLifecyclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  const { id } = await params;
  const lang = await getRequestLanguage();
  return <LocalPurchaseLifecycleView purchaseId={id} lang={lang} />;
}
