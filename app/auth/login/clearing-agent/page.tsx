import type { Metadata } from "next";
import { Building2, Layers3, ShieldCheck } from "lucide-react";
import { getRequestLanguage } from "@/lib/i18n/server";
import { RoleLoginPortal } from "@/features/auth/components/role-login-portal";

export const metadata: Metadata = {
  title: "Clearing Agent Login | Damaan Business Group ERP",
  description: "Shipping line and clearing workflows with party/company-linked operations.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClearingAgentLoginPage({
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
        title: "Clearing Agent Login",
        subtitle: "Shipping line and clearing workflows with party/company-linked operations.",
        badge: "Shipping & Clearing",
        formTab: "agent",
        scope: "Agent workflow access",
        highlights: [
          { label: "Control", value: "Operational entries", icon: <Layers3 className="h-4 w-4" /> },
          { label: "Coverage", value: "Customer order flow", icon: <Building2 className="h-4 w-4" /> },
          { label: "Status", value: "Dedicated access path", icon: <ShieldCheck className="h-4 w-4" /> },
        ],
      }}
    />
  );
}

