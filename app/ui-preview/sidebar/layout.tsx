import type { Metadata } from "next";

export const metadata: Metadata = { title: "UI Preview — Sidebar" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
