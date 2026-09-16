'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface EmailAccount {
  id: string;
  emailAddress: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  hasPassword: boolean;
  smtpStatus: string;
  emailStatus: string;
  lastTestedAt?: string;
  lastTestResult?: string;
  isActive: boolean;
}

interface UpdateCredentialForm {
  smtpPass: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

export function EmailSettingsView() {
  const s = useErpScreen('email_settings');
  const router = useRouter();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateCredentialForm>({
    smtpPass: '',
    smtpHost: undefined,
    smtpPort: undefined,
    smtpSecure: true
  });

  // Fetch email accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/erp/email/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSmtp = async (accountId: string) => {
    try {
      setTestingId(accountId);
      setError(null);
      const res = await fetch(`/api/erp/email/accounts/${accountId}/test`, {
        method: 'POST'
      });
      const data = await res.json();

      if (!res.ok) {
        setError(`SMTP test failed: ${data.error?.message || 'Unknown error'}`);
      } else {
        setSuccess('SMTP and IMAP connections verified successfully!');
        setTimeout(() => setSuccess(null), 3000);
        fetchAccounts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleUpdateCredential = async (accountId: string) => {
    if (!formData.smtpPass && !formData.smtpHost) {
      setError('Please enter at least a password or SMTP host');
      return;
    }

    try {
      setUpdatingId(accountId);
      setError(null);

      const updatePayload: any = { id: accountId };
      if (formData.smtpPass) updatePayload.smtpPass = formData.smtpPass;
      if (formData.smtpHost) updatePayload.smtpHost = formData.smtpHost;
      if (formData.smtpPort) updatePayload.smtpPort = formData.smtpPort;
      if (formData.smtpSecure !== undefined) updatePayload.smtpSecure = formData.smtpSecure;

      const res = await fetch('/api/erp/email/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) throw new Error('Failed to update credential');

      setSuccess('Credential updated! Testing connection...');

      // Auto-test after update
      setTimeout(() => handleTestSmtp(accountId), 500);

      setFormData({ smtpPass: '', smtpHost: undefined, smtpPort: undefined, smtpSecure: true });
      setEditingId(null);
      fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Connected')) return 'text-green-600';
    if (status.includes('Failed')) return 'text-red-600';
    if (status.includes('Not Tested')) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6" dir={s.dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{s.t('email_settings.title', 'Email Account Settings')}</h1>
          <p className="text-gray-600 mt-2">{s.t('email_settings.subtitle', 'Manage email credentials, test connections, and monitor account status')}</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-800">✅ {success}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p>{s.t('email_settings.loading', 'Loading email accounts...')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p>{s.t('email_settings.no_accounts', 'No email accounts configured')}</p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{account.displayName}</CardTitle>
                      <CardDescription>{account.emailAddress}</CardDescription>
                    </div>
                    <div className={`text-sm font-semibold ${getStatusColor(account.smtpStatus)}`}>
                      {account.smtpStatus}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Current Configuration */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-semibold block mb-1">{s.t('email_settings.smtp_host', 'SMTP Host')}</label>
                      <p className="text-gray-700">{account.smtpHost}</p>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">{s.t('email_settings.smtp_port', 'SMTP Port')}</label>
                      <p className="text-gray-700">{account.smtpPort}</p>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">{s.t('email_settings.smtp_user', 'Username')}</label>
                      <p className="text-gray-700">{account.smtpUser}</p>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">{s.t('email_settings.security', 'Security')}</label>
                      <p className="text-gray-700">{account.smtpSecure ? 'TLS/SSL' : 'PLAIN'}</p>
                    </div>
                  </div>

                  {/* Last Test Status */}
                  {account.lastTestResult && (
                    <div className="pt-4 border-t space-y-2">
                      <p className="text-sm text-gray-600">
                        {s.t('email_settings.last_test', 'Last Test')}: {account.lastTestResult}
                      </p>
                      {account.lastTestedAt && (
                        <p className="text-xs text-gray-500">
                          {new Date(account.lastTestedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Edit/Test Controls */}
                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestSmtp(account.id)}
                      disabled={testingId === account.id}
                    >
                      {testingId === account.id ? s.t('email_settings.testing', 'Testing...') : s.t('email_settings.test_smtp', 'Test SMTP')}
                    </Button>

                    <Button
                      size="sm"
                      variant={editingId === account.id ? 'default' : 'outline'}
                      onClick={() => setEditingId(editingId === account.id ? null : account.id)}
                    >
                      {editingId === account.id ? s.t('email_settings.cancel', 'Cancel') : s.t('email_settings.update_credential', 'Update Credential')}
                    </Button>
                  </div>

                  {/* Edit Form */}
                  {editingId === account.id && (
                    <div className="mt-4 pt-4 border-t space-y-4 bg-gray-50 p-4 rounded">
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {s.t('email_settings.new_password', 'New Password')} *
                        </label>
                        <Input
                          type="password"
                          placeholder={s.t('email_settings.password_placeholder', 'Enter new password')}
                          value={formData.smtpPass}
                          onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {s.t('email_settings.password_note', 'Password will be encrypted before storage')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {s.t('email_settings.smtp_host_optional', 'SMTP Host (Optional)')}
                          </label>
                          <Input
                            placeholder={account.smtpHost}
                            value={formData.smtpHost || ''}
                            onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {s.t('email_settings.smtp_port_optional', 'SMTP Port (Optional)')}
                          </label>
                          <Input
                            type="number"
                            placeholder={String(account.smtpPort)}
                            value={formData.smtpPort || ''}
                            onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`secure-${account.id}`}
                          checked={formData.smtpSecure}
                          onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`secure-${account.id}`} className="text-sm">
                          {s.t('email_settings.use_tls', 'Use TLS/SSL')}
                        </label>
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => handleUpdateCredential(account.id)}
                        disabled={updatingId === account.id}
                      >
                        {updatingId === account.id ? s.t('email_settings.saving', 'Saving & Testing...') : s.t('email_settings.save_verify', 'Save & Verify')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">{s.t('email_settings.info_title', 'How This Works')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>1. {s.t('email_settings.step_1', 'Update Password in Hostinger')}</strong>
            <br />
            {s.t('email_settings.step_1_desc', 'Change your mailbox password in your Hostinger control panel')}
          </p>
          <p>
            <strong>2. {s.t('email_settings.step_2', 'Click Update Credential')}</strong>
            <br />
            {s.t('email_settings.step_2_desc', 'Enter the new password in this screen and click Save & Verify')}
          </p>
          <p>
            <strong>3. {s.t('email_settings.step_3', 'Automatic Testing')}</strong>
            <br />
            {s.t('email_settings.step_3_desc', 'The system encrypts and tests SMTP/IMAP authentication automatically')}
          </p>
          <p>
            <strong>4. {s.t('email_settings.step_4', 'Connection Activated')}</strong>
            <br />
            {s.t('email_settings.step_4_desc', 'On success, the credential is stored securely and activated for use')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
