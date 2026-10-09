import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { GoodsTransferJournalView } from "@/features/purchases/components/goods-transfer-journal-view";

export const metadata = { title: "Purchase — Goods Transfer Journal" };
export const dynamic = "force-dynamic";

export default async function GoodsTransferJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  const { id } = await params;
  const lang = await getRequestLanguage();
  return <GoodsTransferJournalView purchaseId={id} lang={lang} />;
}
