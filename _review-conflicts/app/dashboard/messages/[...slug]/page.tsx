import { EmailManagementWorkspace } from "@/features/messages/components/email-management";

const channelBySlug: Record<string, "email" | "whatsapp" | "internal" | "notifications"> = {
  email: "email",
  whatsapp: "whatsapp",
  internal: "internal",
  notifications: "notifications"
};

export default async function MessagesCatchAllPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolvedParams = await params;
  const channel = channelBySlug[resolvedParams.slug?.[0] ?? "email"] ?? "email";
  return <EmailManagementWorkspace channel={channel} />;
}
