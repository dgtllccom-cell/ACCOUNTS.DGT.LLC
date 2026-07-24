import type { Route } from "next";
import { redirect } from "next/navigation";

export default function SuperAdminAccountEntryRedirect() {
  redirect("/dashboard/accounts/setup" as Route);
}

