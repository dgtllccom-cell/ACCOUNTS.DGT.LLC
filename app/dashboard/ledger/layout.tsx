import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ledger Hub" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
