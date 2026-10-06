import { redirect } from "next/navigation";

export const metadata = { title: "Page.Tsx" };


export default function HomePage() {
  redirect("/auth/login");
}
