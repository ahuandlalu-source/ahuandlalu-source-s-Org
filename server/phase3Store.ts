import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  EmailDeliveryRecord,
  Phase3AdminRsvpResponse,
  Phase3AdminWishesResponse,
  Phase3PublicPayload,
  Phase3Settings,
  PublicWishCard,
  RsvpAttendance,
  RsvpCustomField,
  RsvpEntry,
  WeddingWish,
  WishStatus,
} from '../src/types/phase3';
import {
  buildRsvpEmailPayload,
  buildWishEmailPayload,
  getConfiguredEmailFrom,
  isResendConfigured,
  resolveAdminPortalUrl,
  sendViaResend,
} from './email';
import {getSupabaseAdmin, isSupabaseConfigured} from './supabase';
import {
  escapeCsvCell,
  isValidEmail,
  sanitizeText,
  signWishPhotoToken,
  validateAndDecodeWishPhoto,
} from './validation';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PHASE3_STORE_FILE = path.join(DATA_DIR, 'phase3-store.json');
const PRIVATE_WISHES_DIR = path.resolve(DATA_DIR, 'wishes-uploads');
const PRIVATE_WISHES_BUCKET = 'wedding-wishes-private';

export const ALLOWED_WISH_EMOJIS = ['🙏', '💐', '🪔', '❤️', '✨', '🥂', '🎊'];

interface InternalWishRecord extends WeddingWish {
  photoStoragePath: string | null;
  photoMimeType: string | null;
  clientSubmissionKey: string | null;
}

interface InternalRsvpRecord extends RsvpEntry {
  clientSubmissionKey: string | null;
}

interface LocalPhase3Document {
  settings: Phase3Settings;
  rsvps: InternalRsvpRecord[];
  wishes: InternalWishRecord[];
  emailDeliveries: EmailDeliveryRecord[];
}

function defaultPhase3Settings(): Phase3Settings {
  return {
    rsvpEnabled: true,
    rsvpHeadingEn: 'Will You Be Joining Us?',
    rsvpHeadingMl: 'ഞങ്ങളോടൊപ്പം പങ്കുചേരുമോ?',
    rsvpSubtitleEn:
      'Kindly let us know if you will grace our wedding celebration with your presence.',
    rsvpSubtitleMl:
      'വിവാഹ ചടങ്ങിൽ പങ്കെടുക്കുമോ എന്ന് ദയവായി ഞങ്ങളെ അറിയിക്കുക.',
    rsvpAllowAttendeeCount: true,
    rsvpMaxAttendees: 10,
    rsvpCustomFields: [],
    rsvpNotifyEnabled: false,
    rsvpNotifyEmail: '',

    wishesEnabled: true,
    wishesHeadingEn: 'Send Your Wishes',
    wishesHeadingMl: 'ആശംസകൾ നേരുക',
    wishesSubtitleEn:
      'Share your blessings, fond memories, and messages of love for the couple.',
    wishesSubtitleMl:
      'വധൂവരന്മാർക്കായി നിങ്ങളുടെ അനുഗ്രഹങ്ങളും സ്നേഹാശംസകളും പങ്കുവയ്ക്കുക.',
    wishesAutoApprove: false,
    wishesNotifyEnabled: false,
    wishesNotifyEmail: '',
    updatedAt: new Date().toISOString(),
  };
}

function ensureLocalDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  if (!fs.existsSync(PRIVATE_WISHES_DIR)) {
    fs.mkdirSync(PRIVATE_WISHES_DIR, {recursive: true});
  }
}

function readLocalDoc(): LocalPhase3Document {
  ensureLocalDirs();
  if (!fs.existsSync(PHASE3_STORE_FILE)) {
    const initial: LocalPhase3Document = {
      settings: defaultPhase3Settings(),
      rsvps: [],
      wishes: [],
      emailDeliveries: [],
    };
    fs.writeFileSync(PHASE3_STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  const raw = fs.readFileSync(PHASE3_STORE_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<LocalPhase3Document>;
  return {
    settings: {...defaultPhase3Settings(), ...(parsed.settings || {})},
    rsvps: Array.isArray(parsed.rsvps) ? parsed.rsvps : [],
    wishes: Array.isArray(parsed.wishes) ? parsed.wishes : [],
    emailDeliveries: Array.isArray(parsed.emailDeliveries) ? parsed.emailDeliveries : [],
  };
}

function writeLocalDoc(doc: LocalPhase3Document): void {
  ensureLocalDirs();
  fs.writeFileSync(PHASE3_STORE_FILE, JSON.stringify(doc, null, 2), 'utf8');
}

function isMissingPhase3TableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = (err as {code?: string} | null)?.code;
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('Could not find the table') ||
    msg.includes('relation "public.phase3_settings" does not exist') ||
    msg.includes('relation "public.rsvps" does not exist') ||
    msg.includes('relation "public.wedding_wishes" does not exist') ||
    msg.includes('relation "public.email_deliveries" does not exist')
  );
}

const MIGRATION_INSTRUCTIONS =
  'Phase 3 database tables are not created in Supabase yet. Run supabase/migrations/002_phase3_rsvp_wishes.sql in your Supabase SQL Editor.';

function sanitizeCustomFieldsConfig(raw: unknown): RsvpCustomField[] {
  if (!Array.isArray(raw)) return [];
  const result: RsvpCustomField[] = [];
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = sanitizeText(obj.id, 48).replace(/[^a-zA-Z0-9_-]/g, '');
    const labelEn = sanitizeText(obj.labelEn, 80);
    const labelMl = sanitizeText(obj.labelMl, 80) || labelEn;
    if (!id || !labelEn) continue;
    const type =
      obj.type === 'textarea' || obj.type === 'select' || obj.type === 'number'
        ? obj.type
        : 'text';
    const options =
      type === 'select' && Array.isArray(obj.options)
        ? obj.options
            .map((o) => sanitizeText(o, 60))
            .filter(Boolean)
            .slice(0, 12)
        : undefined;
    result.push({
      id,
      labelEn,
      labelMl,
      type,
      required: Boolean(obj.required),
      enabled: obj.enabled !== false,
      options,
      placeholderEn: sanitizeText(obj.placeholderEn, 100) || undefined,
      placeholderMl: sanitizeText(obj.placeholderMl, 100) || undefined,
    });
  }
  return result;
}

