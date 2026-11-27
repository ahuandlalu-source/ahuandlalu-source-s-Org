export type RsvpAttendance = 'attending' | 'not_attending';

export type RsvpCustomFieldType = 'text' | 'textarea' | 'select' | 'number';

export interface RsvpCustomField {
  id: string;
  labelEn: string;
  labelMl: string;
  type: RsvpCustomFieldType;
  required: boolean;
  enabled: boolean;
  options?: string[];
  placeholderEn?: string;
  placeholderMl?: string;
}

export interface RsvpEntry {
  id: string;
  guestName: string;
  attendance: RsvpAttendance;
  attendeeCount: number;
  message: string;
  customFields: Record<string, string>;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export type WishStatus = 'pending' | 'approved' | 'rejected';

export interface WeddingWish {
  id: string;
  guestName: string;
  message: string;
  emoji: string;
  hasPhoto: boolean;
  photoUrl: string | null;
  status: WishStatus;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicWishCard {
  id: string;
  guestName: string;
  message: string;
  emoji: string;
  photoUrl: string | null;
  createdAt: string;
}

export interface EmailDeliveryRecord {
  id: string;
  category: 'rsvp' | 'wishes';
  recordId: string;
  recipientEmail: string;
  subject: string;
  idempotencyKey: string;
  status: 'sent' | 'failed' | 'skipped';
  provider: 'resend';
  providerMessageId: string | null;
  errorMessage: string | null;
  attempts: number;
  lastAttemptAt: string;
  createdAt: string;
}

export interface Phase3Settings {
  rsvpEnabled: boolean;
  rsvpHeadingEn: string;
  rsvpHeadingMl: string;
  rsvpSubtitleEn: string;
  rsvpSubtitleMl: string;
  rsvpAllowAttendeeCount: boolean;
  rsvpMaxAttendees: number;
  rsvpCustomFields: RsvpCustomField[];
  rsvpNotifyEnabled: boolean;
  rsvpNotifyEmail: string;

  wishesEnabled: boolean;
  wishesHeadingEn: string;
  wishesHeadingMl: string;
  wishesSubtitleEn: string;
  wishesSubtitleMl: string;
  wishesAutoApprove: boolean;
  wishesNotifyEnabled: boolean;
  wishesNotifyEmail: string;
  updatedAt: string;
}

export interface PublicPhase3Settings {
  rsvpEnabled: boolean;
  rsvpHeadingEn: string;
  rsvpHeadingMl: string;
  rsvpSubtitleEn: string;
  rsvpSubtitleMl: string;
  rsvpAllowAttendeeCount: boolean;
  rsvpMaxAttendees: number;
  rsvpCustomFields: RsvpCustomField[];
  wishesEnabled: boolean;
  wishesHeadingEn: string;
  wishesHeadingMl: string;
  wishesSubtitleEn: string;
  wishesSubtitleMl: string;
}

export interface Phase3PublicPayload {
  settings: PublicPhase3Settings;
  approvedWishes: PublicWishCard[];
  migrationRequired: boolean;
}

export interface RsvpMetrics {
  total: number;
  attending: number;
  notAttending: number;
  totalConfirmedAttendees: number;
}

export interface Phase3AdminRsvpResponse {
  items: RsvpEntry[];
  metrics: RsvpMetrics;
  settings: Phase3Settings;
  deliveries: EmailDeliveryRecord[];
  emailConfigured: boolean;
  emailFrom: string | null;
  migrationRequired: boolean;
  migrationMessage?: string;
}

export interface WishesCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  published: number;
}

export interface Phase3AdminWishesResponse {
  items: WeddingWish[];
  counts: WishesCounts;
  settings: Phase3Settings;
  deliveries: EmailDeliveryRecord[];
  emailConfigured: boolean;
  emailFrom: string | null;
  migrationRequired: boolean;
  migrationMessage?: string;
}
