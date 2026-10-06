import { redirect } from "next/navigation";

export const metadata = { title: "New Entry — Users — Registration" };

export default function SuperAdminUserEntryPage() {
  redirect("/dashboard/new-entry/users/registration");
}
