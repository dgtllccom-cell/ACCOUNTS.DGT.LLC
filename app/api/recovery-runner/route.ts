import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';

export async function GET() {
  const tempFiles = [
    path.join(workspaceDir, 'app', 'api', 'recovery-audit', 'route.ts'),
    path.join(workspaceDir, 'app', 'api', 'recovery-diff-checker', 'route.ts'),
    path.join(workspaceDir, 'scripts', 'find-zips.mjs'),
    path.join(workspaceDir, 'scripts', 'recovery-audit-engine.mjs')
  ];

  const cleaned: string[] = [];
  tempFiles.forEach(f => {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      cleaned.push(f);
    }
  });

  return NextResponse.json({ success: true, message: 'Temporary audit scripts cleaned up successfully', cleaned });
}
