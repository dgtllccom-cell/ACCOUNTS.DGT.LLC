import type { Metadata } from "next";
import { Building2, Layers3, ShieldCheck } from "lucide-react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoleLoginPortal } from "@/features/auth/components/role-login-portal";

export const metadata: Metadata = {
  title: "Super Admin Login | Digital Dock ERP",
  description: "Global ERP control with audit, configuration, and cross-country visibility.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const lang = await getRequestLanguage();

  return (
    <RoleLoginPortal
      lang={lang}
      error={params.error ? decodeURIComponent(params.error) : undefined}
      config={{
        title: "Super Admin Login",
        subtitle: "Global ERP control with audit, configuration, and cross-country visibility.",
        badge: "Administrative Access",
        formTab: "super_admin",
        scope: "All countries • all branches",
        highlights: [
          { label: "Control", value: "System-wide", icon: <ShieldCheck className="h-4 w-4" /> },
          { label: "Coverage", value: "Audits & configuration", icon: <Building2 className="h-4 w-4" /> },
          { label: "Status", value: "Live ERP portal", icon: <Layers3 className="h-4 w-4" /> },
        ],
      }}
    />
  );
}

