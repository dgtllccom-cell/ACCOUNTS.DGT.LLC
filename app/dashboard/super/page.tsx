import { redirect } from "next/navigation";

export const metadata = { title: "Super" };


export default function SuperDashboardRedirectPage() {
  redirect("/dashboard/super-admin");
}
