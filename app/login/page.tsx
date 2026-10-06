import { redirect } from "next/navigation";

export const metadata = { title: "Login" };


export default function LoginPageRedirect() {
  redirect("/auth/login");
}
