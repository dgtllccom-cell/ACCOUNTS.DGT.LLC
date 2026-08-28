import { redirect } from "next/navigation";
import type { Route } from "next";

export const metadata = { title: "Roznamcha" };


export default function RoznamchaIndexPage() {
  redirect("/dashboard/roznamcha/cash-entry" as Route);
}
