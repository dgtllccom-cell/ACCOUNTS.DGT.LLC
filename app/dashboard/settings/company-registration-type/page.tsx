export const metadata = { title: "Settings — Company Registration Type" };

﻿import { CompanyRegistrationTypeRegistry } from "@/features/company-registration-types/components/company-registration-type-registry";

export default function CompanyRegistrationTypePage() {
  return (
    <div className="p-6">
      <CompanyRegistrationTypeRegistry />
    </div>
  );
}
