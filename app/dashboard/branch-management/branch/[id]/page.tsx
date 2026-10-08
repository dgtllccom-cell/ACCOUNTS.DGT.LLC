import { BranchDetailView } from "@/features/branch-management/components/network-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Branch Detail" };

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getRequestLanguage();
  return <BranchDetailView branchId={id} lang={lang} />;
}
