import { redirect } from "next/navigation";

export const metadata = { title: "Purchase — Journal Report" };


export const dynamic = "force-dynamic";

export default function JournalReportRedirectPage() {
  redirect("/dashboard/inventory/journal-report/salesman");
}
