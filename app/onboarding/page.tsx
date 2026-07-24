import { Building2 } from "lucide-react";
import { createWorkspace } from "@/features/companies/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4 py-10">
      <form action={createWorkspace} className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Create your workspace</h1>
            <p className="text-sm text-muted-foreground">
              This creates the company, first branch, owner role, membership, and starter chart of accounts.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" name="companyName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" name="legalName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseCurrency">Base currency</Label>
            <Input id="baseCurrency" name="baseCurrency" maxLength={3} defaultValue="USD" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerFullName">Your name</Label>
            <Input id="ownerFullName" name="ownerFullName" autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchName">First branch</Label>
            <Input id="branchName" name="branchName" defaultValue="Main Branch" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchCode">Branch code</Label>
            <Input id="branchCode" name="branchCode" defaultValue="MAIN" required />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit">Create workspace</Button>
        </div>
      </form>
    </main>
  );
}
