import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Entry — All Users" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
