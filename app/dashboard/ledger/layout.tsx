import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Ledger Hub", template: "%s | Digital Dock ERP" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
