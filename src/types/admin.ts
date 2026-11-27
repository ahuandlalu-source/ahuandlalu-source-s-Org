import type {WeddingConfig} from './wedding';

export type AdminSectionId =
  | 'overview'
  | 'setup-wizard'
  | 'wedding-details'
  | 'bride-profile'
  | 'groom-profile'
  | 'family-info'
  | 'events-schedule'
  | 'photo-gallery'
  | 'video-gallery'
  | 'media-library'
  | 'background-music'
  | 'website-sections'
  | 'language-management'
  | 'social-sharing'
  | 'footer-settings'
  | 'rsvp-management'
  | 'wedding-wishes'
  | 'google-drive'
  | 'website-preview'
  | 'publish-settings';

export type StorageBackendMode = 'supabase' | 'local';

export interface AdminUser {
  email: string;
  role: 'owner';
  authMode: StorageBackendMode;
}

export interface AuthStatusResponse {
  mode: StorageBackendMode;
  supabaseConfigured: boolean;
  supabaseMissingVars: string[];
  requiresSetup: boolean;
  envPasscodeActive: boolean;
  adminEmailHint: string | null;
  authenticated: boolean;
  user: AdminUser | null;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'photo' | 'video' | 'audio';
  url: string;
  mimeType: string;
  sizeBytes: number;
  source: 'local' | 'supabase' | 'builtin';
  createdAt: string;
}

export interface SetupWizardState {
  completed: boolean;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  lastSavedAt: string | null;
}

export interface ActivityLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  section: string;
  summary: string;
  createdAt: string;
}

export interface PublicationState {
  status: 'published' | 'unpublished';
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminOverviewData {
  publication: PublicationState;
  weddingDate: string;
  muhurthamIso: string;
  coupleTitle: string;
  completionPercent: number;
  completedChecklistCount: number;
  totalChecklistCount: number;
  publishedPhotosCount: number;
  draftPhotosCount: number;
  publishedVideosCount: number;
  draftVideosCount: number;
  visibleEventsCount: number;
  familyMembersCount: number;
  sectionsNeedingInfo: Array<{
    id: AdminSectionId;
    label: string;
    reason: string;
  }>;
  recentActivity: ActivityLogEntry[];
  setupState: SetupWizardState;
  backendStatus: {
    mode: StorageBackendMode;
    supabaseConfigured: boolean;
    supabaseMissingVars: string[];
    storageDescription: string;
  };
}

export interface AdminDraftPayload {
  draftConfig: WeddingConfig;
  publication: PublicationState;
  setupState: SetupWizardState;
  mediaLibrary: MediaAsset[];
  activityLog: ActivityLogEntry[];
  backendStatus: AdminOverviewData['backendStatus'];
}

export interface PublicWeddingPayload {
  publicationStatus: 'published' | 'unpublished';
  config: WeddingConfig | null;
  publishedAt: string | null;
}
