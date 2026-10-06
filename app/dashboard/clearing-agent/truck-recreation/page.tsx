import { redirect } from "next/navigation";

export const metadata = { title: "Clearing Agent — Truck Registration" };

export default function TruckRecreationPage() {
  redirect("/dashboard/clearing-agent/truck-registration");
}