function mapSupabaseSettings(row: Record<string, unknown> | null): Phase3Settings {
  const def = defaultPhase3Settings();
  if (!row) return def;
  return {
    rsvpEnabled: row.rsvp_enabled !== false,
    rsvpHeadingEn: sanitizeText(row.rsvp_heading_en, 120) || def.rsvpHeadingEn,
    rsvpHeadingMl: sanitizeText(row.rsvp_heading_ml, 120) || def.rsvpHeadingMl,
    rsvpSubtitleEn: sanitizeText(row.rsvp_subtitle_en, 300) || def.rsvpSubtitleEn,
    rsvpSubtitleMl: sanitizeText(row.rsvp_subtitle_ml, 300) || def.rsvpSubtitleMl,
    rsvpAllowAttendeeCount: row.rsvp_allow_attendee_count !== false,
    rsvpMaxAttendees: Math.min(30, Math.max(1, Number(row.rsvp_max_attendees) || 10)),
    rsvpCustomFields: sanitizeCustomFieldsConfig(row.rsvp_custom_fields),
    rsvpNotifyEnabled: Boolean(row.rsvp_notify_enabled),
    rsvpNotifyEmail: sanitizeText(row.rsvp_notify_email, 160),

    wishesEnabled: row.wishes_enabled !== false,
    wishesHeadingEn: sanitizeText(row.wishes_heading_en, 120) || def.wishesHeadingEn,
    wishesHeadingMl: sanitizeText(row.wishes_heading_ml, 120) || def.wishesHeadingMl,
    wishesSubtitleEn:
      sanitizeText(row.wishes_subtitle_en, 300) || def.wishesSubtitleEn,
    wishesSubtitleMl:
      sanitizeText(row.wishes_subtitle_ml, 300) || def.wishesSubtitleMl,
    wishesAutoApprove: Boolean(row.wishes_auto_approve),
    wishesNotifyEnabled: Boolean(row.wishes_notify_enabled),
    wishesNotifyEmail: sanitizeText(row.wishes_notify_email, 160),
    updatedAt: String(row.updated_at || def.updatedAt),
  };
}

