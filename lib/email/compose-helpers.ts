/**
 * Email compose helpers for reply/reply-all/forward
 */

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  date: string;
  messageId?: string;
  references?: string[];
  inReplyTo?: string;
}

/**
 * Generate reply composition with quoted body and proper headers
 */
export function composeReply(original: EmailMessage): {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
} {
  const references = [...(original.references || [])];
  if (original.messageId && !references.includes(original.messageId)) {
    references.push(original.messageId);
  }

  return {
    to: original.from,
    subject: original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`,
    body: `\n\nOn ${original.date}, ${original.from} wrote:\n> ${original.body.split('\n').join('\n> ')}`,
    inReplyTo: original.messageId,
    references: references.length > 0 ? references : undefined
  };
}

/**
 * Generate reply-all composition with all recipients
 */
export function composeReplyAll(original: EmailMessage): {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
} {
  const reply = composeReply(original);

  // Add CC recipients from original, excluding own address (would be filled in by sender)
  if (original.cc) {
    reply.cc = original.cc;
  }

  return reply;
}

/**
 * Generate forward composition with original message content
 */
export function composeForward(original: EmailMessage): {
  to?: string;
  subject: string;
  body: string;
  references?: string[];
} {
  const references = [...(original.references || [])];
  if (original.messageId && !references.includes(original.messageId)) {
    references.push(original.messageId);
  }

  return {
    subject: original.subject.startsWith("Fwd:") ? original.subject : `Fwd: ${original.subject}`,
    body: `\n\n---------- Forwarded message ---------\nFrom: ${original.from}\nDate: ${original.date}\nSubject: ${original.subject}\nTo: ${original.to}\n${original.cc ? `Cc: ${original.cc}\n` : ''}\n${original.body}`,
    references: references.length > 0 ? references : undefined
  };
}

/**
 * Extract email addresses from a comma-separated or semicolon-separated string
 */
export function parseEmailAddresses(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.includes('@'));
}

/**
 * Format email addresses for display (strip angle brackets)
 */
export function formatEmailDisplay(email: string): string {
  return email.replace(/<[^>]+>/g, '').trim() || email;
}
