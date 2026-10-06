import type { Route } from "next";
import { redirect } from "next/navigation";

export const metadata = { title: "New Entry — Accounts — Super Admin" };


export default function SuperAdminAccountEntryRedirect() {
  redirect("/dashboard/accounts/setup" as Route);
}

