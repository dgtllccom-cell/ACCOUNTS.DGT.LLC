"use client";

import { ExpenseBillPage } from "@/features/clearing-agent/components/expense-bill-page";

// Other Expenses Bills: the register, and the bill entry form — opened on a customer order from Order Transfer (?orderId=…)
export default function OtherExpensesBillPage() {
  return <ExpenseBillPage type="other" billCategory="other_expenses" backKey="expreg.back_other" backFallback="Back to Other Expenses Register" />;
}
