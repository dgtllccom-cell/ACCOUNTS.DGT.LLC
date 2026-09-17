import { redirect } from 'next/navigation';
import { getCurrentErpSession } from '@/lib/auth/session';
import { PublicDgtMailAdminView } from '@/features/public-mail/components/public-dgt-mail-admin-view';

export const metadata = {
  title: 'PUBLIC DGT MAIL | Damaan Business Group',
  description: 'Create and manage public DGT email accounts'
};

export default async function PublicDgtMailPage() {
  const session = await getCurrentErpSession();

  if (!session?.isSuperAdmin) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicDgtMailAdminView />
    </div>
  );
}
