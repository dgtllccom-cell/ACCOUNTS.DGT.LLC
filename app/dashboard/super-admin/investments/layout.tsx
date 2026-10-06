import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Super Admin — Investments & Capital" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/investments");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return children;
}
