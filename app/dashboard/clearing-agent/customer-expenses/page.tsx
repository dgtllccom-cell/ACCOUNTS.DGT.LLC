"use client";

import { ExpenseBillPage } from "@/features/clearing-agent/components/expense-bill-page";

// Customer Expenses Bills: the register, and the bill entry form — opened on a customer order from Order Transfer (?orderId=…)
export default function CustomerExpensesPage() {
  return <ExpenseBillPage type="customer" billCategory="customer_expenses" backKey="expreg.back_customer" backFallback="Back to Customer Expenses Register" />;
}
