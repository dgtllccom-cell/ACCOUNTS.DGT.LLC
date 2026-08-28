import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Driver Registration" };


export default function DriverRegistrationSettingsPage() {
  redirect("/dashboard/clearing-agent/truck-registration");
}
