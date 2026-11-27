export type DriveFolderRole = 'photos' | 'videos' | 'music' | 'hero_video';

export type DriveMediaType = 'photo' | 'video' | 'audio' | 'unsupported';

export type DriveAvailability =
  | 'available'
  | 'deleted_in_drive'
  | 'unavailable_permission'
  | 'unsupported';

export type AssignedMediaSection =
  | 'unassigned'
  | 'photo_gallery'
  | 'video_gallery'
  | 'hero_video'
  | 'background_music';

export type ProcessingStatus =
  | 'discovered'
  | 'queued'
  | 'downloading'
  | 'uploading'
  | 'ready'
  | 'failed';

export type ObjectStorageProvider = 'r2' | 'supabase' | 'local';

export interface DriveFolderAssignment {
  folderId: string | null;
  folderName: string | null;
}

export interface DriveSyncSummary {
  newCount: number;
  updatedCount: number;
  unavailableCount: number;
  unsupportedCount: number;
  failedCount: number;
  message: string;
}

export interface DriveConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  authMethod: 'firebase_oauth' | 'google_oauth_refresh' | null;
  tokenExpired: boolean;
  tokenExpiresAt: string | null;
  hasRefreshToken: boolean;
  serverOAuthConfigured: boolean;
  firebaseOAuthConfigured: boolean;
}

export interface DriveFolderAssignments {
  photos: DriveFolderAssignment;
  videos: DriveFolderAssignment;
  music: DriveFolderAssignment;
  hero_video: DriveFolderAssignment;
}

export interface DriveMediaItem {
  id: string;
  driveFileId: string;
  driveFolderId: string;
  folderRole: DriveFolderRole;
  fileName: string;
  mimeType: string;
  mediaType: DriveMediaType;
  sizeBytes: number;
  driveModifiedTime: string | null;
  driveThumbnailLink: string | null;
  driveWebViewLink: string | null;
  discoveredAt: string;
  driveAvailability: DriveAvailability;

  assignedSection: AssignedMediaSection;
  displayOrder: number;
  captionEn: string;
  captionMl: string;

  processingStatus: ProcessingStatus;
  processingProgress: number;
  processingError: string | null;
  storageProvider: ObjectStorageProvider | null;
  storageKey: string | null;
  publishedUrl: string | null;

  isApproved: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface DriveSyncLogEntry {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'partial_error' | 'failed';
  newCount: number;
  updatedCount: number;
  unavailableCount: number;
  failedCount: number;
  details: string[];
}

export interface ObjectStorageInfo {
  provider: ObjectStorageProvider;
  label: string;
  r2Configured: boolean;
  supabaseStorageConfigured: boolean;
  notes: string;
}

export interface DriveBrowserFolder {
  id: string;
  name: string;
  modifiedTime: string | null;
  shared: boolean;
}

export interface Phase4AdminDashboardResponse {
  connection: DriveConnectionStatus;
  folders: DriveFolderAssignments;
  lastSyncAt: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'partial_error' | 'failed';
  lastSyncSummary: DriveSyncSummary | null;
  items: DriveMediaItem[];
  syncLogs: DriveSyncLogEntry[];
  objectStorage: ObjectStorageInfo;
  migrationRequired: boolean;
  migrationMessage?: string;
  previewUrls?: Record<string, string>;
}
