import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AssignedMediaSection,
  DriveAvailability,
  DriveBrowserFolder,
  DriveConnectionStatus,
  DriveFolderAssignments,
  DriveFolderRole,
  DriveMediaItem,
  DriveMediaType,
  DriveSyncLogEntry,
  DriveSyncSummary,
  Phase4AdminDashboardResponse,
} from '../src/types/phase4';
import {
  deleteDriveMediaFromObjectStorage,
  getObjectStorageInfo,
  uploadDriveMediaToObjectStorage,
} from './objectStorage';
import {getSupabaseAdmin, isSupabaseConfigured} from './supabase';
import {
  classifyUploadMime,
  sanitizeText,
  signDrivePreviewToken,
  validateDriveDownloadedMedia,
} from './validation';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PHASE4_STORE_FILE = path.join(DATA_DIR, 'phase4-drive.json');
const MAX_DRIVE_IMPORT_BYTES = 200 * 1024 * 1024; // 200 MB server buffer guard
const MIGRATION_MESSAGE =
  'Phase 4 Google Drive tables are not created in Supabase yet. Run supabase/migrations/003_phase4_google_drive.sql in your Supabase SQL Editor.';

interface InternalDriveState {
  connected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  authMethod: 'firebase_oauth' | 'google_oauth_refresh' | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  folders: DriveFolderAssignments;
  lastSyncAt: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'partial_error' | 'failed';
  lastSyncSummary: DriveSyncSummary | null;
  updatedAt: string;
}

interface LocalPhase4Doc {
  state: InternalDriveState;
  items: DriveMediaItem[];
  syncLogs: DriveSyncLogEntry[];
}

function defaultState(): InternalDriveState {
  return {
    connected: false,
    accountEmail: null,
    accountName: null,
    authMethod: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    folders: {
      photos: {folderId: null, folderName: null},
      videos: {folderId: null, folderName: null},
      music: {folderId: null, folderName: null},
      hero_video: {folderId: null, folderName: null},
    },
    lastSyncAt: null,
    lastSyncStatus: 'idle',
    lastSyncSummary: null,
    updatedAt: new Date().toISOString(),
  };
}

function readLocalDoc(): LocalPhase4Doc {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  if (!fs.existsSync(PHASE4_STORE_FILE)) {
    const init: LocalPhase4Doc = {
      state: defaultState(),
      items: [],
      syncLogs: [],
    };
    fs.writeFileSync(PHASE4_STORE_FILE, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
  const parsed = JSON.parse(
    fs.readFileSync(PHASE4_STORE_FILE, 'utf8')
  ) as Partial<LocalPhase4Doc>;
  return {
    state: {...defaultState(), ...(parsed.state || {})},
    items: Array.isArray(parsed.items) ? parsed.items : [],
    syncLogs: Array.isArray(parsed.syncLogs) ? parsed.syncLogs : [],
  };
}

function writeLocalDoc(doc: LocalPhase4Doc): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  fs.writeFileSync(PHASE4_STORE_FILE, JSON.stringify(doc, null, 2), 'utf8');
}

function isMissingPhase4TableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = (err as {code?: string} | null)?.code;
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('Could not find the table') ||
    msg.includes('drive_integration_state') ||
    msg.includes('drive_media_items') ||
    msg.includes('drive_sync_logs')
  );
}

function hasFirebaseOAuthConfig(): boolean {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return false;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as {
      apiKey?: string;
      authDomain?: string;
    };
    return Boolean(raw.apiKey && raw.authDomain);
  } catch {
    return false;
  }
}

export function isServerGoogleOAuthConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim() &&
      (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim()
  );
}

function mapSupabaseState(row: Record<string, unknown> | null): InternalDriveState {
  const def = defaultState();
  if (!row) return def;
  return {
    connected: Boolean(row.connected),
    accountEmail: row.account_email ? String(row.account_email) : null,
    accountName: row.account_name ? String(row.account_name) : null,
    authMethod:
      row.auth_method === 'google_oauth_refresh'
        ? 'google_oauth_refresh'
        : row.auth_method === 'firebase_oauth'
        ? 'firebase_oauth'
        : null,
    accessToken: row.access_token ? String(row.access_token) : null,
    refreshToken: row.refresh_token ? String(row.refresh_token) : null,
    tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
    folders: {
      photos: {
        folderId: row.photos_folder_id ? String(row.photos_folder_id) : null,
        folderName: row.photos_folder_name ? String(row.photos_folder_name) : null,
      },
      videos: {
        folderId: row.videos_folder_id ? String(row.videos_folder_id) : null,
        folderName: row.videos_folder_name ? String(row.videos_folder_name) : null,
      },
      music: {
        folderId: row.music_folder_id ? String(row.music_folder_id) : null,
        folderName: row.music_folder_name ? String(row.music_folder_name) : null,
      },
      hero_video: {
        folderId: row.hero_video_folder_id
          ? String(row.hero_video_folder_id)
          : null,
        folderName: row.hero_video_folder_name
          ? String(row.hero_video_folder_name)
          : null,
      },
    },
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastSyncStatus:
      row.last_sync_status === 'syncing' ||
      row.last_sync_status === 'success' ||
      row.last_sync_status === 'partial_error' ||
      row.last_sync_status === 'failed'
        ? row.last_sync_status
        : 'idle',
    lastSyncSummary:
      row.last_sync_summary && typeof row.last_sync_summary === 'object'
        ? (row.last_sync_summary as DriveSyncSummary)
        : null,
    updatedAt: String(row.updated_at || def.updatedAt),
  };
}

