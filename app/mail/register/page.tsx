"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";

export default function PublicMailRegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [planId, setPlanId] = useState("free_1gb");

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameFeedback, setUsernameFeedback] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced username availability check
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameAvailable(null);
      setUsernameFeedback("");
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameFeedback("Username must be at least 3 characters");
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mail/register?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameFeedback(data.reason || "");
      } catch {
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable) {
      setError("Please choose an available username first");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/mail/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          password,
          recoveryEmail: recoveryEmail.trim() || undefined,
          planId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }

      router.push("/mail/inbox");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-6 text-center z-10">
        <Link href="/mail" className="inline-flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">
            DGT<span className="text-blue-500">.LLC</span> MAIL
          </span>
        </Link>
        <h2 className="text-2xl font-black text-white mt-3 tracking-tight">Create your @dgt.llc account</h2>
        <p className="text-xs text-slate-400 mt-1">
          Instant public registration with 1.0 GB free cloud storage
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-7 shadow-2xl z-10">
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Picker with live domain tag */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Choose your username
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                placeholder="yourname"
                className="w-full pl-3.5 pr-24 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-mono text-white placeholder:text-slate-600 outline-none transition-all"
                required
              />
              <span className="absolute right-8 text-xs font-bold text-blue-400 pointer-events-none select-none">
                @dgt.llc
              </span>
              <div className="absolute right-2.5">
                {isCheckingUsername ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : usernameAvailable === true ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : usernameAvailable === false ? (
                  <XCircle className="h-4 w-4 text-rose-500" />
                ) : null}
              </div>
            </div>

            {usernameFeedback && (
              <p
                className={`text-[11px] mt-1.5 font-medium ${
                  usernameAvailable ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {usernameFeedback}
              </p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name / Display Name
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-white placeholder:text-slate-600 outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password (at least 8 characters)
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-white placeholder:text-slate-600 outline-none transition-all"
                required
                minLength={8}
              />
            </div>
          </div>

          {/* Recovery Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Recovery Email (Optional)
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="existing@gmail.com (for password recovery)"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-white placeholder:text-slate-600 outline-none transition-all"
              />
            </div>
          </div>

          {/* Storage Tier Preview Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-4 w-4 text-blue-400" />
              <div>
                <span className="text-xs font-bold text-white block">Starter Cloud Quota</span>
                <span className="text-[11px] text-slate-400">1.0 GB Free Included</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              FREE
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !usernameAvailable}
            className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have a DGT email?{" "}
            <Link href="/mail/login" className="text-blue-400 hover:text-blue-300 font-semibold">
              Sign In here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
