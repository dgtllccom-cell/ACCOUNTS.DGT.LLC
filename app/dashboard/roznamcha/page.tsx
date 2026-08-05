import { redirect } from "next/navigation";
import type { Route } from "next";

export default function RoznamchaIndexPage() {
  redirect("/dashboard/roznamcha/cash-entry" as Route);
}
