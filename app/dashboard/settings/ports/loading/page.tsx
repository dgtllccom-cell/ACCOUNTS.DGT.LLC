import { redirect } from "next/navigation";
import type { Route } from "next";

export const metadata = { title: "Settings — Ports — Loading" };


export default function LoadingPortsRedirect() {
  redirect("/dashboard/settings/ports" as Route);
}
