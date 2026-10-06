import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Employees" };


export default function EmployeesSettingsPage() {
  redirect("/dashboard/general-office/employees");
}