function mapSupabaseRsvp(row: Record<string, unknown>): InternalRsvpRecord {
  const attendance: RsvpAttendance =
    row.attendance === 'not_attending' ? 'not_attending' : 'attending';
  const rawCustom =
    row.custom_fields && typeof row.custom_fields === 'object'
      ? (row.custom_fields as Record<string, unknown>)
      : {};
  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawCustom)) {
    customFields[sanitizeText(k, 80)] = sanitizeText(v, 300);
  }
  return {
    id: String(row.id),
    guestName: String(row.guest_name || ''),
    attendance,
    attendeeCount: Number(row.attendee_count ?? (attendance === 'attending' ? 1 : 0)),
    message: String(row.message || ''),
    customFields,
    adminNote: String(row.admin_note || ''),
    clientSubmissionKey: row.client_submission_key
      ? String(row.client_submission_key)
      : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

function mapSupabaseWish(
  row: Record<string, unknown>,
  forAdmin: boolean
): InternalWishRecord {
  const id = String(row.id);
  const photoPath = row.photo_storage_path ? String(row.photo_storage_path) : null;
  const status: WishStatus =
    row.status === 'approved' || row.status === 'rejected'
      ? row.status
      : 'pending';
  const isPublished = Boolean(row.is_published);
  const hasPhoto = Boolean(photoPath);

  let photoUrl: string | null = null;
  if (hasPhoto) {
    if (forAdmin) {
      photoUrl = `/api/wishes/${encodeURIComponent(id)}/photo?access=${encodeURIComponent(
        signWishPhotoToken(id)
      )}`;
    } else if (status === 'approved' && isPublished) {
      photoUrl = `/api/wishes/${encodeURIComponent(id)}/photo`;
    }
  }

  return {
    id,
    guestName: String(row.guest_name || ''),
    message: String(row.message || ''),
    emoji: String(row.emoji || ''),
    hasPhoto,
    photoUrl,
    status,
    isPublished,
    photoStoragePath: photoPath,
    photoMimeType: row.photo_mime_type ? String(row.photo_mime_type) : null,
    clientSubmissionKey: row.client_submission_key
      ? String(row.client_submission_key)
      : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

function mapSupabaseDelivery(row: Record<string, unknown>): EmailDeliveryRecord {
  const status =
    row.status === 'sent' || row.status === 'skipped' ? row.status : 'failed';
  return {
    id: String(row.id),
    category: row.category === 'wishes' ? 'wishes' : 'rsvp',
    recordId: String(row.record_id),
    recipientEmail: String(row.recipient_email || ''),
    subject: String(row.subject || ''),
    idempotencyKey: String(row.idempotency_key || ''),
    status,
    provider: 'resend',
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    attempts: Number(row.attempts || 1),
    lastAttemptAt: String(row.last_attempt_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

async function getSettingsInternal(): Promise<{
  settings: Phase3Settings;
  migrationRequired: boolean;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {settings: readLocalDoc().settings, migrationRequired: false};
  }

  const {data, error} = await supabase
    .from('phase3_settings')
    .select('*')
    .eq('id', 'primary')
    .maybeSingle();

  if (error) {
    if (isMissingPhase3TableError(error)) {
      return {settings: defaultPhase3Settings(), migrationRequired: true};
    }
    throw new Error(`Failed to load Phase 3 settings: ${error.message}`);
  }

  if (!data) {
    const def = defaultPhase3Settings();
    await supabase.from('phase3_settings').insert({id: 'primary'});
    return {settings: def, migrationRequired: false};
  }

  return {settings: mapSupabaseSettings(data), migrationRequired: false};
}

async function ensurePrivateWishesBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const {data} = await supabase.storage.getBucket(PRIVATE_WISHES_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(PRIVATE_WISHES_BUCKET, {public: false});
  }
}

async function storePrivateWishPhoto(
  wishId: string,
  buffer: Buffer,
  mimeType: string,
  extension: string
): Promise<{storagePath: string; mimeType: string}> {
  const filename = `${wishId}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await ensurePrivateWishesBucket();
    const storagePath = `wishes/${filename}`;
    const {error} = await supabase.storage
      .from(PRIVATE_WISHES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    if (error) {
      throw new Error(`Unable to store wish photo: ${error.message}`);
    }
    return {storagePath, mimeType};
  }

  ensureLocalDirs();
  const fullPath = path.resolve(PRIVATE_WISHES_DIR, filename);
  if (!fullPath.startsWith(PRIVATE_WISHES_DIR + path.sep)) {
    throw new Error('Invalid wish photo storage path.');
  }
  fs.writeFileSync(fullPath, buffer);
  return {storagePath: `local:${filename}`, mimeType};
}

async function deletePrivateWishPhoto(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  if (storagePath.startsWith('local:')) {
    const baseName = path.basename(storagePath.slice('local:'.length));
    const resolved = path.resolve(PRIVATE_WISHES_DIR, baseName);
    if (resolved.startsWith(PRIVATE_WISHES_DIR + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    return;
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.storage.from(PRIVATE_WISHES_BUCKET).remove([storagePath]);
  }
}

function toPublicSettings(settings: Phase3Settings) {
  return {
    rsvpEnabled: settings.rsvpEnabled,
    rsvpHeadingEn: settings.rsvpHeadingEn,
    rsvpHeadingMl: settings.rsvpHeadingMl,
    rsvpSubtitleEn: settings.rsvpSubtitleEn,
    rsvpSubtitleMl: settings.rsvpSubtitleMl,
    rsvpAllowAttendeeCount: settings.rsvpAllowAttendeeCount,
    rsvpMaxAttendees: settings.rsvpMaxAttendees,
    rsvpCustomFields: settings.rsvpCustomFields.filter((f) => f.enabled),
    wishesEnabled: settings.wishesEnabled,
    wishesHeadingEn: settings.wishesHeadingEn,
    wishesHeadingMl: settings.wishesHeadingMl,
    wishesSubtitleEn: settings.wishesSubtitleEn,
    wishesSubtitleMl: settings.wishesSubtitleMl,
  };
}

function toPublicWishCard(wish: InternalWishRecord): PublicWishCard {
  return {
    id: wish.id,
    guestName: wish.guestName,
    message: wish.message,
    emoji: wish.emoji,
    photoUrl: wish.photoUrl,
    createdAt: wish.createdAt,
  };
}

function toAdminWish(wish: InternalWishRecord): WeddingWish {
  return {
    id: wish.id,
    guestName: wish.guestName,
    message: wish.message,
    emoji: wish.emoji,
    hasPhoto: wish.hasPhoto,
    photoUrl: wish.hasPhoto
      ? `/api/wishes/${encodeURIComponent(wish.id)}/photo?access=${encodeURIComponent(
          signWishPhotoToken(wish.id)
        )}`
      : null,
    status: wish.status,
    isPublished: wish.isPublished,
    createdAt: wish.createdAt,
    updatedAt: wish.updatedAt,
  };
}

function toPublicRsvp(rsvp: InternalRsvpRecord): RsvpEntry {
  return {
    id: rsvp.id,
    guestName: rsvp.guestName,
    attendance: rsvp.attendance,
    attendeeCount: rsvp.attendeeCount,
    message: rsvp.message,
    customFields: rsvp.customFields,
    adminNote: rsvp.adminNote,
    createdAt: rsvp.createdAt,
    updatedAt: rsvp.updatedAt,
  };
}

async function recordEmailDelivery(
  entry: Omit<EmailDeliveryRecord, 'id' | 'createdAt'>
): Promise<EmailDeliveryRecord> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const record: EmailDeliveryRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    doc.emailDeliveries.unshift(record);
    doc.emailDeliveries = doc.emailDeliveries.slice(0, 200);
    writeLocalDoc(doc);
    return record;
  }

  const {data, error} = await supabase
    .from('email_deliveries')
    .upsert(
      {
        category: entry.category,
        record_id: entry.recordId,
        recipient_email: entry.recipientEmail,
        subject: entry.subject,
        idempotency_key: entry.idempotencyKey,
        status: entry.status,
        provider: entry.provider,
        provider_message_id: entry.providerMessageId,
        error_message: entry.errorMessage,
        attempts: entry.attempts,
        last_attempt_at: entry.lastAttemptAt,
      },
      {onConflict: 'idempotency_key'}
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to record email delivery status: ${error?.message || 'Unknown error'}`
    );
  }
  return mapSupabaseDelivery(data);
}

// ---------------------------------------------------------------------------
// PUBLIC ENDPOINT HANDLERS
// ---------------------------------------------------------------------------

export async function getPhase3PublicData(): Promise<Phase3PublicPayload> {
  const {settings, migrationRequired} = await getSettingsInternal();
  if (migrationRequired) {
    return {
      settings: toPublicSettings(settings),
      approvedWishes: [],
      migrationRequired: true,
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const approved = doc.wishes
      .filter((w) => w.status === 'approved' && w.isPublished)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((w) => ({
        ...w,
        photoUrl: w.hasPhoto
          ? `/api/wishes/${encodeURIComponent(w.id)}/photo`
          : null,
      }))
      .map(toPublicWishCard);

    return {
      settings: toPublicSettings(doc.settings),
      approvedWishes: approved,
      migrationRequired: false,
    };
  }

  const {data, error} = await supabase
    .from('wedding_wishes')
    .select('*')
    .eq('status', 'approved')
    .eq('is_published', true)
    .order('created_at', {ascending: false})
    .limit(120);

  if (error) {
    if (isMissingPhase3TableError(error)) {
      return {
        settings: toPublicSettings(settings),
        approvedWishes: [],
        migrationRequired: true,
      };
    }
    throw new Error(`Failed to load approved wishes: ${error.message}`);
  }

  const approvedWishes = (data || []).map((row) =>
    toPublicWishCard(mapSupabaseWish(row, false))
  );

  return {
    settings: toPublicSettings(settings),
    approvedWishes,
    migrationRequired: false,
  };
}

export async function submitPublicRsvp(params: {
  guestName: unknown;
  attendance: unknown;
  attendeeCount: unknown;
  message: unknown;
  customFields: unknown;
  clientSubmissionKey: unknown;
  reqOrigin?: string;
}): Promise<{
  entry: RsvpEntry;
  duplicate: boolean;
  emailStatus: 'sent' | 'failed' | 'disabled';
}> {
  const {settings, migrationRequired} = await getSettingsInternal();
  if (migrationRequired) {
    throw new Error(MIGRATION_INSTRUCTIONS);
  }
  if (!settings.rsvpEnabled) {
    throw new Error('RSVP submissions are currently closed.');
  }

  const guestName = sanitizeText(params.guestName, 100);
  if (guestName.length < 2) {
    throw new Error('Please enter your full name (at least 2 characters).');
  }

  const attendance: RsvpAttendance =
    params.attendance === 'attending'
      ? 'attending'
      : params.attendance === 'not_attending'
      ? 'not_attending'
      : (() => {
          throw new Error('Please choose Attending or Unable to attend.');
        })();

  let attendeeCount = attendance === 'attending' ? 1 : 0;
  if (attendance === 'attending' && settings.rsvpAllowAttendeeCount) {
    const parsedCount = Number(params.attendeeCount);
    if (
      !Number.isInteger(parsedCount) ||
      parsedCount < 1 ||
      parsedCount > settings.rsvpMaxAttendees
    ) {
      throw new Error(
        `Number of attendees must be between 1 and ${settings.rsvpMaxAttendees}.`
      );
    }
    attendeeCount = parsedCount;
  }

  const message = sanitizeText(params.message, 600);

  // Validate admin-configured custom fields
  const customInput =
    params.customFields && typeof params.customFields === 'object'
      ? (params.customFields as Record<string, unknown>)
      : {};
  const validatedCustomFields: Record<string, string> = {};
  for (const field of settings.rsvpCustomFields.filter((f) => f.enabled)) {
    const rawVal = sanitizeText(customInput[field.id], 300);
    if (field.required && !rawVal) {
      throw new Error(`${field.labelEn} is required.`);
    }
    if (rawVal) {
      if (field.type === 'select' && field.options?.length) {
        if (!field.options.includes(rawVal)) {
          throw new Error(`Invalid selection for ${field.labelEn}.`);
        }
      }
      validatedCustomFields[field.labelEn] = rawVal;
    }
  }

  const clientSubmissionKey =
    sanitizeText(params.clientSubmissionKey, 100) || null;

  const supabase = getSupabaseAdmin();
  let savedRecord: InternalRsvpRecord;

  if (!supabase) {
    const doc = readLocalDoc();
    if (clientSubmissionKey) {
      const existing = doc.rsvps.find(
        (r) => r.clientSubmissionKey === clientSubmissionKey
      );
      if (existing) {
        return {
          entry: toPublicRsvp(existing),
          duplicate: true,
          emailStatus: settings.rsvpNotifyEnabled ? 'sent' : 'disabled',
        };
      }
    }

    const recentDup = doc.rsvps.find(
      (r) =>
        r.guestName.toLowerCase() === guestName.toLowerCase() &&
        r.attendance === attendance &&
        Date.now() - Date.parse(r.createdAt) < 120_000
    );
    if (recentDup) {
      return {
        entry: toPublicRsvp(recentDup),
        duplicate: true,
        emailStatus: settings.rsvpNotifyEnabled ? 'sent' : 'disabled',
      };
    }

    const now = new Date().toISOString();
    savedRecord = {
      id: crypto.randomUUID(),
      guestName,
      attendance,
      attendeeCount,
      message,
      customFields: validatedCustomFields,
      adminNote: '',
      clientSubmissionKey,
      createdAt: now,
      updatedAt: now,
    };
    doc.rsvps.unshift(savedRecord);
    writeLocalDoc(doc);
  } else {
    if (clientSubmissionKey) {
      const {data: existingRow} = await supabase
        .from('rsvps')
        .select('*')
        .eq('client_submission_key', clientSubmissionKey)
        .maybeSingle();

      if (existingRow) {
        return {
          entry: toPublicRsvp(mapSupabaseRsvp(existingRow)),
          duplicate: true,
          emailStatus: settings.rsvpNotifyEnabled ? 'sent' : 'disabled',
        };
      }
    }

    // Prevent accidental rapid duplicate clicks within 2 minutes by same guest name + status
    const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();
    const {data: recentRows} = await supabase
      .from('rsvps')
      .select('*')
      .ilike('guest_name', guestName)
      .eq('attendance', attendance)
      .gte('created_at', twoMinutesAgo)
      .limit(1);

    if (recentRows && recentRows.length > 0) {
      return {
        entry: toPublicRsvp(mapSupabaseRsvp(recentRows[0])),
        duplicate: true,
        emailStatus: settings.rsvpNotifyEnabled ? 'sent' : 'disabled',
      };
    }

    const {data: inserted, error} = await supabase
      .from('rsvps')
      .insert({
        guest_name: guestName,
        attendance,
        attendee_count: attendeeCount,
        message,
        custom_fields: validatedCustomFields,
        client_submission_key: clientSubmissionKey,
      })
      .select('*')
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to save RSVP: ${error?.message || 'Database error'}`);
    }
    savedRecord = mapSupabaseRsvp(inserted);
  }

  // Send Notification Email (NEVER fail or lose RSVP if email delivery fails!)
  let emailStatus: 'sent' | 'failed' | 'disabled' = 'disabled';
  if (settings.rsvpNotifyEnabled && settings.rsvpNotifyEmail.trim()) {
    const adminUrl = resolveAdminPortalUrl(params.reqOrigin);
    const payload = buildRsvpEmailPayload({
      rsvp: toPublicRsvp(savedRecord),
      allowAttendeeCount: settings.rsvpAllowAttendeeCount,
      adminUrl,
    });
    const idempotencyKey = `rsvp-${savedRecord.id}-v1`;
    const sendRes = await sendViaResend({
      to: settings.rsvpNotifyEmail,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      idempotencyKey,
    });
    emailStatus = sendRes.status === 'sent' ? 'sent' : 'failed';

    await recordEmailDelivery({
      category: 'rsvp',
      recordId: savedRecord.id,
      recipientEmail: settings.rsvpNotifyEmail,
      subject: payload.subject,
      idempotencyKey,
      status: sendRes.status,
      provider: 'resend',
      providerMessageId: sendRes.providerMessageId,
      errorMessage: sendRes.errorMessage,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    }).catch(() => {
      // Do not fail guest RSVP response if delivery audit write fails
    });
  }

  return {
    entry: toPublicRsvp(savedRecord),
    duplicate: false,
    emailStatus,
  };
}

export async function submitPublicWish(params: {
  guestName: unknown;
  message: unknown;
  emoji: unknown;
  photoDataUrl: unknown;
  previewConfirmed: unknown;
  clientSubmissionKey: unknown;
  reqOrigin?: string;
}): Promise<{
  wish: {
    id: string;
    guestName: string;
    message: string;
    emoji: string;
    status: WishStatus;
    isPublished: boolean;
    hasPhoto: boolean;
    photoUrl: string | null;
    createdAt: string;
  };
  duplicate: boolean;
  emailStatus: 'sent' | 'failed' | 'disabled';
}> {
  const {settings, migrationRequired} = await getSettingsInternal();
  if (migrationRequired) {
    throw new Error(MIGRATION_INSTRUCTIONS);
  }
  if (!settings.wishesEnabled) {
    throw new Error('Wedding wishes submissions are currently closed.');
  }

  if (params.previewConfirmed !== true) {
    throw new Error(
      'Please preview your wedding wish card and confirm before sending.'
    );
  }

  const guestName = sanitizeText(params.guestName, 80);
  if (guestName.length < 2) {
    throw new Error('Please enter your name (at least 2 characters).');
  }

  const message = sanitizeText(params.message, 500);
  if (message.length < 3) {
    throw new Error('Please write a wedding wish message (at least 3 characters).');
  }

  const rawEmoji = sanitizeText(params.emoji, 12);
  const emoji = ALLOWED_WISH_EMOJIS.includes(rawEmoji) ? rawEmoji : '';
  const clientSubmissionKey =
    sanitizeText(params.clientSubmissionKey, 100) || null;

  // Check duplicate BEFORE decoding or uploading any photo
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    if (clientSubmissionKey) {
      const existing = doc.wishes.find(
        (w) => w.clientSubmissionKey === clientSubmissionKey
      );
      if (existing) {
        return {
          wish: {
            id: existing.id,
            guestName: existing.guestName,
            message: existing.message,
            emoji: existing.emoji,
            status: existing.status,
            isPublished: existing.isPublished,
            hasPhoto: existing.hasPhoto,
            photoUrl:
              existing.status === 'approved' && existing.isPublished && existing.hasPhoto
                ? `/api/wishes/${encodeURIComponent(existing.id)}/photo`
                : null,
            createdAt: existing.createdAt,
          },
          duplicate: true,
          emailStatus: settings.wishesNotifyEnabled ? 'sent' : 'disabled',
        };
      }
    }
  } else if (clientSubmissionKey) {
    const {data: existingRow} = await supabase
      .from('wedding_wishes')
      .select('*')
      .eq('client_submission_key', clientSubmissionKey)
      .maybeSingle();

    if (existingRow) {
      const mapped = mapSupabaseWish(existingRow, false);
      return {
        wish: {
          id: mapped.id,
          guestName: mapped.guestName,
          message: mapped.message,
          emoji: mapped.emoji,
          status: mapped.status,
          isPublished: mapped.isPublished,
          hasPhoto: mapped.hasPhoto,
          photoUrl: mapped.photoUrl,
          createdAt: mapped.createdAt,
        },
        duplicate: true,
        emailStatus: settings.wishesNotifyEnabled ? 'sent' : 'disabled',
      };
    }
  }

  // Validate optional photo bytes & magic signature strictly
  const wishId = crypto.randomUUID();
  let storedPhoto: {storagePath: string; mimeType: string} | null = null;
  if (typeof params.photoDataUrl === 'string' && params.photoDataUrl.trim()) {
    const decoded = validateAndDecodeWishPhoto(params.photoDataUrl);
    storedPhoto = await storePrivateWishPhoto(
      wishId,
      decoded.buffer,
      decoded.mimeType,
      decoded.extension
    );
  }

  const initialStatus: WishStatus = settings.wishesAutoApprove
    ? 'approved'
    : 'pending';
  const initialPublished = Boolean(settings.wishesAutoApprove);
  const now = new Date().toISOString();

  let savedWish: InternalWishRecord;
  if (!supabase) {
    const doc = readLocalDoc();
    savedWish = {
      id: wishId,
      guestName,
      message,
      emoji,
      hasPhoto: Boolean(storedPhoto),
      photoUrl: null,
      status: initialStatus,
      isPublished: initialPublished,
      photoStoragePath: storedPhoto?.storagePath || null,
      photoMimeType: storedPhoto?.mimeType || null,
      clientSubmissionKey,
      createdAt: now,
      updatedAt: now,
    };
    doc.wishes.unshift(savedWish);
    writeLocalDoc(doc);
  } else {
    const {data: inserted, error} = await supabase
      .from('wedding_wishes')
      .insert({
        id: wishId,
        guest_name: guestName,
        message,
        emoji,
        photo_storage_path: storedPhoto?.storagePath || null,
        photo_mime_type: storedPhoto?.mimeType || null,
        status: initialStatus,
        is_published: initialPublished,
        client_submission_key: clientSubmissionKey,
      })
      .select('*')
      .single();

    if (error || !inserted) {
      if (storedPhoto) {
        await deletePrivateWishPhoto(storedPhoto.storagePath).catch(() => {});
      }
      throw new Error(
        `Failed to save wedding wish: ${error?.message || 'Database error'}`
      );
    }
    savedWish = mapSupabaseWish(inserted, false);
  }

  // Send Notification Email (NEVER fail or lose wish if email delivery fails!)
  let emailStatus: 'sent' | 'failed' | 'disabled' = 'disabled';
  if (settings.wishesNotifyEnabled && settings.wishesNotifyEmail.trim()) {
    const adminUrl = resolveAdminPortalUrl(params.reqOrigin);
    const payload = buildWishEmailPayload({
      wish: savedWish,
      adminUrl,
    });
    const idempotencyKey = `wish-${savedWish.id}-v1`;
    const sendRes = await sendViaResend({
      to: settings.wishesNotifyEmail,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      idempotencyKey,
    });
    emailStatus = sendRes.status === 'sent' ? 'sent' : 'failed';

    await recordEmailDelivery({
      category: 'wishes',
      recordId: savedWish.id,
      recipientEmail: settings.wishesNotifyEmail,
      subject: payload.subject,
      idempotencyKey,
      status: sendRes.status,
      provider: 'resend',
      providerMessageId: sendRes.providerMessageId,
      errorMessage: sendRes.errorMessage,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return {
    wish: {
      id: savedWish.id,
      guestName: savedWish.guestName,
      message: savedWish.message,
      emoji: savedWish.emoji,
      status: savedWish.status,
      isPublished: savedWish.isPublished,
      hasPhoto: savedWish.hasPhoto,
      photoUrl:
        savedWish.status === 'approved' && savedWish.isPublished && savedWish.hasPhoto
          ? `/api/wishes/${encodeURIComponent(savedWish.id)}/photo`
          : null,
      createdAt: savedWish.createdAt,
    },
    duplicate: false,
    emailStatus,
  };
}

export async function getProtectedWishPhoto(
  wishId: string,
  hasAdminAccess: boolean
): Promise<
  | {ok: true; buffer: Buffer; mimeType: string}
  | {ok: false; status: 403 | 404}
> {
  const cleanId = sanitizeText(wishId, 80);
  if (!cleanId) return {ok: false, status: 404};

  let storagePath: string | null = null;
  let mimeType: string = 'image/jpeg';
  let status: WishStatus = 'pending';
  let isPublished = false;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const found = doc.wishes.find((w) => w.id === cleanId);
    if (!found || !found.photoStoragePath) return {ok: false, status: 404};
    storagePath = found.photoStoragePath;
    mimeType = found.photoMimeType || 'image/jpeg';
    status = found.status;
    isPublished = found.isPublished;
  } else {
    const {data, error} = await supabase
      .from('wedding_wishes')
      .select('id, photo_storage_path, photo_mime_type, status, is_published')
      .eq('id', cleanId)
      .maybeSingle();

    if (error || !data || !data.photo_storage_path) {
      return {ok: false, status: 404};
    }
    storagePath = String(data.photo_storage_path);
    mimeType = String(data.photo_mime_type || 'image/jpeg');
    status =
      data.status === 'approved' || data.status === 'rejected'
        ? data.status
        : 'pending';
    isPublished = Boolean(data.is_published);
  }

  // Pending / Rejected / Hidden wish photos MUST require admin authorization
  if ((status !== 'approved' || !isPublished) && !hasAdminAccess) {
    return {ok: false, status: 403};
  }

  if (storagePath.startsWith('local:')) {
    const baseName = path.basename(storagePath.slice('local:'.length));
    const resolved = path.resolve(PRIVATE_WISHES_DIR, baseName);
    if (
      !resolved.startsWith(PRIVATE_WISHES_DIR + path.sep) ||
      !fs.existsSync(resolved)
    ) {
      return {ok: false, status: 404};
    }
    return {ok: true, buffer: fs.readFileSync(resolved), mimeType};
  }

  if (!supabase) return {ok: false, status: 404};
  const {data: blobData, error: dlErr} = await supabase.storage
    .from(PRIVATE_WISHES_BUCKET)
    .download(storagePath);

  if (dlErr || !blobData) {
    return {ok: false, status: 404};
  }
  const arrayBuf = await blobData.arrayBuffer();
  return {
    ok: true,
    buffer: Buffer.from(arrayBuf),
    mimeType,
  };
}

// ---------------------------------------------------------------------------
// ADMIN ENDPOINT HANDLERS (Strictly protected by requireAdminAuth)
// ---------------------------------------------------------------------------

export async function getAdminRsvpDashboard(): Promise<Phase3AdminRsvpResponse> {
  const {settings, migrationRequired} = await getSettingsInternal();
  const emailConfigured = isResendConfigured();
  const emailFrom = getConfiguredEmailFrom();

  if (migrationRequired) {
    return {
      items: [],
      metrics: {total: 0, attending: 0, notAttending: 0, totalConfirmedAttendees: 0},
      settings,
      deliveries: [],
      emailConfigured,
      emailFrom,
      migrationRequired: true,
      migrationMessage: MIGRATION_INSTRUCTIONS,
    };
  }

  const supabase = getSupabaseAdmin();
  let items: RsvpEntry[] = [];
  let deliveries: EmailDeliveryRecord[] = [];

  if (!supabase) {
    const doc = readLocalDoc();
    items = [...doc.rsvps]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toPublicRsvp);
    deliveries = doc.emailDeliveries.filter((d) => d.category === 'rsvp');
  } else {
    const [rsvpRes, delivRes] = await Promise.all([
      supabase.from('rsvps').select('*').order('created_at', {ascending: false}),
      supabase
        .from('email_deliveries')
        .select('*')
        .eq('category', 'rsvp')
        .order('created_at', {ascending: false})
        .limit(50),
    ]);
    if (rsvpRes.error) {
      throw new Error(`Failed to load RSVPs: ${rsvpRes.error.message}`);
    }
    if (delivRes.error) {
      throw new Error(`Failed to load email logs: ${delivRes.error.message}`);
    }
    items = (rsvpRes.data || []).map((r) => toPublicRsvp(mapSupabaseRsvp(r)));
    deliveries = (delivRes.data || []).map(mapSupabaseDelivery);
  }

  const attendingItems = items.filter((i) => i.attendance === 'attending');
  const notAttendingItems = items.filter((i) => i.attendance === 'not_attending');
  const totalConfirmedAttendees = attendingItems.reduce(
    (sum, item) => sum + Math.max(0, item.attendeeCount),
    0
  );

  return {
    items,
    metrics: {
      total: items.length,
      attending: attendingItems.length,
      notAttending: notAttendingItems.length,
      totalConfirmedAttendees,
    },
    settings,
    deliveries,
    emailConfigured,
    emailFrom,
    migrationRequired: false,
  };
}

export async function updateAdminRsvp(
  rsvpId: string,
  patch: {
    guestName?: unknown;
    attendance?: unknown;
    attendeeCount?: unknown;
    message?: unknown;
    adminNote?: unknown;
    customFields?: unknown;
  }
): Promise<RsvpEntry> {
  const {migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);

  const cleanId = sanitizeText(rsvpId, 80);
  const guestName = sanitizeText(patch.guestName, 100);
  if (guestName.length < 2) {
    throw new Error('Guest name must be at least 2 characters.');
  }
  const attendance: RsvpAttendance =
    patch.attendance === 'not_attending' ? 'not_attending' : 'attending';
  const rawCount = Number(patch.attendeeCount);
  const attendeeCount =
    attendance === 'not_attending'
      ? 0
      : Math.min(30, Math.max(1, Number.isFinite(rawCount) ? Math.round(rawCount) : 1));
  const message = sanitizeText(patch.message, 600);
  const adminNote = sanitizeText(patch.adminNote, 400);

  const customFields: Record<string, string> = {};
  if (patch.customFields && typeof patch.customFields === 'object') {
    for (const [k, v] of Object.entries(
      patch.customFields as Record<string, unknown>
    )) {
      const cleanK = sanitizeText(k, 80);
      const cleanV = sanitizeText(v, 300);
      if (cleanK && cleanV) customFields[cleanK] = cleanV;
    }
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const doc = readLocalDoc();
    const idx = doc.rsvps.findIndex((r) => r.id === cleanId);
    if (idx === -1) throw new Error('RSVP entry not found.');
    doc.rsvps[idx] = {
      ...doc.rsvps[idx],
      guestName,
      attendance,
      attendeeCount,
      message,
      adminNote,
      customFields:
        Object.keys(customFields).length > 0
          ? customFields
          : doc.rsvps[idx].customFields,
      updatedAt: now,
    };
    writeLocalDoc(doc);
    return toPublicRsvp(doc.rsvps[idx]);
  }

  const updatePayload: Record<string, unknown> = {
    guest_name: guestName,
    attendance,
    attendee_count: attendeeCount,
    message,
    admin_note: adminNote,
    updated_at: now,
  };
  if (patch.customFields && typeof patch.customFields === 'object') {
    updatePayload.custom_fields = customFields;
  }

  const {data, error} = await supabase
    .from('rsvps')
    .update(updatePayload)
    .eq('id', cleanId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Failed to update RSVP: ${error.message}`);
  if (!data) throw new Error('RSVP entry not found.');
  return toPublicRsvp(mapSupabaseRsvp(data));
}

export async function deleteAdminRsvp(rsvpId: string): Promise<void> {
  const {migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);
  const cleanId = sanitizeText(rsvpId, 80);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    doc.rsvps = doc.rsvps.filter((r) => r.id !== cleanId);
    writeLocalDoc(doc);
    return;
  }

  const {error} = await supabase.from('rsvps').delete().eq('id', cleanId);
  if (error) throw new Error(`Failed to delete RSVP: ${error.message}`);
}

export async function generateRsvpCsv(): Promise<string> {
  const {items, settings} = await getAdminRsvpDashboard();
  const customLabels = Array.from(
    new Set([
      ...settings.rsvpCustomFields.map((f) => f.labelEn),
      ...items.flatMap((i) => Object.keys(i.customFields || {})),
    ])
  );

  const headers = [
    'ID',
    'Guest Name',
    'Attendance',
    'Attendee Count',
    'Message',
    ...customLabels,
    'Admin Note',
    'Submitted At',
  ];

  const rows = items.map((item) => [
    escapeCsvCell(item.id),
    escapeCsvCell(item.guestName),
    escapeCsvCell(
      item.attendance === 'attending' ? 'Attending' : 'Unable to attend'
    ),
    escapeCsvCell(item.attendeeCount),
    escapeCsvCell(item.message),
    ...customLabels.map((lbl) => escapeCsvCell(item.customFields?.[lbl] || '')),
    escapeCsvCell(item.adminNote),
    escapeCsvCell(item.createdAt),
  ]);

  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join(
    '\n'
  );
}

export async function getAdminWishesDashboard(): Promise<Phase3AdminWishesResponse> {
  const {settings, migrationRequired} = await getSettingsInternal();
  const emailConfigured = isResendConfigured();
  const emailFrom = getConfiguredEmailFrom();

  if (migrationRequired) {
    return {
      items: [],
      counts: {total: 0, pending: 0, approved: 0, rejected: 0, published: 0},
      settings,
      deliveries: [],
      emailConfigured,
      emailFrom,
      migrationRequired: true,
      migrationMessage: MIGRATION_INSTRUCTIONS,
    };
  }

  const supabase = getSupabaseAdmin();
  let items: WeddingWish[] = [];
  let deliveries: EmailDeliveryRecord[] = [];

  if (!supabase) {
    const doc = readLocalDoc();
    items = [...doc.wishes]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toAdminWish);
    deliveries = doc.emailDeliveries.filter((d) => d.category === 'wishes');
  } else {
    const [wishRes, delivRes] = await Promise.all([
      supabase
        .from('wedding_wishes')
        .select('*')
        .order('created_at', {ascending: false}),
      supabase
        .from('email_deliveries')
        .select('*')
        .eq('category', 'wishes')
        .order('created_at', {ascending: false})
        .limit(50),
    ]);
    if (wishRes.error) {
      throw new Error(`Failed to load wedding wishes: ${wishRes.error.message}`);
    }
    if (delivRes.error) {
      throw new Error(`Failed to load email logs: ${delivRes.error.message}`);
    }
    items = (wishRes.data || []).map((row) => toAdminWish(mapSupabaseWish(row, true)));
    deliveries = (delivRes.data || []).map(mapSupabaseDelivery);
  }

  return {
    items,
    counts: {
      total: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
      published: items.filter((i) => i.status === 'approved' && i.isPublished).length,
    },
    settings,
    deliveries,
    emailConfigured,
    emailFrom,
    migrationRequired: false,
  };
}

export async function updateAdminWish(
  wishId: string,
  patch: {
    guestName?: unknown;
    message?: unknown;
    emoji?: unknown;
    status?: unknown;
    isPublished?: unknown;
  }
): Promise<WeddingWish> {
  const {migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);
  const cleanId = sanitizeText(wishId, 80);
  const now = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const idx = doc.wishes.findIndex((w) => w.id === cleanId);
    if (idx === -1) throw new Error('Wedding wish not found.');
    const cur = doc.wishes[idx];

    const nextStatus: WishStatus =
      patch.status === 'approved' ||
      patch.status === 'rejected' ||
      patch.status === 'pending'
        ? patch.status
        : cur.status;
    let nextPublished =
      typeof patch.isPublished === 'boolean' ? patch.isPublished : cur.isPublished;
    if (nextStatus !== 'approved') {
      nextPublished = false;
    }

    const nextName =
      patch.guestName !== undefined
        ? sanitizeText(patch.guestName, 80) || cur.guestName
        : cur.guestName;
    const nextMessage =
      patch.message !== undefined
        ? sanitizeText(patch.message, 500) || cur.message
        : cur.message;
    const nextEmoji =
      patch.emoji !== undefined
        ? ALLOWED_WISH_EMOJIS.includes(sanitizeText(patch.emoji, 12))
          ? sanitizeText(patch.emoji, 12)
          : ''
        : cur.emoji;

    doc.wishes[idx] = {
      ...cur,
      guestName: nextName,
      message: nextMessage,
      emoji: nextEmoji,
      status: nextStatus,
      isPublished: nextPublished,
      updatedAt: now,
    };
    writeLocalDoc(doc);
    return toAdminWish(doc.wishes[idx]);
  }

  const {data: existing, error: readErr} = await supabase
    .from('wedding_wishes')
    .select('*')
    .eq('id', cleanId)
    .maybeSingle();

  if (readErr) throw new Error(`Failed to fetch wish: ${readErr.message}`);
  if (!existing) throw new Error('Wedding wish not found.');

  const cur = mapSupabaseWish(existing, true);
  const nextStatus: WishStatus =
    patch.status === 'approved' ||
    patch.status === 'rejected' ||
    patch.status === 'pending'
      ? patch.status
      : cur.status;
  let nextPublished =
    typeof patch.isPublished === 'boolean' ? patch.isPublished : cur.isPublished;
  if (nextStatus !== 'approved') {
    nextPublished = false;
  }

  const nextName =
    patch.guestName !== undefined
      ? sanitizeText(patch.guestName, 80) || cur.guestName
      : cur.guestName;
  const nextMessage =
    patch.message !== undefined
      ? sanitizeText(patch.message, 500) || cur.message
      : cur.message;
  const nextEmoji =
    patch.emoji !== undefined
      ? ALLOWED_WISH_EMOJIS.includes(sanitizeText(patch.emoji, 12))
        ? sanitizeText(patch.emoji, 12)
        : ''
      : cur.emoji;

  const {data: updated, error: updErr} = await supabase
    .from('wedding_wishes')
    .update({
      guest_name: nextName,
      message: nextMessage,
      emoji: nextEmoji,
      status: nextStatus,
      is_published: nextPublished,
      updated_at: now,
    })
    .eq('id', cleanId)
    .select('*')
    .single();

  if (updErr || !updated) {
    throw new Error(`Failed to update wish: ${updErr?.message || 'Database error'}`);
  }
  return toAdminWish(mapSupabaseWish(updated, true));
}

