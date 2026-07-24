import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#160a3a] text-white">
      <div className="mx-auto flex min-h-screen max-w-[900px] items-center px-5 py-10">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/95 p-7 text-slate-950 shadow-2xl shadow-black/25 dark:bg-slate-950/60 dark:text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Forgot Password</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">Request a reset link to your email.</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/auth/login">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Link>
            </Button>
          </div>

          {params.error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {decodeURIComponent(params.error)}
            </div>
          ) : null}

          <form action={requestPasswordReset} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 shadow-none focus-visible:ring-primary"
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Send Reset Link
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

