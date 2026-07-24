export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
        <p className="text-sm text-muted-foreground">
          Purchase documents will be added after journal posting and account controls are connected.
        </p>
      </div>
      <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Planned flow: draft purchase, validate goods and supplier account, generate balanced journal, post to ledger.
      </section>
    </div>
  );
}
