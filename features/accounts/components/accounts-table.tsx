import { Button } from "@/components/ui/button";

const accountRows = [
  { code: "1000", name: "Cash and bank", kind: "Asset", currency: "USD", status: "Active" },
  { code: "2000", name: "Trade payable", kind: "Liability", currency: "USD", status: "Active" },
  { code: "4000", name: "Sales revenue", kind: "Income", currency: "USD", status: "Active" }
];

export function AccountsTable() {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-medium">Chart foundation</h2>
          <p className="text-sm text-muted-foreground">Seed rows shown until Supabase data is connected.</p>
        </div>
        <Button size="sm">New account</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Currency</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {accountRows.map((row) => (
              <tr key={row.code} className="border-t">
                <td className="px-5 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3">{row.kind}</td>
                <td className="px-5 py-3">{row.currency}</td>
                <td className="px-5 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
