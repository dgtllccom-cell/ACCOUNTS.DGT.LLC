import { createAccount } from "@/features/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountCreateForm() {
  return (
    <form action={createAccount} className="rounded-lg border bg-card p-5">
      <div className="mb-4">
        <h2 className="font-medium">Create account</h2>
        <p className="text-sm text-muted-foreground">
          Use this after selecting a real company id from the connected workspace context.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="companyId">Company id</Label>
          <Input id="companyId" name="companyId" placeholder="UUID" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" maxLength={3} defaultValue="USD" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="codePreview">Account Code</Label>
          <Input id="codePreview" value="Auto generated on save" readOnly aria-readonly="true" />
          <input type="hidden" name="code" value="AUTO" />
          <p className="text-xs text-muted-foreground">Server generates SA-AC / country / branch sequence automatically.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <select
            id="kind"
            name="kind"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="asset"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input name="isControlAccount" type="checkbox" className="h-4 w-4 rounded border-input" />
        Control account
      </label>
      <div className="mt-5 flex justify-end">
        <Button type="submit">Create account</Button>
      </div>
    </form>
  );
}
