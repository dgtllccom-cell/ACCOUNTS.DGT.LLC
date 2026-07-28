import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";

export default function EmployeeMasterRegistrationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Employee Master Form...</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "Employee Master Form | Employee Management System",
    description: "Enterprise 4-Step Employee Registration Wizard for Managers, Supervisors, Accountants, Sales Staff, Cashiers, Drivers, and Workers.",
  };
}
