import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe2,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "DGT Mail — Independent Cloud Email Platform (username@dgt.llc)",
  description:
    "Register your personal or business email on dgt.llc. Receive TikTok, Instagram, Meta, and online service verification codes instantly with 1GB free storage.",
};

export default async function DgtMailLandingPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("dgt_mail_user_id");

  if (sessionUser?.value) {
    redirect("/mail/inbox");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-md bg-slate-950/70 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                DGT<span className="text-blue-500">.LLC</span> MAIL
              </span>
              <span className="text-[11px] text-slate-400 block -mt-1 font-medium">Independent Cloud Mail</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/mail/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/mail/register"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
            >
              <span>Create Account</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Open Public Email Service &bull; Available Worldwide</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Your Identity. Your Mailbox.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-300">
              username@dgt.llc
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Create your official <strong className="text-slate-200">@dgt.llc</strong> email account today. 
            Send and receive messages with Gmail, Yahoo, and Outlook, and verify your accounts on 
            <strong className="text-slate-200"> TikTok, Instagram, Facebook, and Google</strong> with zero delay.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/mail/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Claim Your Username Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/mail/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center"
            >
              Existing User Login
            </Link>
          </div>

          {/* Quick Pillars */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Instant Social Verification</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Smart OTP detection auto-highlights verification codes from TikTok, Instagram, Meta, and banking services with one-click copy.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
                <HardDrive className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">1.0 GB Free Cloud Storage</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Every registered mailbox includes 1GB free storage with live quota tracking, automated limit warnings, and instant upgrade options.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Independent Server Network</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Self-hosted high-speed mail infrastructure with DKIM, SPF, DMARC, SSL/TLS, and modern spam filtering built right in.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} DGT.LLC. All rights reserved. Global Mail Platform.</p>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="hover:text-slate-300 transition-colors">
              ERP System
            </Link>
            <Link href="/mail/login" className="hover:text-slate-300 transition-colors">
              Webmail
            </Link>
            <Link href="/mail/register" className="hover:text-slate-300 transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
