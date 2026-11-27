import type {WeddingConfig} from '../types/wedding';
import type {
  AdminDraftPayload,
  AdminOverviewData,
  AdminUser,
  AuthStatusResponse,
  MediaAsset,
  PublicWeddingPayload,
  SetupWizardState,
} from '../types/admin';

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as {error?: string; message?: string}).error ||
      (data as {message?: string}).message ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchPublicWedding(): Promise<PublicWeddingPayload> {
  const res = await fetch('/api/public/wedding', {cache: 'no-store'});
  return parseJsonResponse<PublicWeddingPayload>(res);
}

export async function fetchAuthStatus(
  token: string | null
): Promise<AuthStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/admin/auth/status', {
    headers,
    cache: 'no-store',
  });
  return parseJsonResponse<AuthStatusResponse>(res);
}

export async function setupOwnerAccount(
  email: string,
  password: string
): Promise<{token: string; user: AdminUser; expiresAt: number}> {
  const res = await fetch('/api/admin/auth/setup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
  return parseJsonResponse(res);
}

export async function loginAdminAccount(
  email: string,
  password: string
): Promise<{token: string; user: AdminUser; expiresAt: number}> {
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
  return parseJsonResponse(res);
}

export async function logoutAdminAccount(token: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  await fetch('/api/admin/auth/logout', {method: 'POST', headers}).catch(() => {});
}

export async function requestAdminPasswordReset(
  email: string
): Promise<{ok: boolean; message: string}> {
  const res = await fetch('/api/admin/auth/reset-password', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email,
      redirectTo: `${window.location.origin}/admin`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    message:
      (data as {message?: string; error?: string}).message ||
      (data as {error?: string}).error ||
      'Password reset request could not be completed.',
  };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchAdminOverview(token: string): Promise<AdminOverviewData> {
  const res = await fetch('/api/admin/overview', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<AdminOverviewData>(res);
}

export async function fetchAdminDraft(token: string): Promise<AdminDraftPayload> {
  const res = await fetch('/api/admin/draft', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<AdminDraftPayload>(res);
}

export async function saveAdminDraft(
  token: string,
  params: {
    draftConfig: WeddingConfig;
    setupState?: SetupWizardState;
    sectionLabel: string;
    summary: string;
  }
): Promise<AdminDraftPayload> {
  const res = await fetch('/api/admin/draft', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  return parseJsonResponse<AdminDraftPayload>(res);
}

export async function uploadAdminMedia(
  token: string,
  file: File
): Promise<MediaAsset> {
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  const data = await parseJsonResponse<{asset: MediaAsset}>(res);
  return data.asset;
}

export async function deleteAdminMedia(
  token: string,
  assetId: string
): Promise<MediaAsset[]> {
  const res = await fetch(`/api/admin/media/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await parseJsonResponse<{mediaLibrary: MediaAsset[]}>(res);
  return data.mediaLibrary;
}

export async function clearAllAdminMedia(token: string): Promise<MediaAsset[]> {
  const res = await fetch('/api/admin/media', {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await parseJsonResponse<{mediaLibrary: MediaAsset[]}>(res);
  return data.mediaLibrary;
}

export async function publishAdminDraft(token: string): Promise<AdminDraftPayload> {
  const res = await fetch('/api/admin/publish', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  return parseJsonResponse<AdminDraftPayload>(res);
}

export async function unpublishAdminSite(token: string): Promise<AdminDraftPayload> {
  const res = await fetch('/api/admin/unpublish', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  return parseJsonResponse<AdminDraftPayload>(res);
}

export async function discardAdminDraft(token: string): Promise<AdminDraftPayload> {
  const res = await fetch('/api/admin/discard-draft', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  return parseJsonResponse<AdminDraftPayload>(res);
}

// ---------------------------------------------------------------------------
// Phase 3: RSVP, Wedding Wishes & Email Notifications API Helpers
// ---------------------------------------------------------------------------

import type {
  EmailDeliveryRecord,
  Phase3AdminRsvpResponse,
  Phase3AdminWishesResponse,
  Phase3PublicPayload,
  Phase3Settings,
  RsvpAttendance,
  RsvpEntry,
  WeddingWish,
  WishStatus,
} from '../types/phase3';

export async function fetchPublicPhase3(): Promise<Phase3PublicPayload> {
  const res = await fetch('/api/public/phase3', {cache: 'no-store'});
  return parseJsonResponse<Phase3PublicPayload>(res);
}

export async function submitPublicRsvp(payload: {
  guestName: string;
  attendance: RsvpAttendance;
  attendeeCount: number;
  message: string;
  customFields: Record<string, string>;
  clientSubmissionKey: string;
  website?: string;
}): Promise<{
  entry: RsvpEntry;
  duplicate: boolean;
  emailStatus: 'sent' | 'failed' | 'disabled';
}> {
  const res = await fetch('/api/public/rsvp', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function submitPublicWish(payload: {
  guestName: string;
  message: string;
  emoji: string;
  photoDataUrl?: string | null;
  previewConfirmed: boolean;
  clientSubmissionKey: string;
  website?: string;
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
  const res = await fetch('/api/public/wishes', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function fetchAdminRsvps(
  token: string
): Promise<Phase3AdminRsvpResponse> {
  const res = await fetch('/api/admin/rsvps', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<Phase3AdminRsvpResponse>(res);
}

export async function updateAdminRsvpEntry(
  token: string,
  id: string,
  patch: Partial<{
    guestName: string;
    attendance: RsvpAttendance;
    attendeeCount: number;
    message: string;
    adminNote: string;
    customFields: Record<string, string>;
  }>
): Promise<RsvpEntry> {
  const res = await fetch(`/api/admin/rsvps/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse<{entry: RsvpEntry}>(res);
  return data.entry;
}

export async function deleteAdminRsvpEntry(
  token: string,
  id: string
): Promise<void> {
  const res = await fetch(`/api/admin/rsvps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  await parseJsonResponse<{ok: boolean}>(res);
}

export async function downloadAdminRsvpCsv(token: string): Promise<void> {
  const res = await fetch('/api/admin/rsvps/export.csv', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as {error?: string}).error || 'CSV export failed.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wedding-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchAdminWishes(
  token: string
): Promise<Phase3AdminWishesResponse> {
  const res = await fetch('/api/admin/wishes', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<Phase3AdminWishesResponse>(res);
}

export async function updateAdminWishEntry(
  token: string,
  id: string,
  patch: Partial<{
    guestName: string;
    message: string;
    emoji: string;
    status: WishStatus;
    isPublished: boolean;
  }>
): Promise<WeddingWish> {
  const res = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse<{wish: WeddingWish}>(res);
  return data.wish;
}

export async function deleteAdminWishEntry(
  token: string,
  id: string
): Promise<void> {
  const res = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  await parseJsonResponse<{ok: boolean}>(res);
}

export async function saveAdminPhase3Settings(
  token: string,
  patch: Partial<Phase3Settings>
): Promise<Phase3Settings> {
  const res = await fetch('/api/admin/phase3/settings', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse<{settings: Phase3Settings}>(res);
  return data.settings;
}

export async function retryAdminEmailDelivery(
  token: string,
  deliveryId: string
): Promise<EmailDeliveryRecord> {
  const res = await fetch(
    `/api/admin/email-deliveries/${encodeURIComponent(deliveryId)}/retry`,
    {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    }
  );
  const data = await parseJsonResponse<{delivery: EmailDeliveryRecord}>(res);
  return data.delivery;
}

// ---------------------------------------------------------------------------
// Phase 4: Google Drive Integration & Media Management API Helpers
// ---------------------------------------------------------------------------

import type {
  AssignedMediaSection,
  DriveBrowserFolder,
  DriveConnectionStatus,
  DriveFolderAssignments,
  DriveMediaItem,
  DriveSyncLogEntry,
  DriveSyncSummary,
  Phase4AdminDashboardResponse,
} from '../types/phase4';

export async function fetchDriveDashboard(
  token: string
): Promise<Phase4AdminDashboardResponse> {
  const res = await fetch('/api/admin/drive', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<Phase4AdminDashboardResponse>(res);
}

export async function connectDriveToken(
  token: string,
  accessToken: string,
  expiresInSeconds?: number
): Promise<DriveConnectionStatus> {
  const res = await fetch('/api/admin/drive/connect-token', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({accessToken, expiresInSeconds}),
  });
  const data = await parseJsonResponse<{connection: DriveConnectionStatus}>(res);
  return data.connection;
}

export async function disconnectDrive(
  token: string
): Promise<DriveConnectionStatus> {
  const res = await fetch('/api/admin/drive/disconnect', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await parseJsonResponse<{connection: DriveConnectionStatus}>(res);
  return data.connection;
}

export async function fetchServerGoogleOAuthUrl(
  token: string
): Promise<{url: string; redirectUri: string}> {
  const res = await fetch('/api/admin/drive/oauth/url', {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  return parseJsonResponse<{url: string; redirectUri: string}>(res);
}

export async function browseDriveFolders(
  token: string,
  params?: {parentId?: string; search?: string}
): Promise<DriveBrowserFolder[]> {
  const qs = new URLSearchParams();
  if (params?.parentId) qs.set('parentId', params.parentId);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`/api/admin/drive/folders${query}`, {
    headers: {Authorization: `Bearer ${token}`},
    cache: 'no-store',
  });
  const data = await parseJsonResponse<{folders: DriveBrowserFolder[]}>(res);
  return data.folders;
}

export async function saveDriveFolders(
  token: string,
  folders: DriveFolderAssignments
): Promise<DriveFolderAssignments> {
  const res = await fetch('/api/admin/drive/folders', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({folders}),
  });
  const data = await parseJsonResponse<{folders: DriveFolderAssignments}>(res);
  return data.folders;
}

export async function triggerDriveSync(token: string): Promise<{
  summary: DriveSyncSummary;
  log: DriveSyncLogEntry;
}> {
  const res = await fetch('/api/admin/drive/sync', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  return parseJsonResponse<{summary: DriveSyncSummary; log: DriveSyncLogEntry}>(res);
}

export async function updateDriveItem(
  token: string,
  id: string,
  patch: Partial<{
    assignedSection: AssignedMediaSection;
    captionEn: string;
    captionMl: string;
    displayOrder: number;
  }>
): Promise<DriveMediaItem> {
  const res = await fetch(`/api/admin/drive/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse<{item: DriveMediaItem}>(res);
  return data.item;
}

export async function reorderDriveItems(
  token: string,
  orderedIds: string[]
): Promise<void> {
  const res = await fetch('/api/admin/drive/items/reorder', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({orderedIds}),
  });
  await parseJsonResponse<{ok: boolean}>(res);
}

export async function publishDriveItem(
  token: string,
  id: string,
  assignedSection?: AssignedMediaSection
): Promise<DriveMediaItem> {
  const res = await fetch(`/api/admin/drive/items/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(assignedSection ? {assignedSection} : {}),
  });
  const data = await parseJsonResponse<{item: DriveMediaItem}>(res);
  return data.item;
}

export async function unpublishDriveItem(
  token: string,
  id: string
): Promise<DriveMediaItem> {
  const res = await fetch(`/api/admin/drive/items/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await parseJsonResponse<{item: DriveMediaItem}>(res);
  return data.item;
}

export async function removeDriveItemStorage(
  token: string,
  id: string
): Promise<DriveMediaItem> {
  const res = await fetch(`/api/admin/drive/items/${encodeURIComponent(id)}/storage`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await parseJsonResponse<{item: DriveMediaItem}>(res);
  return data.item;
}

export async function deleteDriveItemRecord(
  token: string,
  id: string
): Promise<void> {
  const res = await fetch(`/api/admin/drive/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });
  await parseJsonResponse<{ok: boolean}>(res);
}


