'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

export default function PublicMailRegisterPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function checkUsername() {
    if (!username.trim() || username.length < 3) {
      setUsernameAvailable(false);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/public-mail/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch {
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!usernameAvailable) {
      setError('Username not available');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public-mail/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          displayName,
          storageQuotaMb: 1000,
          planType: 'free'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Auto-login after registration
      const token = `public_token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('public_mail_token', token);
      localStorage.setItem('public_mail_user', JSON.stringify({
        username,
        email: `${username}@dgt.llc`,
        displayName
      }));

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Account Created!</h1>
          <p className="text-gray-600">
            Your DGT Mail account has been created successfully.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-left">
            <p className="text-sm font-semibold text-gray-700">Email Address:</p>
            <p className="text-lg font-mono text-blue-600">{username}@dgt.llc</p>
          </div>
          <a
            href="/public-mail/login"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Login to Webmail
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DGT Mail</h1>
        <p className="text-gray-600 mb-8">Create your free email account</p>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase());
                    setUsernameAvailable(null);
                  }}
                  onBlur={checkUsername}
                  placeholder="john.doe"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-xs text-gray-500">@dgt.llc</span>
              </div>
              {checkingUsername && <span className="text-sm text-gray-500 py-2">Checking...</span>}
              {usernameAvailable === true && <Check className="w-5 h-5 text-green-600 my-2" />}
              {usernameAvailable === false && <X className="w-5 h-5 text-red-600 my-2" />}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display Name"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={usernameAvailable !== true || loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/public-mail/login" className="text-blue-600 hover:underline font-semibold">
              Login here
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
