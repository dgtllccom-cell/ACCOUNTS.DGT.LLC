import { AccountDetailView } from "@/features/accounts/components/account-detail-view";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-6">
      <AccountDetailView accountId={id} />
    </div>
  );
}
