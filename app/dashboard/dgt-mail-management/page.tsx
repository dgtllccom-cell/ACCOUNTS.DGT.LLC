import { redirect } from 'next/navigation';
import { getCurrentErpSession } from '@/lib/auth/session';
import { DgtMailManagementView } from '@/features/mail-management/components/dgt-mail-management-view';

export const metadata = {
  title: 'DGT Mail Management | Damaan Business Group',
  description: 'Secure mailbox administration and credential management'
};

export default async function DgtMailManagementPage() {
  const session = await getCurrentErpSession();

  if (!session?.isSuperAdmin) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DgtMailManagementView />
    </div>
  );
}
