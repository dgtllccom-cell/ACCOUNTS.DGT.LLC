import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import path from 'path';

const execAsync = promisify(exec);

export async function GET() {
  const cwd = path.join(process.cwd());
  try {
    const { stdout, stderr } = await execAsync(
      'git checkout HEAD -- features/journal/components/purchase-order-payment-journal.tsx',
      { cwd }
    );
    return NextResponse.json({ success: true, stdout, stderr });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message, 
      stderr: error.stderr,
      stdout: error.stdout
    }, { status: 500 });
  }
}
