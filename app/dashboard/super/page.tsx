import { redirect } from "next/navigation";

export default function SuperDashboardRedirectPage() {
  redirect("/dashboard/super-admin");
}
