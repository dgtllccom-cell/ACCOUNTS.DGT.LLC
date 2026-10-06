import type { Route } from "next";
import { redirect } from "next/navigation";

export const metadata = { title: "Sales — Local Sales" };

// Local Sales has no separate transactional model of its own — selling stock
// sourced via a local purchase is already a first-class "sale source" option
// inside the one Sales Booking wizard (SALE_SOURCE_OPTIONS: "local" ==
// "Local Purchase" in sales-order-wizard.jsx). Rather than leave this as a
// silent, unexplained alias to the generic booking form, deep-link into that
// same wizard with the Local Purchase source pre-selected.
export default function LocalSalesRedirect() {
  redirect("/dashboard/sales/new-sales-booking-order?source=local" as Route);
}

