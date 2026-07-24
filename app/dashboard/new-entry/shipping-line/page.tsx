export default function ShippingLineEntryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shipping Line</h1>
        <p className="text-sm text-muted-foreground">
          Shipping line forms (BL, containers, vessels, freight, invoices) will be available here.
        </p>
      </div>
      <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Placeholder screen (UI foundation). Document templates and attachments will connect to Supabase Storage later.
      </section>
    </div>
  );
}

