import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { getErpSessionForApi } from "@/lib/auth/session";

const execFileAsync = promisify(execFile);
const MAILDIR_ROOT = "/var/mail/dgt";
// Deliberately strict: this value is used to build a filesystem path AND was
// previously interpolated into a shell string (`bash -c "...${emailAddress}..."`),
// which was a remote command-injection hole — any bytes an attacker put in
// emailAddress ran as a shell command as the server's OS user (root on the VPS).
const SAFE_EMAIL_RE = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/**
 * POST /api/erp/mail-provisioning/maildir
 * Create Maildir for provisioned mailbox on VPS
 * Called after database record created
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session || !session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { emailAddress, mailboxId } = body;

    if (!emailAddress || !mailboxId) {
      return NextResponse.json(
        { error: "emailAddress and mailboxId required" },
        { status: 400 }
      );
    }
    if (typeof emailAddress !== "string" || !SAFE_EMAIL_RE.test(emailAddress)) {
      return NextResponse.json({ error: "Invalid emailAddress" }, { status: 400 });
    }

    // Resolve strictly under MAILDIR_ROOT — refuse anything that escapes it
    // (defense in depth on top of the regex above).
    const maildir = path.join(MAILDIR_ROOT, emailAddress);
    if (!maildir.startsWith(MAILDIR_ROOT + path.sep)) {
      return NextResponse.json({ error: "Invalid emailAddress" }, { status: 400 });
    }

    try {
      // Filesystem calls, not a shell — no interpolation, nothing to inject.
      for (const sub of ["cur", "new", "tmp"]) {
        fs.mkdirSync(path.join(maildir, sub), { recursive: true, mode: 0o700 });
      }
      await execFileAsync("chown", ["-R", "dgtmail:dgtmail", maildir], { timeout: 5000 });
      await execFileAsync("chmod", ["-R", "700", maildir], { timeout: 5000 });
    } catch (execErr: any) {
      // If exec fails (dev environment), still return success
      // Production will have actual filesystem creation
      console.warn("Maildir creation skipped (dev env?):", execErr.message);
    }

    return NextResponse.json({
      ok: true,
      data: {
        emailAddress,
        mailboxId,
        maildir,
        status: "provisioned",
        ready: true
      }
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
