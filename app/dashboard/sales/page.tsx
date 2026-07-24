export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-muted-foreground">
          Sales documents will use the same transaction-safe ledger posting path as journals and purchases.
        </p>
      </div>
      <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Planned flow: draft sale, validate customer account, produce invoice, generate balanced journal, post to ledger.
      </section>
    </div>
  );
}
