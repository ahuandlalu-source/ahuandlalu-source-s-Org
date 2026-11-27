import type {RsvpEntry, WeddingWish} from '../src/types/phase3';
import {escapeHtml, isValidEmail} from './validation';

export interface EmailSendResult {
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId: string | null;
  errorMessage: string | null;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
}

export function getConfiguredEmailFrom(): string | null {
  const from = (process.env.EMAIL_FROM || '').trim();
  if (from) return from;
  return isResendConfigured() ? 'Wedding Invitation <onboarding@resend.dev>' : null;
}

export function resolveAdminPortalUrl(reqOrigin?: string): string {
  const base =
    (process.env.APP_URL || '').trim().replace(/\/$/, '') ||
    (reqOrigin || '').trim().replace(/\/$/, '') ||
    'http://localhost:3000';
  return `${base}/admin`;
}

export async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailSendResult> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    return {
      status: 'failed',
      providerMessageId: null,
      errorMessage:
        'RESEND_API_KEY is not configured in server environment variables. Notification could not be sent.',
    };
  }

  const recipient = params.to.trim();
  if (!isValidEmail(recipient)) {
    return {
      status: 'failed',
      providerMessageId: null,
      errorMessage: 'Notification recipient email address is missing or invalid.',
    };
  }

  const from =
    (process.env.EMAIL_FROM || '').trim() ||
    'Wedding Invitation <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string | {message?: string};
    };

    if (!response.ok || !data.id) {
      const errorDetail =
        data.message ||
        (typeof data.error === 'string' ? data.error : data.error?.message) ||
        `Resend API returned HTTP ${response.status}`;
      return {
        status: 'failed',
        providerMessageId: null,
        errorMessage: errorDetail,
      };
    }

    return {
      status: 'sent',
      providerMessageId: data.id,
      errorMessage: null,
    };
  } catch (err) {
    return {
      status: 'failed',
      providerMessageId: null,
      errorMessage:
        err instanceof Error ? err.message : 'Network error connecting to Resend API.',
    };
  }
}

export function buildRsvpEmailPayload(params: {
  rsvp: RsvpEntry;
  allowAttendeeCount: boolean;
  adminUrl: string;
}): {subject: string; html: string; text: string} {
  const {rsvp, allowAttendeeCount, adminUrl} = params;
  const subject = 'New Wedding RSVP Received';
  const attendanceLabel =
    rsvp.attendance === 'attending' ? 'Attending' : 'Unable to attend';
  const submittedAt = new Date(rsvp.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const customFieldRows = Object.entries(rsvp.customFields || {})
    .filter(([, val]) => String(val).trim() !== '')
    .map(
      ([label, val]) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(String(val))}</td></tr>`
    )
    .join('');

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#faf7f0;border:1px solid #e2ddd3;border-radius:12px;color:#2c221e;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9a742e;">Wedding RSVP Notification</p>
    <h2 style="margin:0 0 18px;font-size:22px;font-weight:600;color:#2c221e;">New Wedding RSVP Received</h2>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e7e2d9;border-radius:8px;padding:16px;">
      <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;width:40%;">Guest Name</td><td style="padding:8px 14px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(rsvp.guestName)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;">Attendance</td><td style="padding:8px 14px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(attendanceLabel)}</td></tr>
      ${
        allowAttendeeCount && rsvp.attendance === 'attending'
          ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:13px;">Number of Attendees</td><td style="padding:8px 14px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(String(rsvp.attendeeCount))}</td></tr>`
          : ''
      }
      ${
        rsvp.message
          ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:13px;vertical-align:top;">Message</td><td style="padding:8px 14px;color:#0f172a;font-size:13px;line-height:1.5;">${escapeHtml(rsvp.message)}</td></tr>`
          : ''
      }
      ${customFieldRows}
      <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;">Submitted At</td><td style="padding:8px 14px;color:#0f172a;font-size:13px;">${escapeHtml(submittedAt)}</td></tr>
    </table>
    <div style="margin-top:20px;">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:10px 18px;background:#2c221e;color:#faf7f0;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Open Admin RSVP Management</a>
    </div>
  </div>`;

  const text = [
    'New Wedding RSVP Received',
    `Guest Name: ${rsvp.guestName}`,
    `Attendance: ${attendanceLabel}`,
    allowAttendeeCount && rsvp.attendance === 'attending'
      ? `Number of Attendees: ${rsvp.attendeeCount}`
      : null,
    rsvp.message ? `Message: ${rsvp.message}` : null,
    `Submitted At: ${submittedAt}`,
    `Admin Portal: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {subject, html, text};
}

export function buildWishEmailPayload(params: {
  wish: WeddingWish;
  adminUrl: string;
}): {subject: string; html: string; text: string} {
  const {wish, adminUrl} = params;
  const subject = 'New Wedding Wish Received';
  const submittedAt = new Date(wish.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const statusLabel =
    wish.status === 'approved' && wish.isPublished
      ? 'Approved & Published'
      : 'Pending Moderation';

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#faf7f0;border:1px solid #e2ddd3;border-radius:12px;color:#2c221e;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9a742e;">Wedding Wishes Notification</p>
    <h2 style="margin:0 0 18px;font-size:22px;font-weight:600;color:#2c221e;">New Wedding Wish Received</h2>
    <div style="background:#ffffff;border:1px solid #e7e2d9;border-radius:8px;padding:16px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a;">From: ${escapeHtml(wish.guestName)} ${wish.emoji ? escapeHtml(wish.emoji) : ''}</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2c221e;">${escapeHtml(wish.message)}</p>
      <p style="margin:0;font-size:12px;color:#64748b;">Photo attached: ${wish.hasPhoto ? 'Yes' : 'No'} &middot; Status: ${escapeHtml(statusLabel)} &middot; Submitted: ${escapeHtml(submittedAt)}</p>
    </div>
    <div style="margin-top:20px;">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:10px 18px;background:#2c221e;color:#faf7f0;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Review in Admin Wishes Management</a>
    </div>
  </div>`;

  const text = [
    'New Wedding Wish Received',
    `From: ${wish.guestName}`,
    `Message: ${wish.message}`,
    `Photo attached: ${wish.hasPhoto ? 'Yes' : 'No'}`,
    `Status: ${statusLabel}`,
    `Submitted At: ${submittedAt}`,
    `Admin Portal: ${adminUrl}`,
  ].join('\n');

  return {subject, html, text};
}
