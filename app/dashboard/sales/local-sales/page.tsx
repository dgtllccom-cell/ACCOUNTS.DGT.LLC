import type { Route } from "next";
import { redirect } from "next/navigation";

export const metadata = { title: "Sales — Local Sales" };


export default function LocalSalesRedirect() {
  redirect("/dashboard/sales" as Route);
}