function mapSupabaseMediaItem(row: Record<string, unknown>): DriveMediaItem {
  return {
    id: String(row.id),
    driveFileId: String(row.drive_file_id),
    driveFolderId: String(row.drive_folder_id),
    folderRole: (row.folder_role as DriveFolderRole) || 'photos',
    fileName: String(row.file_name || ''),
    mimeType: String(row.mime_type || ''),
    mediaType: (row.media_type as DriveMediaType) || 'unsupported',
    sizeBytes: Number(row.size_bytes || 0),
    driveModifiedTime: row.drive_modified_time
      ? String(row.drive_modified_time)
      : null,
    driveThumbnailLink: row.drive_thumbnail_link
      ? String(row.drive_thumbnail_link)
      : null,
    driveWebViewLink: row.drive_web_view_link
      ? String(row.drive_web_view_link)
      : null,
    discoveredAt: String(row.discovered_at || new Date().toISOString()),
    driveAvailability:
      (row.drive_availability as DriveAvailability) || 'available',
    assignedSection:
      (row.assigned_section as AssignedMediaSection) || 'unassigned',
    displayOrder: Number(row.display_order || 0),
    captionEn: String(row.caption_en || ''),
    captionMl: String(row.caption_ml || ''),
    processingStatus:
      (row.processing_status as DriveMediaItem['processingStatus']) ||
      'discovered',
    processingProgress: Number(row.processing_progress || 0),
    processingError: row.processing_error ? String(row.processing_error) : null,
    storageProvider:
      row.storage_provider === 'r2' ||
      row.storage_provider === 'supabase' ||
      row.storage_provider === 'local'
        ? row.storage_provider
        : null,
    storageKey: row.storage_key ? String(row.storage_key) : null,
    publishedUrl: row.published_url ? String(row.published_url) : null,
    isApproved: Boolean(row.is_approved),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at ? String(row.published_at) : null,
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapSupabaseSyncLog(row: Record<string, unknown>): DriveSyncLogEntry {
  return {
    id: String(row.id),
    startedAt: String(row.started_at || new Date().toISOString()),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    status:
      row.status === 'partial_error' || row.status === 'failed'
        ? row.status
        : 'success',
    newCount: Number(row.new_count || 0),
    updatedCount: Number(row.updated_count || 0),
    unavailableCount: Number(row.unavailable_count || 0),
    failedCount: Number(row.failed_count || 0),
    details: Array.isArray(row.details)
      ? row.details.map((d) => String(d))
      : [],
  };
}

async function loadStateInternal(): Promise<{
  state: InternalDriveState;
  migrationRequired: boolean;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {state: readLocalDoc().state, migrationRequired: false};
  }
  const {data, error} = await supabase
    .from('drive_integration_state')
    .select('*')
    .eq('id', 'primary')
    .maybeSingle();

  if (error) {
    if (isMissingPhase4TableError(error)) {
      return {state: defaultState(), migrationRequired: true};
    }
    throw new Error(`Failed to load Google Drive state: ${error.message}`);
  }
  if (!data) {
    await supabase.from('drive_integration_state').insert({id: 'primary'});
    return {state: defaultState(), migrationRequired: false};
  }
  return {state: mapSupabaseState(data), migrationRequired: false};
}

async function saveStateInternal(patch: Partial<InternalDriveState>): Promise<InternalDriveState> {
  const {state: current, migrationRequired} = await loadStateInternal();
  if (migrationRequired) throw new Error(MIGRATION_MESSAGE);

  const next: InternalDriveState = {
    ...current,
    ...patch,
    folders: patch.folders ?? current.folders,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    doc.state = next;
    writeLocalDoc(doc);
    return next;
  }

  const {data, error} = await supabase
    .from('drive_integration_state')
    .upsert(
      {
        id: 'primary',
        connected: next.connected,
        account_email: next.accountEmail,
        account_name: next.accountName,
        auth_method: next.authMethod,
        access_token: next.accessToken,
        refresh_token: next.refreshToken,
        token_expires_at: next.tokenExpiresAt,
        photos_folder_id: next.folders.photos.folderId,
        photos_folder_name: next.folders.photos.folderName,
        videos_folder_id: next.folders.videos.folderId,
        videos_folder_name: next.folders.videos.folderName,
        music_folder_id: next.folders.music.folderId,
        music_folder_name: next.folders.music.folderName,
        hero_video_folder_id: next.folders.hero_video.folderId,
        hero_video_folder_name: next.folders.hero_video.folderName,
        last_sync_at: next.lastSyncAt,
        last_sync_status: next.lastSyncStatus,
        last_sync_summary: next.lastSyncSummary,
        updated_at: next.updatedAt,
      },
      {onConflict: 'id'}
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to persist Drive state: ${error?.message || 'DB error'}`);
  }
  return mapSupabaseState(data);
}

function toSafeConnectionStatus(state: InternalDriveState): DriveConnectionStatus {
  const expiresMs = state.tokenExpiresAt ? Date.parse(state.tokenExpiresAt) : null;
  const expired =
    Boolean(state.connected) &&
    (!state.accessToken || (expiresMs !== null && Date.now() > expiresMs - 30_000));

  return {
    connected: state.connected,
    accountEmail: state.accountEmail,
    accountName: state.accountName,
    authMethod: state.authMethod,
    tokenExpired: expired && !state.refreshToken,
    tokenExpiresAt: state.tokenExpiresAt,
    hasRefreshToken: Boolean(state.refreshToken),
    serverOAuthConfigured: isServerGoogleOAuthConfigured(),
    firebaseOAuthConfigured: hasFirebaseOAuthConfig(),
  };
}

/**
 * Resolves a valid Google Drive Bearer access token on the server, refreshing
 * safely if a refresh_token + server client credentials exist.
 */
async function getValidDriveAccessToken(): Promise<string> {
  const {state, migrationRequired} = await loadStateInternal();
  if (migrationRequired) throw new Error(MIGRATION_MESSAGE);
  if (!state.connected) {
    throw new Error('Google Drive is not connected. Please connect your Google account first.');
  }

  const expiresMs = state.tokenExpiresAt ? Date.parse(state.tokenExpiresAt) : null;
  const isNearExpiry =
    !state.accessToken || (expiresMs !== null && Date.now() > expiresMs - 60_000);

  if (!isNearExpiry && state.accessToken) {
    return state.accessToken;
  }

  if (state.refreshToken && isServerGoogleOAuthConfigured()) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
        refresh_token: state.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      await saveStateInternal({accessToken: null});
      throw new Error(
        data.error_description ||
          data.error ||
          'Google Drive refresh token failed. Please reconnect your Google account.'
      );
    }
    const nextExp = new Date(
      Date.now() + (Number(data.expires_in) || 3500) * 1000
    ).toISOString();
    await saveStateInternal({
      accessToken: data.access_token,
      tokenExpiresAt: nextExp,
    });
    return data.access_token;
  }

  throw new Error(
    'Your Google Drive access token has expired. Click "Reconnect Google Drive" to refresh authorization.'
  );
}

// ---------------------------------------------------------------------------
// 1. GOOGLE ACCOUNT CONNECTION (Real API Verification)
// ---------------------------------------------------------------------------

export async function connectGoogleDriveWithToken(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number;
  authMethod: 'firebase_oauth' | 'google_oauth_refresh';
}): Promise<DriveConnectionStatus> {
  const token = params.accessToken.trim();
  if (!token) {
    throw new Error('Google access token is missing.');
  }

  // Verify token directly with Google Drive API About endpoint
  const aboutRes = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
    {
      headers: {Authorization: `Bearer ${token}`},
    }
  );
  const aboutData = (await aboutRes.json().catch(() => ({}))) as {
    user?: {displayName?: string; emailAddress?: string};
    error?: {message?: string};
  };

  if (!aboutRes.ok || !aboutData.user) {
    throw new Error(
      aboutData.error?.message ||
        'Google Drive rejected the authorization token. Make sure Google Drive access was granted.'
    );
  }

  const expiresIn = Math.max(300, Number(params.expiresInSeconds) || 3500);
  const nextState = await saveStateInternal({
    connected: true,
    accountEmail: aboutData.user.emailAddress || null,
    accountName: aboutData.user.displayName || null,
    authMethod: params.authMethod,
    accessToken: token,
    refreshToken: params.refreshToken ?? null,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });

  return toSafeConnectionStatus(nextState);
}

export async function disconnectGoogleDrive(): Promise<DriveConnectionStatus> {
  const {state} = await loadStateInternal();
  if (state.accessToken) {
    // Best-effort token revocation on Google's side
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(state.accessToken)}`,
      {method: 'POST'}
    ).catch(() => {});
  }

  const cleared = await saveStateInternal({
    connected: false,
    accountEmail: null,
    accountName: null,
    authMethod: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
  });

  return toSafeConnectionStatus(cleared);
}

