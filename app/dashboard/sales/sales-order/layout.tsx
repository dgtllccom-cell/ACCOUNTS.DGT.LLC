import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Sales Order Entry", template: "%s | Digital Dock ERP" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
