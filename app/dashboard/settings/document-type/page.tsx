import { DocumentTypeRegistry } from "@/features/document-types/components/document-type-registry";

export const metadata = { title: "Settings — Document Type" };


export default function DocumentTypePage() {
  return (
    <div className="p-6">
      <DocumentTypeRegistry />
    </div>
  );
}