// Optional standalone server-side OAuth URL & callback exchange (when GOOGLE_OAUTH_CLIENT_* are set)
const oauthStates = new Map<string, number>();

export function buildServerGoogleOAuthUrl(redirectUri: string): string {
  if (!isServerGoogleOAuthConfigured()) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not configured on the server.'
    );
  }
  const stateToken = crypto.randomBytes(24).toString('hex');
  oauthStates.set(stateToken, Date.now() + 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: stateToken,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function completeServerGoogleOAuthCallback(params: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<DriveConnectionStatus> {
  const exp = oauthStates.get(params.state);
  oauthStates.delete(params.state);
  if (!exp || Date.now() > exp) {
    throw new Error('Invalid or expired OAuth state parameter.');
  }
  if (!isServerGoogleOAuthConfigured()) {
    throw new Error('Google OAuth server client credentials are missing.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code: params.code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        'Failed to exchange Google OAuth authorization code.'
    );
  }

  return connectGoogleDriveWithToken({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresInSeconds: tokenData.expires_in,
    authMethod: 'google_oauth_refresh',
  });
}

// ---------------------------------------------------------------------------
// 2. GOOGLE DRIVE FOLDER BROWSING & CONFIGURATION
// ---------------------------------------------------------------------------

export async function browseGoogleDriveFolders(params: {
  parentId?: string;
  search?: string;
}): Promise<DriveBrowserFolder[]> {
  const accessToken = await getValidDriveAccessToken();

  const clauses = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ];

  const cleanSearch = sanitizeText(params.search, 80).replace(/'/g, "\\'");
  const cleanParent = sanitizeText(params.parentId, 80).replace(/'/g, "\\'");

  if (cleanSearch) {
    clauses.push(`name contains '${cleanSearch}'`);
  } else if (cleanParent) {
    clauses.push(`'${cleanParent}' in parents`);
  }

  const qs = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,modifiedTime,shared)',
    orderBy: 'folder,name',
    pageSize: '60',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${qs.toString()}`,
    {headers: {Authorization: `Bearer ${accessToken}`}}
  );

  if (res.status === 401) {
    await saveStateInternal({accessToken: null});
    throw new Error(
      'Google Drive authorization expired. Please reconnect your Google account.'
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    files?: Array<{
      id?: string;
      name?: string;
      modifiedTime?: string;
      shared?: boolean;
    }>;
    error?: {message?: string};
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message || `Failed to list Google Drive folders (HTTP ${res.status}).`
    );
  }

  return (data.files || [])
    .filter((f) => f.id && f.name)
    .map((f) => ({
      id: String(f.id),
      name: String(f.name),
      modifiedTime: f.modifiedTime ? String(f.modifiedTime) : null,
      shared: Boolean(f.shared),
    }));
}

export async function saveDriveFolderAssignments(
  folders: DriveFolderAssignments
): Promise<DriveFolderAssignments> {
  const cleanAssignment = (a?: {folderId?: string | null; folderName?: string | null}) => {
    const folderId = sanitizeText(a?.folderId, 120) || null;
    const folderName = folderId ? sanitizeText(a?.folderName, 160) || folderId : null;
    return {folderId, folderName};
  };

  const nextFolders: DriveFolderAssignments = {
    photos: cleanAssignment(folders.photos),
    videos: cleanAssignment(folders.videos),
    music: cleanAssignment(folders.music),
    hero_video: cleanAssignment(folders.hero_video),
  };

  const saved = await saveStateInternal({folders: nextFolders});
  return saved.folders;
}

// ---------------------------------------------------------------------------
// 3. MANUAL SYNCHRONISATION & MEDIA DISCOVERY
// ---------------------------------------------------------------------------

function classifyDriveMime(mimeType: string): DriveMediaType {
  const kind = classifyUploadMime(mimeType);
  return kind ?? 'unsupported';
}

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

async function listAllFilesInDriveFolder(
  accessToken: string,
  folderId: string
): Promise<DriveApiFile[]> {
  const collected: DriveApiFile[] = [];
  let pageToken: string | undefined;

  do {
    const cleanFolder = folderId.replace(/'/g, "\\'");
    const qs = new URLSearchParams({
      q: `'${cleanFolder}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields:
        'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink)',
      pageSize: '100',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    });
    if (pageToken) {
      qs.set('pageToken', pageToken);
    }

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${qs.toString()}`,
      {headers: {Authorization: `Bearer ${accessToken}`}}
    );

    if (res.status === 401) {
      await saveStateInternal({accessToken: null});
      throw new Error('TOKEN_EXPIRED');
    }

    const data = (await res.json().catch(() => ({}))) as {
      nextPageToken?: string;
      files?: DriveApiFile[];
      error?: {message?: string};
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message || `Google Drive returned HTTP ${res.status}`
      );
    }

    for (const f of data.files || []) {
      if (f.id && f.name) collected.push(f);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return collected;
}

async function listAllDriveMediaItems(): Promise<DriveMediaItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return [...readLocalDoc().items].sort(
      (a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)
    );
  }
  const {data, error} = await supabase
    .from('drive_media_items')
    .select('*')
    .order('display_order', {ascending: true})
    .order('discovered_at', {ascending: false});

  if (error) {
    if (isMissingPhase4TableError(error)) return [];
    throw new Error(`Failed to load Drive media library: ${error.message}`);
  }
  return (data || []).map(mapSupabaseMediaItem);
}

async function upsertDriveMediaItem(item: DriveMediaItem): Promise<DriveMediaItem> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    const idx = doc.items.findIndex(
      (x) => x.id === item.id || x.driveFileId === item.driveFileId
    );
    if (idx >= 0) {
      doc.items[idx] = item;
    } else {
      doc.items.unshift(item);
    }
    writeLocalDoc(doc);
    return item;
  }

  const {data, error} = await supabase
    .from('drive_media_items')
    .upsert(
      {
        id: item.id,
        drive_file_id: item.driveFileId,
        drive_folder_id: item.driveFolderId,
        folder_role: item.folderRole,
        file_name: item.fileName,
        mime_type: item.mimeType,
        media_type: item.mediaType,
        size_bytes: item.sizeBytes,
        drive_modified_time: item.driveModifiedTime,
        drive_thumbnail_link: item.driveThumbnailLink,
        drive_web_view_link: item.driveWebViewLink,
        discovered_at: item.discoveredAt,
        drive_availability: item.driveAvailability,
        assigned_section: item.assignedSection,
        display_order: item.displayOrder,
        caption_en: item.captionEn,
        caption_ml: item.captionMl,
        processing_status: item.processingStatus,
        processing_progress: item.processingProgress,
        processing_error: item.processingError,
        storage_provider: item.storageProvider,
        storage_key: item.storageKey,
        published_url: item.publishedUrl,
        is_approved: item.isApproved,
        is_published: item.isPublished,
        published_at: item.publishedAt,
        updated_at: item.updatedAt,
      },
      {onConflict: 'drive_file_id'}
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save Drive media item: ${error?.message || 'Database error'}`
    );
  }
  return mapSupabaseMediaItem(data);
}

