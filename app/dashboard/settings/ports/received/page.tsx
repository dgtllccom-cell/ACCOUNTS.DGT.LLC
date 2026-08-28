import { redirect } from "next/navigation";
import type { Route } from "next";

export const metadata = { title: "Settings — Ports — Received" };


export default function ReceivedPortsRedirect() {
  redirect("/dashboard/settings/ports" as Route);
}
