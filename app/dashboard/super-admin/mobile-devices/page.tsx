import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { MobileDevicesAdmin } from "@/features/mobile-devices/components/mobile-devices-admin";

export const metadata = { title: "Mobile Devices" };
export const dynamic = "force-dynamic";

export default async function MobileDevicesPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/mobile-devices");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return (
    <div className="p-3 sm:p-5">
      <MobileDevicesAdmin />
    </div>
  );
}
