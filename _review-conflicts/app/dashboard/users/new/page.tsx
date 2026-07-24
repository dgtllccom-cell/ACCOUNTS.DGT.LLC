import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";

export default function UserRegistrationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Wizard...</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "New User Registration | ERP",
    description: "Create and register a new user in the ERP system",
  };
}
