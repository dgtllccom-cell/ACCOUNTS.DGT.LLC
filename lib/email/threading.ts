/**
 * Email Threading Engine
 * Groups emails into conversations based on subject, participants, and references
 */

interface ThreadedEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  messageId?: string;
  references?: string[];
  inReplyTo?: string;
}

interface EmailThread {
  threadId: string;
  subject: string;
  participants: Set<string>;
  emails: ThreadedEmail[];
  lastDate: Date;
  messageCount: number;
}

/**
 * Normalize subject for threading (remove Re:, Fwd:, etc.)
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|Fw|RE|FW|Fwd):\s*/gi, '')
    .replace(/^\[.*?\]\s*/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Extract email address from From header
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/([^<>\s]+@[^<>\s]+)/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

/**
 * Group emails into threads
 * PRIMARY Strategy: Link via Message-ID, In-Reply-To, References headers
 * FALLBACK Strategy: Group by normalized subject + participant set (only if headers don't link)
 */
export function threadEmails(emails: ThreadedEmail[]): EmailThread[] {
  const threadMap = new Map<string, EmailThread>();
  const messageIdMap = new Map<string, EmailThread>();

  // Sort by date (oldest first)
  const sortedEmails = [...emails].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const email of sortedEmails) {
    let threadKey: string | null = null;
    let targetThread: EmailThread | null = null;

    // PRIMARY Strategy: Check if email is a reply using Message-ID headers
    if (email.inReplyTo || email.references?.length) {
      // Look for thread containing the referenced message
      if (email.inReplyTo && messageIdMap.has(email.inReplyTo)) {
        targetThread = messageIdMap.get(email.inReplyTo)!;
        threadKey = targetThread.threadId;
      } else if (email.references?.length) {
        for (const refId of email.references) {
          if (messageIdMap.has(refId)) {
            targetThread = messageIdMap.get(refId)!;
            threadKey = targetThread.threadId;
            break;
          }
        }
      }
    }

    // FALLBACK Strategy: Group by normalized subject + participant set (only if headers don't link)
    if (!targetThread) {
      const normalizedSubject = normalizeSubject(email.subject);
      const participants = new Set([
        extractEmailAddress(email.from),
        extractEmailAddress(email.to)
      ]);
      const participantKey = Array.from(participants).sort().join('|');
      threadKey = `${normalizedSubject}|${participantKey}`;

      // Check if thread exists
      if (threadMap.has(threadKey)) {
        targetThread = threadMap.get(threadKey)!;

        // Verify subject match (normalized) to avoid cross-conversation linking
        const existingNormalized = normalizeSubject(targetThread.subject);
        if (existingNormalized !== normalizedSubject) {
          // Create new thread if subject differs
          threadKey = null;
        }
      }
    }

    // Create new thread if needed
    if (!targetThread) {
      const participants = new Set([
        extractEmailAddress(email.from),
        extractEmailAddress(email.to)
      ]);

      threadKey = `thread_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      targetThread = {
        threadId: threadKey,
        subject: email.subject,
        participants,
        emails: [],
        lastDate: email.date,
        messageCount: 0
      };

      threadMap.set(threadKey, targetThread);
    }

    // Add email to thread
    targetThread.emails.push(email);
    targetThread.lastDate = email.date;
    targetThread.messageCount = targetThread.emails.length;

    // Update participants
    targetThread.participants.add(extractEmailAddress(email.from));
    targetThread.participants.add(extractEmailAddress(email.to));

    // Register this email's Message-ID for future reply linkage (primary strategy)
    if (email.messageId) {
      messageIdMap.set(email.messageId, targetThread);
    }
  }

  // Convert to array and sort by lastDate descending
  return Array.from(threadMap.values()).sort(
    (a, b) => b.lastDate.getTime() - a.lastDate.getTime()
  );
}

/**
 * Get the primary subject for a thread
 * Uses the first non-empty subject that doesn't start with Re/Fwd
 */
export function getThreadSubject(thread: EmailThread): string {
  for (const email of thread.emails) {
    const normalized = normalizeSubject(email.subject);
    if (normalized) {
      return normalized;
    }
  }
  return '(no subject)';
}

/**
 * Get thread preview (last email or snippet of last email body)
 */
export function getThreadPreview(thread: EmailThread, maxLength: number = 100): string {
  if (thread.emails.length === 0) return '...';

  const lastEmail = thread.emails[thread.emails.length - 1];
  // Note: Would need email body in the structure to get a proper preview
  // For now, return sender info
  return `${extractEmailAddress(lastEmail.from)}: ${lastEmail.subject.substring(0, maxLength)}...`;
}

/**
 * Check if thread contains unread emails
 */
export function hasUnread(thread: EmailThread, readEmailIds: Set<string>): boolean {
  return thread.emails.some(email => !readEmailIds.has(email.id));
}

/**
 * Get count of unread emails in thread
 */
export function getUnreadCount(thread: EmailThread, readEmailIds: Set<string>): number {
  return thread.emails.filter(email => !readEmailIds.has(email.id)).length;
}
