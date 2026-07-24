import { execSync } from 'child_process';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const out = execSync('git restore features/purchases/components/purchase-order-management-dashboard.tsx', { cwd: process.cwd() });
    return NextResponse.json({ ok: true, message: 'Restored successfully', out: out.toString() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message, stack: error.stack }, { status: 200 });
  }
}
