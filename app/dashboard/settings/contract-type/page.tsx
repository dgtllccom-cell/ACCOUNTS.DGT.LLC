import type { Route } from "next";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Contract Type" };


export default function ContractTypeSettingsRedirect() {
  redirect("/dashboard/settings/management" as Route);
}

