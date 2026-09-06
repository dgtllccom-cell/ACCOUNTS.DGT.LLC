import { requirePageDomain } from "@/lib/permissions/domain-guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePageDomain("business");
  return children;
}
