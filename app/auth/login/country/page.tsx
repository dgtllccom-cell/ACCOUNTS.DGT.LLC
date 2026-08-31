import type { Metadata } from "next";
import { Building2, Globe2, ShieldCheck } from "lucide-react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoleLoginPortal } from "@/features/auth/components/role-login-portal";

export const metadata: Metadata = {
  title: "Country Admin Login | Digital Dock ERP",
  description: "Country-level operations with branch-aware master data and reports.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function CountryLoginPage({
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
        title: "Country Admin Login",
        subtitle: "Country-level operations with branch-aware master data and reports.",
        badge: "Country Workspace",
        formTab: "country",
        scope: "Country-level access",
        highlights: [
          { label: "Control", value: "Country scoped", icon: <Globe2 className="h-4 w-4" /> },
          { label: "Coverage", value: "Masters & reporting", icon: <Building2 className="h-4 w-4" /> },
          { label: "Status", value: "Scoped login portal", icon: <ShieldCheck className="h-4 w-4" /> },
        ],
      }}
    />
  );
}

