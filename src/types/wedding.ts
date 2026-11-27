export type Language = 'en' | 'ml';

export interface LocalizedText {
  en: string;
  ml: string;
}

export interface CouplePersonProfile {
  id: 'bride' | 'groom';
  nickname: LocalizedText;
  fullName: LocalizedText;
  roleLabel: LocalizedText;
  portraitUrl: string;
  portraitAlt: LocalizedText;
  fatherName: LocalizedText;
  motherName: LocalizedText;
  paternalGrandparents: LocalizedText;
  maternalGrandparents: LocalizedText;
  hometown: LocalizedText;
  personalIntro: LocalizedText;
  additionalNote?: LocalizedText;
}

export interface FamilyMember {
  id: string;
  side: 'bride' | 'groom';
  name: LocalizedText;
  relationship: LocalizedText;
  note?: LocalizedText;
  order: number;
  visible: boolean;
}

export interface WeddingEvent {
  id: string;
  title: LocalizedText;
  dateLabel: LocalizedText;
  timeRange: LocalizedText;
  venueName: LocalizedText;
  description?: LocalizedText;
  imageUrl?: string;
  isMuhurtham?: boolean;
  order?: number;
  visible?: boolean;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: LocalizedText;
  caption: LocalizedText;
  description?: LocalizedText;
  aspect: 'landscape' | 'portrait' | 'square';
  featured?: boolean;
  order?: number;
  visible?: boolean;
  /** Future Phase 3 Google Drive moderation gate: only 'approved' & visible items render publicly */
  status: 'approved' | 'pending';
  source?: 'local' | 'supabase' | 'drive' | 'r2';
  isPlaceholder?: boolean;
}

export interface GalleryVideo {
  id: string;
  title: LocalizedText;
  caption: LocalizedText;
  duration: string;
  posterUrl: string;
  /** Real Supabase/R2/CDN video URL; null triggers built-in placeholder preview mode */
  videoUrl: string | null;
  order?: number;
  visible?: boolean;
  status: 'approved' | 'pending';
  source?: 'local' | 'supabase' | 'drive' | 'r2';
  isPlaceholder?: boolean;
}

export type SectionKey =
  | 'couple'
  | 'family'
  | 'countdown'
  | 'details'
  | 'gallery'
  | 'videos';

export interface WebsiteSectionConfig {
  key: SectionKey;
  enabled: boolean;
  order: number;
  heading: LocalizedText;
  subtitle?: LocalizedText;
}

export interface LanguageSettings {
  defaultLanguage: Language;
  malayalamEnabled: boolean;
  showLanguageSwitcher: boolean;
}

export interface SocialSharingSettings {
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
}

export interface WeddingConfig {
  meta: {
    isPlaceholderData: boolean;
    placeholderNotice: LocalizedText;
  };
  invitation: {
    phrase: LocalizedText;
    blessing: LocalizedText;
    openButtonLabel: LocalizedText;
  };
  hero: {
    invitationMessage: LocalizedText;
    /** Optional MP4/WebM URL provided by owner; falls back to fallbackImageUrl seamlessly */
    backgroundVideoUrl: string | null;
    fallbackImageUrl: string;
    fallbackImageAlt: LocalizedText;
    additionalInfo?: LocalizedText;
  };
  dateAndTime: {
    /** ISO 8601 timestamp with explicit IST (+05:30) offset */
    muhurthamIso: string;
    calendarEndIso: string;
    displayDate: LocalizedText;
    muhurthamWindow: LocalizedText;
    malayalamCalendarDate?: LocalizedText;
  };
  venue: {
    name: LocalizedText;
    addressLine1: LocalizedText;
    addressLine2: LocalizedText;
    googleMapsUrl: string;
    directionsHint?: LocalizedText;
  };
  couple: {
    bride: CouplePersonProfile;
    groom: CouplePersonProfile;
  };
  familyMembers?: FamilyMember[];
  events: WeddingEvent[];
  media: {
    musicEnabled?: boolean;
    /** Optional owner-provided MP3/WAV file; if null, uses built-in synthesized Kerala classical ambient audio */
    musicUrl: string | null;
    musicTitle: LocalizedText;
    photos: GalleryPhoto[];
    videos: GalleryVideo[];
  };
  sections?: WebsiteSectionConfig[];
  languageSettings?: LanguageSettings;
  socialSharing?: SocialSharingSettings;
  footer: {
    blessingQuote: LocalizedText;
    hostsLine: LocalizedText;
    showDateAndNames?: boolean;
    showCredit?: boolean;
    creditName?: string;
    creditUrl?: string;
  };
}
