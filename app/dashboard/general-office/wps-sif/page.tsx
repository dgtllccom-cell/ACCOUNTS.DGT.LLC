import { requireErpSession } from "@/lib/auth/session";
import { WpsSifView } from "@/features/hrm/components/wps-sif-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "UAE WPS & SIF — HRM" };

export default async function WpsSifPage() {
  const session = await requireErpSession();
  return <WpsSifView lang={session.preferredLanguage ?? "en"} />;
}
