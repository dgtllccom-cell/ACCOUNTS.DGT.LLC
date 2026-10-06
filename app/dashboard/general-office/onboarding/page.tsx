import { requireErpSession } from "@/lib/auth/session";
import { OnboardingView } from "@/features/hrm/components/onboarding-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Onboarding & Offboarding — HRM" };

export default async function OnboardingPage() {
  const session = await requireErpSession();
  return <OnboardingView lang={session.preferredLanguage ?? "en"} />;
}
