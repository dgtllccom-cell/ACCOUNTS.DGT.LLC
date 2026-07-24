import { redirect } from "next/navigation";

export default function JournalReportRedirectPage() {
  redirect("/dashboard/inventory/journal-report/salesman");
}
