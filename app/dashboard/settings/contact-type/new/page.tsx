import { ContactTypeManagement } from "@/features/contact-types/components/contact-type-management";

export default function NewContactTypePage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <ContactTypeManagement />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "New Contact Type | Settings",
    description: "Define contact types and validation rules",
  };
}
