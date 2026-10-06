import { redirect } from "next/navigation";

export const metadata = { title: "New Entry — Users — Registration" };

export default function BranchUserEntryPage() {
  redirect("/dashboard/new-entry/users/registration");
}
