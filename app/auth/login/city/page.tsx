import type { Metadata } from "next";
import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoleLoginPortal } from "@/features/auth/components/role-login-portal";

export const metadata: Metadata = {
  title: "City Branch Login | Damaan Business Group ERP",
  description: "Operational access for city branch users with localized ERP workflows.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function CityLoginPage({
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
        title: "City Branch Login",
        subtitle: "Operational access for city branch users with localized ERP workflows.",
        badge: "City Branch Workspace",
        formTab: "city",
        scope: "City branch access",
        highlights: [
          { label: "Control", value: "City scoped", icon: <MapPin className="h-4 w-4" /> },
          { label: "Coverage", value: "Branch operations", icon: <Building2 className="h-4 w-4" /> },
          { label: "Status", value: "Role-specific portal", icon: <ShieldCheck className="h-4 w-4" /> },
        ],
      }}
    />
  );
}

