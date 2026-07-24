import type { Route } from "next";
import { redirect } from "next/navigation";

export default function ReportsCatchAllRedirect() {
  redirect("/dashboard/reports" as Route);
}

