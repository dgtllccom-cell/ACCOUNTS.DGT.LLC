import { requireErpSession } from "@/lib/auth/session";
import { PsJournalPurchaseSalesView } from "@/features/stock/components/ps-journal-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stock — P/S Journal (Purchase & Sales)" };

export default async function StockPsJournalPage() {
  const session = await requireErpSession();
  return <PsJournalPurchaseSalesView lang={session.preferredLanguage ?? "en"} />;
}
