"use client";

import { ExpenseBillPage } from "@/features/clearing-agent/components/expense-bill-page";

// Truck Expenses Bills: the register, and the bill entry form — opened on a customer order from Order Transfer (?orderId=…)
export default function TruckExpensesBillPage() {
  return <ExpenseBillPage type="truck" billCategory="truck_expenses" backKey="expreg.back_truck" backFallback="Back to Truck Expenses Register" />;
}
