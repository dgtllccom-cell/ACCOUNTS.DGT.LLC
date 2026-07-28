import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";

export default function NewEmployeeMasterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Employee Master Form...</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "New Employee Master Form | Employee Management System",
    description: "Create and register a new employee record in the ERP system",
  };
}
