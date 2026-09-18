"use client";
import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";

export default function PublicMailRegister() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public-mail/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toLowerCase(), displayName })
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) setUsername("");
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">DGT Mail</h1>
        </div>

        {!result?.ok ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-lg font-semibold">Create Email Account</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Name" className="w-full px-3 py-2 border rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <div className="flex gap-2">
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="firstname.lastname" className="flex-1 px-3 py-2 border rounded" required />
                <span className="py-2">@dgt.llc</span>
              </div>
            </div>
            {result?.error && <div className="text-red-600 text-sm">{result.error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <p className="font-semibold text-green-900">Account Created!</p>
            </div>
            <div className="bg-gray-50 p-4 rounded space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600">EMAIL</p>
                <p className="font-mono text-lg">{result.data.emailAddress}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">PASSWORD (save now)</p>
                <p className="font-mono text-lg">{result.data.password}</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Next: <a href="/public-mail/login" className="text-blue-600 underline">Login →</a></p>
            </div>
            <button onClick={() => setResult(null)} className="w-full bg-gray-600 text-white py-2 rounded">
              Create Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
