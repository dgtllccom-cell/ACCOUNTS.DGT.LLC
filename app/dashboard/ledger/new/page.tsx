export const dynamic = "force-dynamic";

import { NewLedgerDashboard } from "@/features/ledger/components/new-ledger-dashboard";

export const metadata = { title: "New Ledger Entry" };


export default async function NewLedgerPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return <NewLedgerDashboard initialAccount={params?.account ?? params?.q ?? ""} />;
}
