import { redirect } from "next/navigation";

export const metadata = { title: "Redirecting — Deleted Records" };

export default function DeletedRecordsPage() {
  redirect("/dashboard/super-admin/deleted-records");
}
