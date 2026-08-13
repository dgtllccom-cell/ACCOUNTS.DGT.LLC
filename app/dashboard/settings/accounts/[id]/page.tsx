import { AccountDetailView } from "@/features/accounts/components/account-detail-view";

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6">
      <AccountDetailView accountId={params.id} />
    </div>
  );
}
