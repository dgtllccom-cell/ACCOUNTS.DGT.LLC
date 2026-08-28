import { QuotationView } from "@/features/sales/components/quotation-view";

export const metadata = { title: "Sales — Quotation Demo" };


// Design preview page (from the uploaded ERP UI package). Renders the Quotation
// A4 template with its bundled demo data. chrome={false} hides the package's own
// header/sidebar so it sits cleanly inside the ERP dashboard shell.
export default function QuotationDemoPage() {
  return <QuotationView chrome={false} />;
}
