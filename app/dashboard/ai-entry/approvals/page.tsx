"use client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export default function ApprovalQueuePage() {
  const s = useErpScreen("ait");

  return (
    <div className="p-6" dir={s.dir}>
      <h1 className="text-2xl font-bold mb-4">{s.t("approval_title", "Approval Queue")}</h1>
      <div className="bg-blue-50 p-4 rounded">
        <p>{s.t("approval_desc", "Approval queue will show pending AI drafts awaiting your review.")}</p>
        <p className="text-sm text-gray-600 mt-2">
          Connected to: /api/erp/approvals/pending-for-me
        </p>
      </div>
    </div>
  );
}
