import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Management — Chs Products" };


export default function ChsProductsPage() {
  redirect("/dashboard/settings");
}
