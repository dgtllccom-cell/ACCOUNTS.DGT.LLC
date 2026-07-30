import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";

export default function NewUserRegistrationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading User Registration Form...</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "User Registration Form | System User Setup",
    description: "Create and register a new system user record in the ERP system",
  };
}
