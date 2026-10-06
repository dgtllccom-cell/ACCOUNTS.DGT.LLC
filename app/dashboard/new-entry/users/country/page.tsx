import { redirect } from "next/navigation";

export const metadata = { title: "New Entry — Users — Registration" };

export default function CountryUserEntryPage() {
  redirect("/dashboard/new-entry/users/registration");
}
