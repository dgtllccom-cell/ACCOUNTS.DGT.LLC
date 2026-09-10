import { redirect } from "next/navigation";

export const metadata = { title: "Redirecting — Edit History" };

export default function EditHistoryPage() {
  redirect("/dashboard/super-admin/edit-history");
}
