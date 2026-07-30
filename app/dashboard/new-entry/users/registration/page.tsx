import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";

export default function UserRegistrationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading User Registration Form...</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "User Registration Form | User Setup Wizard",
    description: "Enterprise 4-Step User Registration Wizard for Super Admins, Country Admins, Branch Admins, Accountants, Cashiers, and Staff Users.",
  };
}
