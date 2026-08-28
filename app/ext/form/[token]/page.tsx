/**
 * Server component for /ext/form/[token]
 * Fetches token metadata server-side and delegates rendering to the client.
 */
import type { Metadata } from "next";
import { ExtFormClient } from "./ext-form-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Secure Form Submission | DGT ERP",
    description: "Please fill in the required information and submit securely.",
    robots: { index: false, follow: false },
  };
}

export default async function ExtFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ExtFormClient token={token} />;
}