export async function syncConfiguredDriveFolders(): Promise<{
  summary: DriveSyncSummary;
  log: DriveSyncLogEntry;
}> {
  const {state, migrationRequired} = await loadStateInternal();
  if (migrationRequired) throw new Error(MIGRATION_MESSAGE);

  const accessToken = await getValidDriveAccessToken();
  const roles: Array<{role: DriveFolderRole; folderId: string | null; folderName: string | null}> =
    [
      {role: 'photos', ...state.folders.photos},
      {role: 'videos', ...state.folders.videos},
      {role: 'music', ...state.folders.music},
      {role: 'hero_video', ...state.folders.hero_video},
    ];

  const configuredRoles = roles.filter((r) => Boolean(r.folderId));
  if (configuredRoles.length === 0) {
    throw new Error(
      'Please assign at least one Google Drive folder before running a sync.'
    );
  }

  await saveStateInternal({lastSyncStatus: 'syncing'});

  const startedAt = new Date().toISOString();
  const existingItems = await listAllDriveMediaItems();
  const byDriveId = new Map(existingItems.map((i) => [i.driveFileId, i]));

  let newCount = 0;
  let updatedCount = 0;
  let unavailableCount = 0;
  let unsupportedCount = 0;
  let failedCount = 0;
  const details: string[] = [];

  for (const cfg of configuredRoles) {
    const folderId = cfg.folderId!;
    try {
      const files = await listAllFilesInDriveFolder(accessToken, folderId);
      const seenInFolder = new Set<string>();

      for (const file of files) {
        seenInFolder.add(file.id);
        const mediaType = classifyDriveMime(file.mimeType || '');
        const availability: DriveAvailability =
          mediaType === 'unsupported' ? 'unsupported' : 'available';
        if (mediaType === 'unsupported') unsupportedCount++;

        const sizeBytes = Number(file.size || 0);
        const existing = byDriveId.get(file.id);
        const now = new Date().toISOString();

        if (!existing) {
          newCount++;
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const created: DriveMediaItem = {
            id: crypto.randomUUID(),
            driveFileId: file.id,
            driveFolderId: folderId,
            folderRole: cfg.role,
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            mediaType,
            sizeBytes,
            driveModifiedTime: file.modifiedTime || null,
            driveThumbnailLink: file.thumbnailLink || null,
            driveWebViewLink: file.webViewLink || null,
            discoveredAt: now,
            driveAvailability: availability,
            assignedSection: 'unassigned', // Always unassigned & unpublished on discovery!
            displayOrder: existingItems.length + newCount,
            captionEn: baseName,
            captionMl: baseName,
            processingStatus: 'discovered',
            processingProgress: 0,
            processingError:
              availability === 'unsupported'
                ? `Unsupported file format (${file.mimeType || 'unknown'}).`
                : null,
            storageProvider: null,
            storageKey: null,
            publishedUrl: null,
            isApproved: false,
            isPublished: false,
            publishedAt: null,
            updatedAt: now,
          };
          const saved = await upsertDriveMediaItem(created);
          byDriveId.set(saved.driveFileId, saved);
        } else {
          const changed =
            existing.fileName !== file.name ||
            existing.driveFolderId !== folderId ||
            existing.folderRole !== cfg.role ||
            existing.driveModifiedTime !== (file.modifiedTime || null) ||
            existing.driveAvailability !== availability ||
            existing.sizeBytes !== sizeBytes;

          if (changed) {
            updatedCount++;
            const updated: DriveMediaItem = {
              ...existing,
              driveFolderId: folderId,
              folderRole: cfg.role,
              fileName: file.name,
              mimeType: file.mimeType || existing.mimeType,
              mediaType,
              sizeBytes,
              driveModifiedTime: file.modifiedTime || existing.driveModifiedTime,
              driveThumbnailLink:
                file.thumbnailLink || existing.driveThumbnailLink,
              driveWebViewLink: file.webViewLink || existing.driveWebViewLink,
              driveAvailability: availability,
              updatedAt: now,
            };
            const saved = await upsertDriveMediaItem(updated);
            byDriveId.set(saved.driveFileId, saved);
          }
        }
      }

      // Detect files deleted or moved out of this folder
      for (const existing of existingItems) {
        if (
          existing.driveFolderId === folderId &&
          !seenInFolder.has(existing.driveFileId) &&
          existing.driveAvailability !== 'deleted_in_drive'
        ) {
          unavailableCount++;
          await upsertDriveMediaItem({
            ...existing,
            driveAvailability: 'deleted_in_drive',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      details.push(
        `Folder "${cfg.folderName || folderId}" (${cfg.role}): scanned ${files.length} item(s).`
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
        await saveStateInternal({
          lastSyncStatus: 'failed',
          lastSyncSummary: {
            newCount,
            updatedCount,
            unavailableCount,
            unsupportedCount,
            failedCount: failedCount + 1,
            message: 'Google Drive authorization expired during sync. Please reconnect.',
          },
        });
        throw new Error(
          'Google Drive authorization expired during sync. Please reconnect your Google account.'
        );
      }
      failedCount++;
      const reason = err instanceof Error ? err.message : 'Folder read error.';
      details.push(`Folder "${cfg.folderName || folderId}" (${cfg.role}) failed: ${reason}`);

      for (const existing of existingItems) {
        if (existing.driveFolderId === folderId) {
          unavailableCount++;
          await upsertDriveMediaItem({
            ...existing,
            driveAvailability: 'unavailable_permission',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const status: DriveSyncLogEntry['status'] =
    failedCount > 0
      ? newCount > 0 || updatedCount > 0
        ? 'partial_error'
        : 'failed'
      : 'success';

  const summary: DriveSyncSummary = {
    newCount,
    updatedCount,
    unavailableCount,
    unsupportedCount,
    failedCount,
    message:
      failedCount > 0
        ? `Sync completed with ${failedCount} folder error(s). Discovered ${newCount} new file(s).`
        : `Sync completed: ${newCount} new, ${updatedCount} updated, ${unavailableCount} unavailable.`,
  };

  const logEntry: DriveSyncLogEntry = {
    id: crypto.randomUUID(),
    startedAt,
    finishedAt,
    status,
    newCount,
    updatedCount,
    unavailableCount,
    failedCount,
    details,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    doc.syncLogs.unshift(logEntry);
    doc.syncLogs = doc.syncLogs.slice(0, 30);
    writeLocalDoc(doc);
  } else {
    await supabase.from('drive_sync_logs').insert({
      id: logEntry.id,
      started_at: logEntry.startedAt,
      finished_at: logEntry.finishedAt,
      status: logEntry.status,
      new_count: logEntry.newCount,
      updated_count: logEntry.updatedCount,
      unavailable_count: logEntry.unavailableCount,
      failed_count: logEntry.failedCount,
      details: logEntry.details,
    });
  }

  await saveStateInternal({
    lastSyncAt: finishedAt,
    lastSyncStatus: status,
    lastSyncSummary: summary,
  });

  return {summary, log: logEntry};
}

// ---------------------------------------------------------------------------
// 4. MEDIA PREVIEW PROXY, SECTION ASSIGNMENT, IMPORT TO OBJECT STORAGE & PUBLISH
// ---------------------------------------------------------------------------

export async function getPhase4AdminDashboard(): Promise<Phase4AdminDashboardResponse> {
  const {state, migrationRequired} = await loadStateInternal();
  const objectStorage = getObjectStorageInfo();

  if (migrationRequired) {
    return {
      connection: toSafeConnectionStatus(state),
      folders: state.folders,
      lastSyncAt: null,
      lastSyncStatus: 'idle',
      lastSyncSummary: null,
      items: [],
      syncLogs: [],
      objectStorage,
      migrationRequired: true,
      migrationMessage: MIGRATION_MESSAGE,
    };
  }

  const items = await listAllDriveMediaItems();
  let syncLogs: DriveSyncLogEntry[] = [];

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    syncLogs = readLocalDoc().syncLogs;
  } else {
    const {data} = await supabase
      .from('drive_sync_logs')
      .select('*')
      .order('started_at', {ascending: false})
      .limit(20);
    syncLogs = (data || []).map(mapSupabaseSyncLog);
  }

  return {
    connection: toSafeConnectionStatus(state),
    folders: state.folders,
    lastSyncAt: state.lastSyncAt,
    lastSyncStatus: state.lastSyncStatus,
    lastSyncSummary: state.lastSyncSummary,
    items,
    syncLogs,
    objectStorage,
    migrationRequired: false,
  };
}

export async function getDrivePreviewTokensForItems(
  driveFileIds: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const id of driveFileIds) {
    map[id] = `/api/admin/drive/files/${encodeURIComponent(
      id
    )}/preview?access=${encodeURIComponent(signDrivePreviewToken(id))}`;
  }
  return map;
}

export async function proxyDriveFileStream(
  driveFileId: string,
  rangeHeader?: string
): Promise<{
  status: number;
  contentType: string;
  contentRange?: string;
  contentLength?: string;
  buffer: Buffer;
}> {
  const accessToken = await getValidDriveAccessToken();
  const cleanId = encodeURIComponent(driveFileId);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (rangeHeader) {
    headers.Range = rangeHeader;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`,
    {headers}
  );

  if (res.status === 401) {
    await saveStateInternal({accessToken: null});
    throw new Error('Google Drive authorization expired.');
  }
  if (!res.ok) {
    throw new Error(`Unable to preview Drive file (HTTP ${res.status}).`);
  }

  const arr = await res.arrayBuffer();
  return {
    status: res.status,
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    contentRange: res.headers.get('content-range') || undefined,
    contentLength: res.headers.get('content-length') || undefined,
    buffer: Buffer.from(arr),
  };
}

async function getDriveItemById(id: string): Promise<DriveMediaItem | null> {
  const cleanId = sanitizeText(id, 80);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return readLocalDoc().items.find((i) => i.id === cleanId) || null;
  }
  const {data, error} = await supabase
    .from('drive_media_items')
    .select('*')
    .eq('id', cleanId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch Drive item: ${error.message}`);
  return data ? mapSupabaseMediaItem(data) : null;
}

export async function updateDriveMediaMetadata(
  itemId: string,
  patch: {
    assignedSection?: AssignedMediaSection;
    captionEn?: string;
    captionMl?: string;
    displayOrder?: number;
  }
): Promise<DriveMediaItem> {
  const item = await getDriveItemById(itemId);
  if (!item) throw new Error('Media item not found.');

  const nextSection = patch.assignedSection ?? item.assignedSection;
  if (nextSection !== 'unassigned') {
    if (nextSection === 'photo_gallery' && item.mediaType !== 'photo') {
      throw new Error('Only image files can be assigned to Photo Gallery.');
    }
    if (
      (nextSection === 'video_gallery' || nextSection === 'hero_video') &&
      item.mediaType !== 'video'
    ) {
      throw new Error('Only video files can be assigned to Video sections.');
    }
    if (nextSection === 'background_music' && item.mediaType !== 'audio') {
      throw new Error('Only audio files can be assigned to Background Music.');
    }
  }

  return upsertDriveMediaItem({
    ...item,
    assignedSection: nextSection,
    captionEn:
      patch.captionEn !== undefined
        ? sanitizeText(patch.captionEn, 160)
        : item.captionEn,
    captionMl:
      patch.captionMl !== undefined
        ? sanitizeText(patch.captionMl, 160)
        : item.captionMl,
    displayOrder:
      patch.displayOrder !== undefined
        ? Math.max(0, Math.round(Number(patch.displayOrder) || 0))
        : item.displayOrder,
    updatedAt: new Date().toISOString(),
  });
}

export async function reorderDriveMediaItems(
  orderedIds: string[]
): Promise<void> {
  const all = await listAllDriveMediaItems();
  const byId = new Map(all.map((i) => [i.id, i]));
  let order = 1;
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item && item.displayOrder !== order) {
      await upsertDriveMediaItem({
        ...item,
        displayOrder: order,
        updatedAt: new Date().toISOString(),
      });
    }
    order++;
  }
}

export async function approveAndPublishDriveMediaItem(
  itemId: string,
  overrideSection?: AssignedMediaSection
): Promise<DriveMediaItem> {
  let item = await getDriveItemById(itemId);
  if (!item) throw new Error('Media item not found.');

  if (overrideSection && overrideSection !== item.assignedSection) {
    item = await updateDriveMediaMetadata(item.id, {
      assignedSection: overrideSection,
    });
  }

  if (item.mediaType === 'unsupported') {
    throw new Error('Unsupported file types cannot be published.');
  }
  if (item.assignedSection === 'unassigned') {
    throw new Error(
      'Please assign this file to a website section (Photo Gallery, Video Gallery, Hero Video, or Background Music) before publishing.'
    );
  }

  // If already copied to object storage and ready, simply re-publish without re-downloading
  if (item.processingStatus === 'ready' && item.publishedUrl) {
    return upsertDriveMediaItem({
      ...item,
      isApproved: true,
      isPublished: true,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (item.sizeBytes > MAX_DRIVE_IMPORT_BYTES) {
    const failed = await upsertDriveMediaItem({
      ...item,
      processingStatus: 'failed',
      processingProgress: 0,
      processingError: `File exceeds the ${Math.round(
        MAX_DRIVE_IMPORT_BYTES / (1024 * 1024)
      )} MB transfer limit (${Math.round(item.sizeBytes / (1024 * 1024))} MB).`,
      updatedAt: new Date().toISOString(),
    });
    throw new Error(failed.processingError!);
  }

  try {
    const accessToken = await getValidDriveAccessToken();

    await upsertDriveMediaItem({
      ...item,
      processingStatus: 'downloading',
      processingProgress: 20,
      processingError: null,
      updatedAt: new Date().toISOString(),
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        item.driveFileId
      )}?alt=media`,
      {headers: {Authorization: `Bearer ${accessToken}`}}
    );

    if (res.status === 401) {
      await saveStateInternal({accessToken: null});
      throw new Error(
        'Google Drive authorization expired. Please reconnect your Google account.'
      );
    }
    if (res.status === 403 || res.status === 404) {
      await upsertDriveMediaItem({
        ...item,
        driveAvailability:
          res.status === 404 ? 'deleted_in_drive' : 'unavailable_permission',
        processingStatus: 'failed',
        processingProgress: 0,
        processingError:
          res.status === 404
            ? 'File was deleted or moved in Google Drive.'
            : 'Insufficient permissions to download this file from Google Drive.',
        updatedAt: new Date().toISOString(),
      });
      throw new Error(
        res.status === 404
          ? 'File no longer exists in Google Drive.'
          : 'Permission denied downloading file from Google Drive.'
      );
    }
    if (!res.ok) {
      throw new Error(`Google Drive download failed (HTTP ${res.status}).`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length > MAX_DRIVE_IMPORT_BYTES) {
      throw new Error(
        `Downloaded file exceeds ${Math.round(
          MAX_DRIVE_IMPORT_BYTES / (1024 * 1024)
        )} MB limit.`
      );
    }

    const validated = validateDriveDownloadedMedia(buffer, item.mimeType);

    await upsertDriveMediaItem({
      ...item,
      processingStatus: 'uploading',
      processingProgress: 65,
      processingError: null,
      updatedAt: new Date().toISOString(),
    });

    const stored = await uploadDriveMediaToObjectStorage({
      driveFileId: item.driveFileId,
      extension: validated.extension,
      mimeType: validated.mimeType,
      buffer,
    });

    const now = new Date().toISOString();
    return upsertDriveMediaItem({
      ...item,
      mimeType: validated.mimeType,
      sizeBytes: buffer.length,
      driveAvailability: 'available',
      processingStatus: 'ready',
      processingProgress: 100,
      processingError: null,
      storageProvider: stored.provider,
      storageKey: stored.storageKey,
      publishedUrl: stored.publicUrl,
      isApproved: true,
      isPublished: true,
      publishedAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to transfer Drive media.';
    await upsertDriveMediaItem({
      ...item,
      processingStatus: 'failed',
      processingProgress: 0,
      processingError: message,
      isPublished: false,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(message);
  }
}

export async function unpublishDriveMediaItem(
  itemId: string
): Promise<DriveMediaItem> {
  const item = await getDriveItemById(itemId);
  if (!item) throw new Error('Media item not found.');

  return upsertDriveMediaItem({
    ...item,
    isPublished: false,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Deletes ONLY the copied asset from Object Storage (never deletes the original Google Drive file!).
 */
export async function removeCopiedDriveMediaAsset(
  itemId: string
): Promise<DriveMediaItem> {
  const item = await getDriveItemById(itemId);
  if (!item) throw new Error('Media item not found.');

  if (item.storageProvider && item.storageKey) {
    await deleteDriveMediaFromObjectStorage(item.storageProvider, item.storageKey);
  }

  return upsertDriveMediaItem({
    ...item,
    processingStatus: 'discovered',
    processingProgress: 0,
    processingError: null,
    storageProvider: null,
    storageKey: null,
    publishedUrl: null,
    isApproved: false,
    isPublished: false,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeDriveDiscoveryEntry(itemId: string): Promise<void> {
  const item = await getDriveItemById(itemId);
  if (!item) return;

  if (item.storageProvider && item.storageKey) {
    await deleteDriveMediaFromObjectStorage(item.storageProvider, item.storageKey);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const doc = readLocalDoc();
    doc.items = doc.items.filter((i) => i.id !== item.id);
    writeLocalDoc(doc);
    return;
  }
  const {error} = await supabase.from('drive_media_items').delete().eq('id', item.id);
  if (error) throw new Error(`Failed to remove media record: ${error.message}`);
}

/**
 * Used by Public Wedding Website (`/api/public/wedding`):
 * Returns ONLY approved & published Drive media with valid object storage URLs.
 */
export async function getPublishedDriveMediaForSite(): Promise<DriveMediaItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return readLocalDoc()
      .items.filter(
        (i) => i.isApproved && i.isPublished && Boolean(i.publishedUrl)
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const {data, error} = await supabase
    .from('drive_media_items')
    .select('*')
    .eq('is_approved', true)
    .eq('is_published', true)
    .not('published_url', 'is', null)
    .order('display_order', {ascending: true})
    .order('published_at', {ascending: false});

  if (error) {
    if (isMissingPhase4TableError(error)) return [];
    return [];
  }
  return (data || []).map(mapSupabaseMediaItem);
}
