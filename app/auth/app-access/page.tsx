import { AppAccessNotice } from "@/features/auth/components/app-access-notice";

export const metadata = { title: "DGT.llc — Wrong app for this login" };
export const dynamic = "force-dynamic";

export default async function AppAccessPage({ searchParams }: { searchParams?: Promise<{ app?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return <AppAccessNotice app={params.app === "bs" ? "bs" : "b"} />;
}
