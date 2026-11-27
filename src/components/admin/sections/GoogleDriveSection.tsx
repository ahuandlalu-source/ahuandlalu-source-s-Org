import {useCallback, useEffect, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Folder,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Unlink,
  X,
} from 'lucide-react';
import type {
  DriveBrowserFolder,
  DriveFolderAssignments,
  DriveFolderRole,
  Phase4AdminDashboardResponse,
} from '../../../types/phase4';
import {
  browseDriveFolders,
  connectDriveToken,
  disconnectDrive,
  fetchDriveDashboard,
  fetchServerGoogleOAuthUrl,
  saveDriveFolders,
  triggerDriveSync,
} from '../../../services/adminApi';
import {
  isFirebaseDriveAuthAvailable,
  signInWithGoogleForDrive,
  signOutFirebaseGoogle,
} from '../../../services/googleDriveAuth';
import {ConfirmDialog, SectionCard} from '../AdminPrimitives';

interface GoogleDriveSectionProps {
  token: string;
  onSessionExpired: () => void;
  onOpenMediaLibrary: () => void;
  onDriveUpdated?: () => void;
}

const FOLDER_SLOTS: Array<{
  role: DriveFolderRole;
  label: string;
  helper: string;
}> = [
  {
    role: 'photos',
    label: '1. Wedding Photographs Folder',
    helper: 'JPEG, PNG, or WebP wedding photos discovered here can be approved for the Photo Gallery.',
  },
  {
    role: 'videos',
    label: '2. Wedding Videos Folder',
    helper: 'MP4 or WebM highlight reels discovered here can be published to the Video Gallery.',
  },
  {
    role: 'music',
    label: '3. Background Music / Audio Folder',
    helper: 'MP3, WAV, or OGG tracks discovered here can be assigned as Background Music.',
  },
  {
    role: 'hero_video',
    label: '4. Hero Background Video Folder',
    helper: 'MP4 or WebM loop clips discovered here can be assigned to the Hero Banner background.',
  },
];

function GoogleGIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function GoogleDriveSection({
  token,
  onSessionExpired,
  onOpenMediaLibrary,
  onDriveUpdated,
}: GoogleDriveSectionProps) {
  const [dashboard, setDashboard] = useState<Phase4AdminDashboardResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [foldersDraft, setFoldersDraft] = useState<DriveFolderAssignments>({
    photos: {folderId: null, folderName: null},
    videos: {folderId: null, folderName: null},
    music: {folderId: null, folderName: null},
    hero_video: {folderId: null, folderName: null},
  });
  const [foldersDirty, setFoldersDirty] = useState(false);
  const [savingFolders, setSavingFolders] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);

  // Interactive Drive Folder Browser modal state
  const [pickerRole, setPickerRole] = useState<DriveFolderRole | null>(null);
  const [browserFolders, setBrowserFolders] = useState<DriveBrowserFolder[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [browserSearch, setBrowserSearch] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{id: string; name: string}>>(
    []
  );

  const handleError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Request failed.';
      if (
        msg.toLowerCase().includes('authentication required') ||
        msg.toLowerCase().includes('invalid or expired')
      ) {
        onSessionExpired();
        return;
      }
      setError(msg);
    },
    [onSessionExpired]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDriveDashboard(token);
      setDashboard(data);
      setFoldersDraft(data.folders);
      setFoldersDirty(false);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [token, handleError]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Listen for optional server OAuth popup messages
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as {type?: string; message?: string} | null;
      if (!payload?.type) return;
      if (payload.type === 'GOOGLE_DRIVE_OAUTH_SUCCESS') {
        setNotice(payload.message || 'Google Drive connected successfully.');
        setError(null);
        void loadDashboard();
        onDriveUpdated?.();
      } else if (payload.type === 'GOOGLE_DRIVE_OAUTH_ERROR') {
        setError(payload.message || 'Google Drive OAuth failed.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadDashboard, onDriveUpdated]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    setError(null);
    setNotice(null);
    try {
      const {accessToken, expiresInSeconds} = await signInWithGoogleForDrive();
      const conn = await connectDriveToken(token, accessToken, expiresInSeconds);
      setNotice(
        `Connected Google Drive account${conn.accountEmail ? ` (${conn.accountEmail})` : ''}.`
      );
      await loadDashboard();
      onDriveUpdated?.();
    } catch (err) {
      handleError(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectServerOAuth = async () => {
    setError(null);
    setNotice(null);
    try {
      const {url} = await fetchServerGoogleOAuthUrl(token);
      const popup = window.open(
        url,
        'google-drive-oauth',
        'width=540,height=660,menubar=no,toolbar=no'
      );
      if (!popup) {
        setError(
          'Browser blocked the authorization popup. Please allow popups and try again.'
        );
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    setNotice(null);
    try {
      await disconnectDrive(token);
      await signOutFirebaseGoogle();
      setNotice('Google Drive account disconnected and server tokens cleared.');
      await loadDashboard();
      onDriveUpdated?.();
    } catch (err) {
      handleError(err);
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  };

  const loadBrowserFolders = useCallback(
    async (opts?: {parentId?: string; search?: string}) => {
      setBrowserLoading(true);
      setBrowserError(null);
      try {
        const list = await browseDriveFolders(token, opts);
        setBrowserFolders(list);
      } catch (err) {
        setBrowserError(
          err instanceof Error ? err.message : 'Unable to load Google Drive folders.'
        );
      } finally {
        setBrowserLoading(false);
      }
    },
    [token]
  );

  const openFolderPicker = (role: DriveFolderRole) => {
    setPickerRole(role);
    setBrowserSearch('');
    setBreadcrumbs([]);
    void loadBrowserFolders({parentId: 'root'});
  };

  const enterSubfolder = (folder: DriveBrowserFolder) => {
    setBreadcrumbs((prev) => [...prev, {id: folder.id, name: folder.name}]);
    setBrowserSearch('');
    void loadBrowserFolders({parentId: folder.id});
  };

  const jumpBreadcrumb = (index: number) => {
    if (index < 0) {
      setBreadcrumbs([]);
      void loadBrowserFolders({parentId: 'root'});
      return;
    }
    const sliced = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(sliced);
    void loadBrowserFolders({parentId: sliced[sliced.length - 1].id});
  };

  const selectFolderForSlot = (folder: DriveBrowserFolder) => {
    if (!pickerRole) return;
    setFoldersDraft((prev) => ({
      ...prev,
      [pickerRole]: {folderId: folder.id, folderName: folder.name},
    }));
    setFoldersDirty(true);
    setPickerRole(null);
  };

  const handleSaveFolders = async () => {
    setSavingFolders(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveDriveFolders(token, foldersDraft);
      setFoldersDraft(saved);
      setFoldersDirty(false);
      setNotice('Folder assignments saved. Run "Sync Now" to discover media files.');
      await loadDashboard();
    } catch (err) {
      handleError(err);
    } finally {
      setSavingFolders(false);
    }
  };

  const handleManualSync = async () => {
    if (foldersDirty) {
      setError('Please save your folder configuration changes before running a sync.');
      return;
    }
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const {summary} = await triggerDriveSync(token);
      setNotice(summary.message);
      await loadDashboard();
      onDriveUpdated?.();
    } catch (err) {
      handleError(err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const conn = dashboard?.connection;
  const storage = dashboard?.objectStorage;
  const anyFolderAssigned = Boolean(
    foldersDraft.photos.folderId ||
      foldersDraft.videos.folderId ||
      foldersDraft.music.folderId ||
      foldersDraft.hero_video.folderId
  );

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-dev-qfxofawryyfbqpyrfkhnrs-939224635581.asia-northeast1.run.app';

  return (
    <div className="space-y-6">
      {dashboard?.migrationRequired && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-1.5">
          <p className="font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 shrink-0" />
            <span>Supabase Phase 4 Database Migration Required</span>
          </p>
          <p>{dashboard.migrationMessage}</p>
          <p className="text-amber-800">
            Run{' '}
            <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono">
              supabase/migrations/003_phase4_google_drive.sql
            </code>{' '}
            in your Supabase SQL Editor, then click Refresh.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Google Account Connection */}
      <SectionCard
        title="Google Drive Account Connection"
        description="Authorize read-only access to browse wedding media folders in Google Drive. Tokens are stored strictly on the server."
        actions={
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <p className="text-slate-500">Connection Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {!conn?.connected
                  ? 'Not Connected'
                  : conn.tokenExpired
                    ? 'Authorization Expired'
                    : 'Connected (Read-Only Drive)'}
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <p className="text-slate-500">Connected Google Account</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                {conn?.connected
                  ? conn.accountEmail || conn.accountName || 'Authorized Account'
                  : 'None'}
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <p className="text-slate-500">Object Storage Target</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {storage?.label || 'Checking...'}
              </p>
            </div>
          </div>

          {conn?.connected && conn.tokenExpired && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              Your temporary Google Drive session expired ({formatDateTime(conn.tokenExpiresAt)}).
              Click <strong>Reconnect Google Drive</strong> below to resume folder browsing and imports.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isFirebaseDriveAuthAvailable() && (
              <button
                type="button"
                onClick={() => void handleConnectGoogle()}
                disabled={connecting || dashboard?.migrationRequired}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[#747775] bg-white text-[#1F1F1F] text-sm font-medium shadow-xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer min-h-[42px]"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                ) : (
                  <GoogleGIcon />
                )}
                <span>
                  {conn?.connected
                    ? conn.tokenExpired
                      ? 'Reconnect Google Drive'
                      : 'Switch / Reauthorize Google Account'
                    : 'Sign in with Google'}
                </span>
              </button>
            )}

            {conn?.serverOAuthConfigured && (
              <button
                type="button"
                onClick={() => void handleConnectServerOAuth()}
                disabled={dashboard?.migrationRequired}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer min-h-[42px]"
              >
                <HardDrive className="w-4 h-4 text-slate-600" />
                <span>Connect with Server Offline Refresh</span>
              </button>
            )}

            {conn?.connected && (
              <button
                type="button"
                onClick={() => setDisconnectOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-medium hover:bg-rose-50 cursor-pointer min-h-[42px]"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect Google Drive</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSetupGuideOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer ml-auto"
            >
              <Info className="w-3.5 h-3.5" />
              <span>
                {setupGuideOpen ? 'Hide OAuth & R2 Setup Guide' : 'OAuth & R2 Setup Guide'}
              </span>
            </button>
          </div>

          {storage && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">{storage.label}</p>
                <p className="text-slate-600 mt-0.5">{storage.notes}</p>
              </div>
            </div>
          )}

          {setupGuideOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-3">
              <p className="font-semibold text-slate-900">
                Optional Production Configuration (Background Refresh Tokens &amp; Cloudflare R2)
              </p>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>
                  <strong>Built-in Google Sign-In:</strong> Already provisioned via AI Studio OAuth
                  for <code className="font-mono">https://www.googleapis.com/auth/drive.readonly</code>.
                  Tokens stay valid for ~1 hour; click Reconnect when prompted.
                </li>
                <li>
                  <strong>Optional Server-Side Offline Refresh (Google Cloud Console):</strong> Enable
                  the <em>Google Drive API</em>, configure your OAuth consent screen with scope{' '}
                  <code className="font-mono">https://www.googleapis.com/auth/drive.readonly</code>,
                  create a Web Application OAuth client, and add these exact authorized redirect URIs:
                  <div className="mt-1.5 space-y-1 font-mono text-[11px] bg-white border border-slate-200 rounded-lg p-2.5 break-all">
                    <div>{origin}/api/admin/drive/oauth/callback</div>
                    <div>
                      https://ais-dev-qfxofawryyfbqpyrfkhnrs-939224635581.asia-northeast1.run.app/api/admin/drive/oauth/callback
                    </div>
                    <div>
                      https://ais-pre-qfxofawryyfbqpyrfkhnrs-939224635581.asia-northeast1.run.app/api/admin/drive/oauth/callback
                    </div>
                  </div>
                  Then set server environment variables{' '}
                  <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code> and{' '}
                  <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>.
                </li>
                <li>
                  <strong>Optional Cloudflare R2 Object Storage (Recommended for Large Videos):</strong>{' '}
                  Set <code className="font-mono">R2_ACCOUNT_ID</code>,{' '}
                  <code className="font-mono">R2_ACCESS_KEY_ID</code>,{' '}
                  <code className="font-mono">R2_SECRET_ACCESS_KEY</code>,{' '}
                  <code className="font-mono">R2_BUCKET_NAME</code>, and{' '}
                  <code className="font-mono">R2_PUBLIC_URL</code> on the server. When omitted, approved
                  media automatically copies to Supabase Storage CDN.
                </li>
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {/* 2. Folder Configuration */}
      <SectionCard
        title="Google Drive Folder Assignments"
        description="Assign folders from your Google Drive for each wedding media category. Newly discovered files always remain unpublished until you review and approve them."
        actions={
          <button
            type="button"
            onClick={() => void handleSaveFolders()}
            disabled={!foldersDirty || savingFolders || dashboard?.migrationRequired}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-45 cursor-pointer min-h-[38px]"
          >
            {savingFolders && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{foldersDirty ? 'Save Folder Configuration' : 'Configuration Saved'}</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FOLDER_SLOTS.map((slot) => {
            const assigned = foldersDraft[slot.role];
            return (
              <div
                key={slot.role}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">{slot.label}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {slot.helper}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {assigned.folderName || 'No folder assigned'}
                      </p>
                      {assigned.folderId && (
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          ID: {assigned.folderId}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {assigned.folderId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFoldersDraft((prev) => ({
                            ...prev,
                            [slot.role]: {folderId: null, folderName: null},
                          }));
                          setFoldersDirty(true);
                        }}
                        className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!conn?.connected || conn.tokenExpired}
                      onClick={() => openFolderPicker(slot.role)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-45 cursor-pointer"
                    >
                      Browse Drive
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 3. Manual Sync & Monitoring */}
      <SectionCard
        title="Manual Synchronisation & Audit Log"
        description="Trigger a manual scan of your assigned folders to discover new, renamed, or removed files."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenMediaLibrary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer min-h-[38px]"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Media Library ({dashboard?.items.length ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => void handleManualSync()}
              disabled={
                syncing ||
                !conn?.connected ||
                conn.tokenExpired ||
                !anyFolderAssigned ||
                dashboard?.migrationRequired
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-45 cursor-pointer min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Drive Folders...' : 'Sync Now'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <p className="text-slate-500">Last Synced</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatDateTime(dashboard?.lastSyncAt || null)}
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <p className="text-slate-500">Sync Status</p>
              <p className="mt-1 font-semibold text-slate-900 capitalize">
                {(dashboard?.lastSyncStatus || 'idle').replace('_', ' ')}
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <p className="text-slate-500">Discovered Items</p>
              <p className="mt-1 font-semibold text-slate-900 tabular-nums">
                {dashboard?.items.length ?? 0} total
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <p className="text-slate-500">Published to Website</p>
              <p className="mt-1 font-semibold text-emerald-700 tabular-nums">
                {dashboard?.items.filter((i) => i.isPublished).length ?? 0} live
              </p>
            </div>
          </div>

          {dashboard?.lastSyncSummary && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">
                {dashboard.lastSyncSummary.message}
              </span>
              <span className="text-slate-500 tabular-nums">
                New: {dashboard.lastSyncSummary.newCount} · Updated:{' '}
                {dashboard.lastSyncSummary.updatedCount} · Unavailable:{' '}
                {dashboard.lastSyncSummary.unavailableCount} · Unsupported:{' '}
                {dashboard.lastSyncSummary.unsupportedCount}
              </span>
            </div>
          )}

          {dashboard?.syncLogs && dashboard.syncLogs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Recent Sync Logs</p>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {dashboard.syncLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-3.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {formatDateTime(log.startedAt)} ·{' '}
                        <span className="capitalize">
                          {log.status.replace('_', ' ')}
                        </span>
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        +{log.newCount} new · {log.updatedCount} updated ·{' '}
                        {log.unavailableCount} unavailable · {log.failedCount} failed
                      </span>
                    </div>
                    {log.details.length > 0 && (
                      <ul className="text-[11px] text-slate-500 space-y-0.5">
                        {log.details.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Drive Folder Picker Modal */}
      {pickerRole && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Browse Google Drive folders"
          onClick={() => setPickerRole(null)}
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Select Google Drive Folder
                </h3>
                <p className="text-xs text-slate-500">
                  {FOLDER_SLOTS.find((s) => s.role === pickerRole)?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerRole(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close folder browser"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/70">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (browserSearch.trim()) {
                    void loadBrowserFolders({search: browserSearch.trim()});
                  } else {
                    void loadBrowserFolders({
                      parentId:
                        breadcrumbs.length > 0
                          ? breadcrumbs[breadcrumbs.length - 1].id
                          : 'root',
                    });
                  }
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={browserSearch}
                    onChange={(e) => setBrowserSearch(e.target.value)}
                    placeholder="Search folders by name across Drive..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
                >
                  Search
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => jumpBreadcrumb(-1)}
                  className="hover:text-slate-900 font-medium cursor-pointer"
                >
                  My Drive
                </button>
                {breadcrumbs.map((crumb, idx) => (
                  <span key={crumb.id} className="inline-flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => jumpBreadcrumb(idx)}
                      className="hover:text-slate-900 font-medium cursor-pointer"
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[240px]">
              {browserLoading ? (
                <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading folders from Google Drive...</span>
                </div>
              ) : browserError ? (
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {browserError}
                </div>
              ) : browserFolders.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-500">
                  No subfolders found here. Try navigating back or searching by folder name.
                </p>
              ) : (
                browserFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => enterSubfolder(folder)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {folder.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {folder.shared ? 'Shared folder · ' : ''}Open subfolders
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectFolderForSlot(folder)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      Select Folder
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={disconnectOpen}
        title="Disconnect Google Drive Account?"
        message="This will revoke and delete stored Google Drive access tokens from the server. Media already copied and published to Object Storage will remain safe on the website unless you remove it from the Media Library."
        confirmLabel="Disconnect Drive"
        destructive
        loading={disconnecting}
        onCancel={() => setDisconnectOpen(false)}
        onConfirm={() => void handleConfirmDisconnect()}
      />
    </div>
  );
}
