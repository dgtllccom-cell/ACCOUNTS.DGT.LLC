'use client';

import { EmailWorkspace } from './email-workspace';
import type { ErpSession } from '@/lib/auth/session';

export function EmailMessagesView({ session }: { session?: ErpSession | null }) {
  return <EmailWorkspace session={session} />;
}
