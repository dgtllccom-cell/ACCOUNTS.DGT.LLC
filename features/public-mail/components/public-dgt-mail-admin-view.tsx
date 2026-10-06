'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, EyeOff, Trash2, RotateCcw, Check, X } from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';

interface PublicMailUser {
  id: string;
  username: string;
  email_address: string;
  display_name: string;
  storage_quota_mb: number;
  storage_used_mb: number;
  plan_type: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

export function PublicDgtMailAdminView() {
  const s = useErpScreen('public_mail');
  const [users, setUsers] = useState<PublicMailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    password: '',
    storageQuotaMb: 1000,
    planType: 'free',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/public-mail/users', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.data?.users || []);
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkUsernameAvailability() {
    if (!formData.username.trim()) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/public-mail/check-username?username=${encodeURIComponent(formData.username)}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch (err) {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameAvailable) return;

    try {
      const res = await fetch('/api/public-mail/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      setFormData({ username: '', displayName: '', password: '', storageQuotaMb: 1000, planType: 'free' });
      setShowForm(false);
      setUsernameAvailable(null);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error:', err.message);
    }
  }

  return (
    <div dir={s.dir} className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-red-600">{s.t('public_mail_title', 'PUBLIC DGT MAIL')}</h1>
          <p className="text-sm text-slate-500">{s.t('public_mail_subtitle', 'Create and manage public email accounts')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          {s.t('create_account', 'Create Account')}
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-6 bg-slate-50">
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('username', 'Username')}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => {
                        setFormData({ ...formData, username: e.target.value });
                        setUsernameAvailable(null);
                      }}
                      onBlur={checkUsernameAvailability}
                      placeholder="john.doe"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500">@dgt.llc</span>
                  </div>
                  {checkingUsername && <span className="text-sm text-slate-500 py-2">Checking...</span>}
                  {usernameAvailable === true && <Check className="w-5 h-5 text-green-600 my-2" />}
                  {usernameAvailable === false && <X className="w-5 h-5 text-red-600 my-2" />}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('display_name', 'Display Name')}
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('password', 'Initial Password')}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 hover:bg-slate-200 rounded"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('plan_type', 'Plan Type')}
                </label>
                <select
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="free">Free (1 GB)</option>
                  <option value="pro">Pro (10 GB)</option>
                  <option value="business">Business (100 GB)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                {s.t('storage_quota', 'Storage Quota (MB)')}
              </label>
              <input
                type="number"
                value={formData.storageQuotaMb}
                onChange={(e) => setFormData({ ...formData, storageQuotaMb: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={usernameAvailable !== true}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {s.t('create', 'Create Account')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
              >
                {s.t('cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">{s.t('loading', 'Loading accounts...')}</div>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <div key={user.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{user.username}@dgt.llc</h3>
                  <p className="text-sm text-slate-500">{user.display_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span>{user.storage_used_mb}/{user.storage_quota_mb} MB</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {user.plan_type}
                    </span>
                    <span className={user.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                      {user.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