export async function deleteAdminWish(wishId: string): Promise<void> {
  const {migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);
  const cleanId = sanitizeText(wishId, 80);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const target = doc.wishes.find((w) => w.id === cleanId);
    if (target?.photoStoragePath) {
      await deletePrivateWishPhoto(target.photoStoragePath);
    }
    doc.wishes = doc.wishes.filter((w) => w.id !== cleanId);
    writeLocalDoc(doc);
    return;
  }

  const {data: target} = await supabase
    .from('wedding_wishes')
    .select('photo_storage_path')
    .eq('id', cleanId)
    .maybeSingle();

  const {error} = await supabase.from('wedding_wishes').delete().eq('id', cleanId);
  if (error) throw new Error(`Failed to delete wish: ${error.message}`);

  if (target?.photo_storage_path) {
    await deletePrivateWishPhoto(String(target.photo_storage_path)).catch(() => {});
  }
}

export async function updateAdminPhase3Settings(
  patch: Partial<Phase3Settings>
): Promise<Phase3Settings> {
  const {settings: current, migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);

  const next: Phase3Settings = {
    ...current,
    rsvpEnabled:
      typeof patch.rsvpEnabled === 'boolean' ? patch.rsvpEnabled : current.rsvpEnabled,
    rsvpHeadingEn:
      patch.rsvpHeadingEn !== undefined
        ? sanitizeText(patch.rsvpHeadingEn, 120) || current.rsvpHeadingEn
        : current.rsvpHeadingEn,
    rsvpHeadingMl:
      patch.rsvpHeadingMl !== undefined
        ? sanitizeText(patch.rsvpHeadingMl, 120) || current.rsvpHeadingMl
        : current.rsvpHeadingMl,
    rsvpSubtitleEn:
      patch.rsvpSubtitleEn !== undefined
        ? sanitizeText(patch.rsvpSubtitleEn, 300)
        : current.rsvpSubtitleEn,
    rsvpSubtitleMl:
      patch.rsvpSubtitleMl !== undefined
        ? sanitizeText(patch.rsvpSubtitleMl, 300)
        : current.rsvpSubtitleMl,
    rsvpAllowAttendeeCount:
      typeof patch.rsvpAllowAttendeeCount === 'boolean'
        ? patch.rsvpAllowAttendeeCount
        : current.rsvpAllowAttendeeCount,
    rsvpMaxAttendees:
      patch.rsvpMaxAttendees !== undefined
        ? Math.min(30, Math.max(1, Number(patch.rsvpMaxAttendees) || 10))
        : current.rsvpMaxAttendees,
    rsvpCustomFields:
      patch.rsvpCustomFields !== undefined
        ? sanitizeCustomFieldsConfig(patch.rsvpCustomFields)
        : current.rsvpCustomFields,
    rsvpNotifyEnabled:
      typeof patch.rsvpNotifyEnabled === 'boolean'
        ? patch.rsvpNotifyEnabled
        : current.rsvpNotifyEnabled,
    rsvpNotifyEmail:
      patch.rsvpNotifyEmail !== undefined
        ? sanitizeText(patch.rsvpNotifyEmail, 160)
        : current.rsvpNotifyEmail,

    wishesEnabled:
      typeof patch.wishesEnabled === 'boolean'
        ? patch.wishesEnabled
        : current.wishesEnabled,
    wishesHeadingEn:
      patch.wishesHeadingEn !== undefined
        ? sanitizeText(patch.wishesHeadingEn, 120) || current.wishesHeadingEn
        : current.wishesHeadingEn,
    wishesHeadingMl:
      patch.wishesHeadingMl !== undefined
        ? sanitizeText(patch.wishesHeadingMl, 120) || current.wishesHeadingMl
        : current.wishesHeadingMl,
    wishesSubtitleEn:
      patch.wishesSubtitleEn !== undefined
        ? sanitizeText(patch.wishesSubtitleEn, 300)
        : current.wishesSubtitleEn,
    wishesSubtitleMl:
      patch.wishesSubtitleMl !== undefined
        ? sanitizeText(patch.wishesSubtitleMl, 300)
        : current.wishesSubtitleMl,
    wishesAutoApprove:
      typeof patch.wishesAutoApprove === 'boolean'
        ? patch.wishesAutoApprove
        : current.wishesAutoApprove,
    wishesNotifyEnabled:
      typeof patch.wishesNotifyEnabled === 'boolean'
        ? patch.wishesNotifyEnabled
        : current.wishesNotifyEnabled,
    wishesNotifyEmail:
      patch.wishesNotifyEmail !== undefined
        ? sanitizeText(patch.wishesNotifyEmail, 160)
        : current.wishesNotifyEmail,
    updatedAt: new Date().toISOString(),
  };

  // Validate recipient emails whenever notifications are enabled OR non-empty email is supplied
  if (next.rsvpNotifyEnabled && !isValidEmail(next.rsvpNotifyEmail)) {
    throw new Error('Please enter a valid RSVP notification recipient email address.');
  }
  if (next.rsvpNotifyEmail && !isValidEmail(next.rsvpNotifyEmail)) {
    throw new Error('RSVP notification email format is invalid.');
  }
  if (next.wishesNotifyEnabled && !isValidEmail(next.wishesNotifyEmail)) {
    throw new Error(
      'Please enter a valid Wedding Wishes notification recipient email address.'
    );
  }
  if (next.wishesNotifyEmail && !isValidEmail(next.wishesNotifyEmail)) {
    throw new Error('Wedding Wishes notification email format is invalid.');
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    doc.settings = next;
    writeLocalDoc(doc);
    return next;
  }

  const {data, error} = await supabase
    .from('phase3_settings')
    .upsert(
      {
        id: 'primary',
        rsvp_enabled: next.rsvpEnabled,
        rsvp_heading_en: next.rsvpHeadingEn,
        rsvp_heading_ml: next.rsvpHeadingMl,
        rsvp_subtitle_en: next.rsvpSubtitleEn,
        rsvp_subtitle_ml: next.rsvpSubtitleMl,
        rsvp_allow_attendee_count: next.rsvpAllowAttendeeCount,
        rsvp_max_attendees: next.rsvpMaxAttendees,
        rsvp_custom_fields: next.rsvpCustomFields,
        rsvp_notify_enabled: next.rsvpNotifyEnabled,
        rsvp_notify_email: next.rsvpNotifyEmail,
        wishes_enabled: next.wishesEnabled,
        wishes_heading_en: next.wishesHeadingEn,
        wishes_heading_ml: next.wishesHeadingMl,
        wishes_subtitle_en: next.wishesSubtitleEn,
        wishes_subtitle_ml: next.wishesSubtitleMl,
        wishes_auto_approve: next.wishesAutoApprove,
        wishes_notify_enabled: next.wishesNotifyEnabled,
        wishes_notify_email: next.wishesNotifyEmail,
        updated_at: next.updatedAt,
      },
      {onConflict: 'id'}
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save Phase 3 settings: ${error?.message || 'Database error'}`
    );
  }
  return mapSupabaseSettings(data);
}

export async function retryEmailDelivery(
  deliveryId: string,
  reqOrigin?: string
): Promise<EmailDeliveryRecord> {
  const {settings, migrationRequired} = await getSettingsInternal();
  if (migrationRequired) throw new Error(MIGRATION_INSTRUCTIONS);
  const cleanId = sanitizeText(deliveryId, 80);

  const supabase = getSupabaseAdmin();
  let delivery: EmailDeliveryRecord | null = null;

  if (!supabase) {
    const doc = readLocalDoc();
    delivery = doc.emailDeliveries.find((d) => d.id === cleanId) || null;
  } else {
    const {data, error} = await supabase
      .from('email_deliveries')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load delivery record: ${error.message}`);
    delivery = data ? mapSupabaseDelivery(data) : null;
  }

  if (!delivery) {
    throw new Error('Email delivery record not found.');
  }
  // Idempotency guard: already delivered successfully
  if (delivery.status === 'sent') {
    return delivery;
  }

  const adminUrl = resolveAdminPortalUrl(reqOrigin);
  let targetEmail = delivery.recipientEmail;
  let payload: {subject: string; html: string; text: string};

  if (delivery.category === 'rsvp') {
    if (isValidEmail(settings.rsvpNotifyEmail)) {
      targetEmail = settings.rsvpNotifyEmail;
    }
    let rsvp: RsvpEntry | null = null;
    if (!supabase) {
      const found = readLocalDoc().rsvps.find((r) => r.id === delivery!.recordId);
      rsvp = found ? toPublicRsvp(found) : null;
    } else {
      const {data} = await supabase
        .from('rsvps')
        .select('*')
        .eq('id', delivery.recordId)
        .maybeSingle();
      rsvp = data ? toPublicRsvp(mapSupabaseRsvp(data)) : null;
    }
    if (!rsvp) throw new Error('Associated RSVP entry no longer exists.');
    payload = buildRsvpEmailPayload({
      rsvp,
      allowAttendeeCount: settings.rsvpAllowAttendeeCount,
      adminUrl,
    });
  } else {
    if (isValidEmail(settings.wishesNotifyEmail)) {
      targetEmail = settings.wishesNotifyEmail;
    }
    let wish: WeddingWish | null = null;
    if (!supabase) {
      const found = readLocalDoc().wishes.find((w) => w.id === delivery!.recordId);
      wish = found ? toAdminWish(found) : null;
    } else {
      const {data} = await supabase
        .from('wedding_wishes')
        .select('*')
        .eq('id', delivery.recordId)
        .maybeSingle();
      wish = data ? toAdminWish(mapSupabaseWish(data, true)) : null;
    }
    if (!wish) throw new Error('Associated Wedding Wish no longer exists.');
    payload = buildWishEmailPayload({wish, adminUrl});
  }

  const nextAttempts = delivery.attempts + 1;
  const retryKey = `retry-${delivery.id}-attempt-${nextAttempts}`;
  const sendRes = await sendViaResend({
    to: targetEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    idempotencyKey: retryKey,
  });

  const now = new Date().toISOString();

  if (!supabase) {
    const doc = readLocalDoc();
    const idx = doc.emailDeliveries.findIndex((d) => d.id === cleanId);
    if (idx === -1) throw new Error('Email delivery record not found.');
    doc.emailDeliveries[idx] = {
      ...doc.emailDeliveries[idx],
      recipientEmail: targetEmail,
      status: sendRes.status,
      providerMessageId: sendRes.providerMessageId,
      errorMessage: sendRes.errorMessage,
      attempts: nextAttempts,
      lastAttemptAt: now,
    };
    writeLocalDoc(doc);
    return doc.emailDeliveries[idx];
  }

  const {data: updated, error: updErr} = await supabase
    .from('email_deliveries')
    .update({
      recipient_email: targetEmail,
      status: sendRes.status,
      provider_message_id: sendRes.providerMessageId,
      error_message: sendRes.errorMessage,
      attempts: nextAttempts,
      last_attempt_at: now,
    })
    .eq('id', cleanId)
    .select('*')
    .single();

  if (updErr || !updated) {
    throw new Error(
      `Failed to update email delivery record: ${updErr?.message || 'Database error'}`
    );
  }
  return mapSupabaseDelivery(updated);
}
