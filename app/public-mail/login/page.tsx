"use client";
import { useState } from "react";
import { Mail, Lock } from "lucide-react";

export default function PublicMailLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // Test IMAP login by connecting to the mailbox
      const res = await fetch("/api/public-mail/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        setError("Login failed. Check email and password.");
        return;
      }
      
      setLoggedIn(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loggedIn) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome!</h1>
          <p className="text-gray-600 mb-4">You are logged in as:</p>
          <p className="font-mono text-lg mb-6">{email}</p>
          
          <div className="bg-blue-50 p-4 rounded mb-4">
            <p className="font-semibold mb-2">Configure Your Email Client:</p>
            <ul className="text-sm space-y-1">
              <li><strong>IMAP:</strong> imap.staging-mail.dgt.llc:993 (SSL)</li>
              <li><strong>SMTP:</strong> smtp.staging-mail.dgt.llc:465 (SSL)</li>
              <li><strong>Email:</strong> {email}</li>
              <li><strong>Password:</strong> (your password above)</li>
            </ul>
          </div>
          
          <button onClick={() => { setLoggedIn(false); setEmail(""); setPassword(""); }} className="w-full bg-gray-600 text-white py-2 rounded">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">DGT Mail Login</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@dgt.llc" className="w-full px-3 py-2 border rounded" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border rounded" required />
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Don't have an account? <a href="/public-mail/register" className="text-blue-600 underline font-semibold">Create one</a></p>
        </div>
      </div>
    </div>
  );
}
