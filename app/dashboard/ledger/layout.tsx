import type { Metadata } from "next";
import { requirePageDomain } from "@/lib/permissions/domain-guard";

export const metadata: Metadata = {
  title: { default: "Ledger Hub", template: "%s | Digital Dock ERP" },
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
