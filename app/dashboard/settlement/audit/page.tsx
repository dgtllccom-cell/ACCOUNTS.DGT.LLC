import { SettlementAuditView } from "@/features/settlement/components/settlement-audit-view";

export const dynamic = "force-dynamic";

export default function SettlementAuditPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <SettlementAuditView />
    </div>
  );
}
