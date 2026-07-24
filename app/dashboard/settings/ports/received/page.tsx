import { redirect } from "next/navigation";
import type { Route } from "next";

export default function ReceivedPortsRedirect() {
  redirect("/dashboard/settings/ports" as Route);
}
