"use client";

import { ExpenseBillPage } from "@/features/clearing-agent/components/expense-bill-page";

// Customs Bills: the register, and the bill entry form — opened on a customer order from Order Transfer (?orderId=…)
export default function CustomsExpensesBillPage() {
  return <ExpenseBillPage type="customs" billCategory="customs_expenses" backKey="expreg.back_customs" backFallback="Back to Custom Bills Register" />;
}
