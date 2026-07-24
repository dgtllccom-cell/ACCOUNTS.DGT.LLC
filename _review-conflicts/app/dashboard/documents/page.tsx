import Link from "next/link";
import { FileText, Ship } from "lucide-react";

const documents = [
  {
    title: "Bill of Lading",
    description: "Ocean and multimodal transport document with printable layout.",
    href: "/dashboard/documents/bill-of-lading" as const,
    icon: Ship
  }
];

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Printable business documents for shipping, invoices, reports, and attachments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <Link
            key={document.href}
            href={document.href}
            className="rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <document.icon className="mb-4 h-5 w-5 text-primary" aria-hidden />
                <h2 className="font-medium">{document.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {document.description}
                </p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

