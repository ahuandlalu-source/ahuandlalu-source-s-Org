import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  Film,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {MediaAsset} from '../../../types/admin';
import type {
  AssignedMediaSection,
  DriveFolderRole,
  DriveMediaItem,
  DriveMediaType,
  Phase4AdminDashboardResponse,
} from '../../../types/phase4';
import {
  deleteDriveItemRecord,
  fetchDriveDashboard,
  publishDriveItem,
  removeDriveItemStorage,
  reorderDriveItems,
  triggerDriveSync,
  unpublishDriveItem,
  updateDriveItem,
} from '../../../services/adminApi';
import {ConfirmDialog, FileUploadButton, SectionCard} from '../AdminPrimitives';

interface UnifiedMediaLibrarySectionProps {
  token: string;
  mediaLibrary: MediaAsset[];
  onUploadMedia: (file: File) => Promise<MediaAsset>;
  onDeleteMedia: (assetId: string) => Promise<void>;
  onClearAllMedia?: () => Promise<void>;
  onSessionExpired: () => void;
  onOpenDriveSettings: () => void;
}

const SECTION_LABELS: Record<AssignedMediaSection, string> = {
  unassigned: 'Unassigned (Draft Only)',
  photo_gallery: 'Photo Gallery',
  video_gallery: 'Video Gallery',
  hero_video: 'Hero Background Video',
  background_music: 'Background Music',
};

const FOLDER_ROLE_LABELS: Record<DriveFolderRole, string> = {
  photos: 'Photos Folder',
  videos: 'Videos Folder',
  music: 'Music Folder',
  hero_video: 'Hero Video Folder',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compatibleSectionsForType(
  mediaType: DriveMediaType
): AssignedMediaSection[] {
  if (mediaType === 'photo') return ['unassigned', 'photo_gallery'];
  if (mediaType === 'video') {
    return ['unassigned', 'video_gallery', 'hero_video'];
  }
  if (mediaType === 'audio') return ['unassigned', 'background_music'];
  return ['unassigned'];
}

export function UnifiedMediaLibrarySection({
  token,
  mediaLibrary,
  onUploadMedia,
  onDeleteMedia,
  onClearAllMedia,
  onSessionExpired,
  onOpenDriveSettings,
}: UnifiedMediaLibrarySectionProps) {
  const [activeTab, setActiveTab] = useState<'drive' | 'uploads'>('drive');

  // Drive Media Library state
  const [driveData, setDriveData] = useState<Phase4AdminDashboardResponse | null>(
    null
  );
  const [loadingDrive, setLoadingDrive] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DriveMediaType>('all');
  const [folderFilter, setFolderFilter] = useState<'all' | DriveFolderRole>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'unpublished' | 'failed' | 'unavailable'
  >('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSection, setBulkSection] = useState<AssignedMediaSection>('photo_gallery');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [busyIds, setBusyIds] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [previewItem, setPreviewItem] = useState<DriveMediaItem | null>(null);

  const [removeStorageTarget, setRemoveStorageTarget] =
    useState<DriveMediaItem | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] =
    useState<DriveMediaItem | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Caption draft edits per item
  const [captionDrafts, setCaptionDrafts] = useState<
    Record<string, {captionEn: string; captionMl: string}>
  >({});

  // Direct Uploads tab state
  const [uploadFilter, setUploadFilter] = useState<'all' | 'photo' | 'video' | 'audio'>(
    'all'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<MediaAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const handleApiError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Request failed.';
      if (
        msg.toLowerCase().includes('authentication required') ||
        msg.toLowerCase().includes('invalid or expired')
      ) {
        onSessionExpired();
        return;
      }
      setDriveError(msg);
    },
    [onSessionExpired]
  );

  const loadDriveMedia = useCallback(async () => {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      const data = await fetchDriveDashboard(token);
      setDriveData(data);
      const nextCaptions: Record<string, {captionEn: string; captionMl: string}> =
        {};
      for (const item of data.items) {
        nextCaptions[item.id] = {
          captionEn: item.captionEn,
          captionMl: item.captionMl,
        };
      }
      setCaptionDrafts(nextCaptions);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoadingDrive(false);
    }
  }, [token, handleApiError]);

  useEffect(() => {
    void loadDriveMedia();
  }, [loadDriveMedia]);

  const filteredDriveItems = useMemo(() => {
    const items = driveData?.items || [];
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.mediaType !== typeFilter) return false;
      if (folderFilter !== 'all' && item.folderRole !== folderFilter) return false;
      if (statusFilter === 'published' && !item.isPublished) return false;
      if (statusFilter === 'unpublished' && item.isPublished) return false;
      if (statusFilter === 'failed' && item.processingStatus !== 'failed') {
        return false;
      }
      if (
        statusFilter === 'unavailable' &&
        item.driveAvailability === 'available'
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${item.fileName} ${item.captionEn} ${item.captionMl} ${item.driveFileId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [driveData, searchQuery, typeFilter, folderFilter, statusFilter]);

  const setItemBusy = (id: string, label: string | null) => {
    setBusyIds((prev) => {
      const next = {...prev};
      if (label) next[id] = label;
      else delete next[id];
      return next;
    });
  };

  const replaceDriveItemInState = (updated: DriveMediaItem) => {
    setDriveData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === updated.id ? updated : i)),
      };
    });
  };

  const handleAssignSection = async (
    item: DriveMediaItem,
    assignedSection: AssignedMediaSection
  ) => {
    setItemBusy(item.id, 'Saving section...');
    setDriveError(null);
    try {
      const updated = await updateDriveItem(token, item.id, {assignedSection});
      replaceDriveItemInState(updated);
    } catch (err) {
      handleApiError(err);
    } finally {
      setItemBusy(item.id, null);
    }
  };

  const handleSaveCaptions = async (item: DriveMediaItem) => {
    const draft = captionDrafts[item.id];
    if (!draft) return;
    if (
      draft.captionEn === item.captionEn &&
      draft.captionMl === item.captionMl
    ) {
      return;
    }
    setItemBusy(item.id, 'Saving caption...');
    try {
      const updated = await updateDriveItem(token, item.id, {
        captionEn: draft.captionEn,
        captionMl: draft.captionMl,
      });
      replaceDriveItemInState(updated);
      setDriveNotice(`Saved caption for "${updated.fileName}".`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setItemBusy(item.id, null);
    }
  };

  const handleApproveAndPublish = async (item: DriveMediaItem) => {
    setItemBusy(item.id, 'Importing from Drive to Object Storage...');
    setDriveError(null);
    setDriveNotice(null);
    try {
      const updated = await publishDriveItem(token, item.id);
      replaceDriveItemInState(updated);
      setDriveNotice(
        `Published "${updated.fileName}" to ${SECTION_LABELS[updated.assignedSection]} via ${updated.storageProvider || 'storage'}.`
      );
    } catch (err) {
      handleApiError(err);
      await loadDriveMedia();
    } finally {
      setItemBusy(item.id, null);
    }
  };

  const handleUnpublish = async (item: DriveMediaItem) => {
    setItemBusy(item.id, 'Unpublishing...');
    setDriveError(null);
    try {
      const updated = await unpublishDriveItem(token, item.id);
      replaceDriveItemInState(updated);
      setDriveNotice(`Unpublished "${updated.fileName}" from the public website.`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setItemBusy(item.id, null);
    }
  };

  const handleReorder = async (index: number, delta: -1 | 1) => {
    if (!driveData) return;
    const all = [...driveData.items];
    const currentItem = filteredDriveItems[index];
    const targetItem = filteredDriveItems[index + delta];
    if (!currentItem || !targetItem) return;

    const idxA = all.findIndex((i) => i.id === currentItem.id);
    const idxB = all.findIndex((i) => i.id === targetItem.id);
    if (idxA < 0 || idxB < 0) return;

    [all[idxA], all[idxB]] = [all[idxB], all[idxA]];
    setDriveData({...driveData, items: all});
    try {
      await reorderDriveItems(
        token,
        all.map((i) => i.id)
      );
    } catch (err) {
      handleApiError(err);
      await loadDriveMedia();
    }
  };

  const handleConfirmRemoveStorage = async () => {
    if (!removeStorageTarget) return;
    setConfirmBusy(true);
    setDriveError(null);
    try {
      const updated = await removeDriveItemStorage(token, removeStorageTarget.id);
      replaceDriveItemInState(updated);
      setDriveNotice(
        `Removed copied asset for "${updated.fileName}" from Object Storage. Original Google Drive file is untouched.`
      );
    } catch (err) {
      handleApiError(err);
    } finally {
      setConfirmBusy(false);
      setRemoveStorageTarget(null);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!deleteRecordTarget) return;
    setConfirmBusy(true);
    setDriveError(null);
    try {
      await deleteDriveItemRecord(token, deleteRecordTarget.id);
      setDriveData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((i) => i.id !== deleteRecordTarget.id),
            }
          : prev
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteRecordTarget.id);
        return next;
      });
      setDriveNotice(
        `Removed "${deleteRecordTarget.fileName}" from CMS library. Original Google Drive file is untouched.`
      );
    } catch (err) {
      handleApiError(err);
    } finally {
      setConfirmBusy(false);
      setDeleteRecordTarget(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAssignSection = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setDriveError(null);
    let updatedCount = 0;
    let skippedCount = 0;
    try {
      const items = (driveData?.items || []).filter((i) => selectedIds.has(i.id));
      for (const item of items) {
        if (!compatibleSectionsForType(item.mediaType).includes(bulkSection)) {
          skippedCount++;
          continue;
        }
        const updated = await updateDriveItem(token, item.id, {
          assignedSection: bulkSection,
        });
        replaceDriveItemInState(updated);
        updatedCount++;
      }
      setDriveNotice(
        `Assigned ${updatedCount} item(s) to ${SECTION_LABELS[bulkSection]}${
          skippedCount > 0 ? ` (${skippedCount} skipped due to incompatible type)` : ''
        }.`
      );
    } catch (err) {
      handleApiError(err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setDriveError(null);
    let okCount = 0;
    let errCount = 0;
    try {
      const items = (driveData?.items || []).filter((i) => selectedIds.has(i.id));
      for (const item of items) {
        try {
          setItemBusy(item.id, 'Importing & publishing...');
          const updated = await publishDriveItem(token, item.id);
          replaceDriveItemInState(updated);
          okCount++;
        } catch {
          errCount++;
        } finally {
          setItemBusy(item.id, null);
        }
      }
      await loadDriveMedia();
      setDriveNotice(
        `Bulk publish finished: ${okCount} published${
          errCount > 0 ? `, ${errCount} failed (ensure compatible sections are assigned)` : ''
        }.`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkUnpublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setDriveError(null);
    try {
      const items = (driveData?.items || []).filter(
        (i) => selectedIds.has(i.id) && i.isPublished
      );
      for (const item of items) {
        const updated = await unpublishDriveItem(token, item.id);
        replaceDriveItemInState(updated);
      }
      setDriveNotice(`Unpublished ${items.length} selected item(s).`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    setDriveError(null);
    setDriveNotice(null);
    try {
      const {summary} = await triggerDriveSync(token);
      setDriveNotice(summary.message);
      await loadDriveMedia();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSyncing(false);
    }
  };

  const resolvePreviewUrl = (item: DriveMediaItem): string | null => {
    if (item.publishedUrl) return item.publishedUrl;
    return driveData?.previewUrls?.[item.driveFileId] || null;
  };

  const visibleUploads = mediaLibrary.filter(
    (a) => uploadFilter === 'all' || a.type === uploadFilter
  );

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive Library ({driveData?.items.length ?? 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('uploads')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'uploads'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Direct CMS Uploads ({mediaLibrary.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenDriveSettings}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Drive Connection &amp; Folders</span>
        </button>
      </div>

      {activeTab === 'drive' ? (
        <SectionCard
          title="Google Drive Media Library"
          description="Discovered Drive files remain private by default. Preview each item, assign a website section, and approve to copy into Object Storage & publish live."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDriveMedia()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => void handleQuickSync()}
                disabled={
                  syncing ||
                  !driveData?.connection.connected ||
                  driveData.connection.tokenExpired
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-45 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Folders'}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {driveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start justify-between gap-3 text-xs text-rose-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{driveError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDriveError(null)}
                  className="text-rose-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {driveNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start justify-between gap-3 text-xs text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{driveNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDriveNotice(null)}
                  className="text-emerald-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Search & Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search filename, caption, ID..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as 'all' | DriveMediaType)
                }
                aria-label="Filter by file type"
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="all">All File Types</option>
                <option value="photo">Photos</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="unsupported">Unsupported</option>
              </select>

              <select
                value={folderFilter}
                onChange={(e) =>
                  setFolderFilter(e.target.value as 'all' | DriveFolderRole)
                }
                aria-label="Filter by folder"
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="all">All Assigned Folders</option>
                <option value="photos">Photos Folder</option>
                <option value="videos">Videos Folder</option>
                <option value="music">Music Folder</option>
                <option value="hero_video">Hero Video Folder</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as
                      | 'all'
                      | 'published'
                      | 'unpublished'
                      | 'failed'
                      | 'unavailable'
                  )
                }
                aria-label="Filter by publication status"
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published Live</option>
                <option value="unpublished">Unpublished / Draft</option>
                <option value="failed">Failed Transfers</option>
                <option value="unavailable">Unavailable in Drive</option>
              </select>
            </div>

            {/* Bulk Selection Toolbar */}
            {selectedIds.size > 0 && (
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-900">
                  {selectedIds.size} item(s) selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkSection}
                    onChange={(e) =>
                      setBulkSection(e.target.value as AssignedMediaSection)
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="photo_gallery">Photo Gallery</option>
                    <option value="video_gallery">Video Gallery</option>
                    <option value="hero_video">Hero Background Video</option>
                    <option value="background_music">Background Music</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkAssignSection()}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                  >
                    Assign Section
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkPublish()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    {bulkBusy ? 'Processing...' : 'Approve & Publish Selected'}
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkUnpublish()}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                  >
                    Unpublish Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Discovered Items List */}
            {loadingDrive && !driveData ? (
              <div className="h-48 rounded-xl border border-slate-200 animate-pulse bg-slate-50" />
            ) : filteredDriveItems.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  No Google Drive media files match your current filters.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Connect your Google Drive account, assign folders, and click{' '}
                  <strong>Sync Folders</strong> to discover photos, videos, and music files.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDriveItems.map((item, idx) => {
                  const previewUrl = resolvePreviewUrl(item);
                  const busyLabel = busyIds[item.id];
                  const captionDraft = captionDrafts[item.id] || {
                    captionEn: item.captionEn,
                    captionMl: item.captionMl,
                  };
                  const compatibleSections = compatibleSectionsForType(item.mediaType);

                  return (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-xl p-4 bg-white space-y-4"
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* Selection + Preview Thumbnail */}
                        <div className="flex items-start gap-3 shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            aria-label={`Select ${item.fileName}`}
                            className="mt-1 h-4 w-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                          />

                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="relative w-28 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer group shrink-0"
                          >
                            {item.mediaType === 'photo' && previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={item.fileName}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : item.mediaType === 'video' ? (
                              <div className="flex flex-col items-center gap-1 text-slate-600">
                                <Film className="w-6 h-6" />
                                <span className="text-[10px] font-medium">Preview</span>
                              </div>
                            ) : item.mediaType === 'audio' ? (
                              <div className="flex flex-col items-center gap-1 text-slate-600">
                                <Music className="w-6 h-6" />
                                <span className="text-[10px] font-medium">Audio</span>
                              </div>
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                            )}
                            <span className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                            </span>
                          </button>
                        </div>

                        {/* Metadata & Controls */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {item.fileName}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.mediaType.toUpperCase()} · {formatBytes(item.sizeBytes)} ·{' '}
                                {FOLDER_ROLE_LABELS[item.folderRole]} · Discovered{' '}
                                {new Date(item.discoveredAt).toLocaleDateString()}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                                Drive ID: {item.driveFileId}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-xs font-semibold ${
                                  item.isPublished
                                    ? 'text-emerald-700'
                                    : item.processingStatus === 'failed'
                                      ? 'text-rose-700'
                                      : 'text-slate-600'
                                }`}
                              >
                                {item.isPublished
                                  ? 'Published Live'
                                  : item.processingStatus === 'ready'
                                    ? 'Copied (Unpublished)'
                                    : item.processingStatus === 'failed'
                                      ? 'Transfer Failed'
                                      : 'Unpublished'}
                              </span>

                              <button
                                type="button"
                                onClick={() => void handleReorder(idx, -1)}
                                disabled={idx === 0}
                                aria-label="Move item up"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReorder(idx, 1)}
                                disabled={idx === filteredDriveItems.length - 1}
                                aria-label="Move item down"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Availability / Error warnings */}
                          {item.driveAvailability !== 'available' && (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              {item.driveAvailability === 'deleted_in_drive'
                                ? 'This file was moved or deleted from the assigned Google Drive folder.'
                                : item.driveAvailability === 'unavailable_permission'
                                  ? 'Google Drive permission error accessing this file.'
                                  : `Unsupported file type (${item.mimeType}).`}
                            </p>
                          )}

                          {item.processingError && (
                            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                              {item.processingError}
                            </p>
                          )}

                          {(busyLabel ||
                            item.processingStatus === 'downloading' ||
                            item.processingStatus === 'uploading') && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>{busyLabel || 'Importing media...'}</span>
                              </p>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-slate-900 transition-all duration-300"
                                  style={{
                                    width: `${Math.max(25, item.processingProgress || 40)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Section & Caption Controls */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Website Section
                              </label>
                              <select
                                value={item.assignedSection}
                                disabled={Boolean(busyLabel) || item.mediaType === 'unsupported'}
                                onChange={(e) =>
                                  void handleAssignSection(
                                    item,
                                    e.target.value as AssignedMediaSection
                                  )
                                }
                                className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                              >
                                {compatibleSections.map((sec) => (
                                  <option key={sec} value={sec}>
                                    {SECTION_LABELS[sec]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Caption / Title (English)
                              </label>
                              <input
                                type="text"
                                value={captionDraft.captionEn}
                                onChange={(e) =>
                                  setCaptionDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...captionDraft,
                                      captionEn: e.target.value,
                                    },
                                  }))
                                }
                                onBlur={() => void handleSaveCaptions(item)}
                                className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Caption / Title (Malayalam)
                              </label>
                              <input
                                type="text"
                                value={captionDraft.captionMl}
                                onChange={(e) =>
                                  setCaptionDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...captionDraft,
                                      captionMl: e.target.value,
                                    },
                                  }))
                                }
                                onBlur={() => void handleSaveCaptions(item)}
                                className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                              />
                            </div>
                          </div>

                          {/* Object Storage & Publish Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="text-[11px] text-slate-500">
                              {item.publishedUrl ? (
                                <span className="inline-flex items-center gap-2">
                                  <span>
                                    Stored on{' '}
                                    <strong className="text-slate-700 uppercase">
                                      {item.storageProvider}
                                    </strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyUrl(item.id, item.publishedUrl!)
                                    }
                                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 underline cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>
                                      {copiedId === item.id ? 'Copied CDN URL' : 'Copy URL'}
                                    </span>
                                  </button>
                                </span>
                              ) : (
                                <span>Not copied to Object Storage yet</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>

                              {!item.isPublished ? (
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(busyLabel) ||
                                    item.mediaType === 'unsupported' ||
                                    item.assignedSection === 'unassigned'
                                  }
                                  onClick={() => void handleApproveAndPublish(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 disabled:opacity-45 cursor-pointer"
                                >
                                  {item.processingStatus === 'failed' ? (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  ) : (
                                    <Rocket className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {item.processingStatus === 'failed'
                                      ? 'Retry Transfer & Publish'
                                      : item.publishedUrl
                                        ? 'Publish Live'
                                        : 'Approve & Publish'}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={Boolean(busyLabel)}
                                  onClick={() => void handleUnpublish(item)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                                >
                                  <span>Unpublish</span>
                                </button>
                              )}

                              {item.publishedUrl && (
                                <button
                                  type="button"
                                  disabled={Boolean(busyLabel)}
                                  onClick={() => setRemoveStorageTarget(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer"
                                >
                                  <span>Remove Copied File</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={Boolean(busyLabel)}
                                onClick={() => setDeleteRecordTarget(item)}
                                aria-label={`Remove ${item.fileName} from CMS`}
                                className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      ) : (
        /* Direct CMS Uploads Tab (preserves Phase 2 MediaLibraryEditor capabilities) */
        <SectionCard
          title="Direct CMS Media Uploads"
          description="Photos, videos, and music files uploaded directly from your device."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {mediaLibrary.length > 0 && onClearAllMedia && (
                <button
                  type="button"
                  onClick={() => setClearAllModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Uploads ({mediaLibrary.length})</span>
                </button>
              )}
              <FileUploadButton
                accept="image/*,video/*,audio/*"
                label="Upload Media File"
                onUpload={async (file) => {
                  await onUploadMedia(file);
                }}
              />
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {(['all', 'photo', 'video', 'audio'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setUploadFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                  uploadFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {visibleUploads.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">
                Direct CMS Media Uploads is clean and empty
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No direct upload files in this category. Wedding photos and videos approved from the Google Drive Library are active on the website.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleUploads.map((asset) => (
                <div
                  key={asset.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col justify-between"
                >
                  <div className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {asset.type === 'photo' ? (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === 'audio' ? (
                      <audio src={asset.url} controls className="w-full px-3" />
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover opacity-85"
                      />
                    )}
                  </div>

                  <div className="p-3.5 space-y-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {asset.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {asset.type.toUpperCase()} · {asset.source}
                      {asset.sizeBytes > 0
                        ? ` · ${Math.round(asset.sizeBytes / 1024)} KB`
                        : ''}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(asset.id, asset.url)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === asset.id ? 'Copied URL' : 'Copy URL'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteAssetTarget(asset)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Drive Media Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.fileName}
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {previewItem.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {previewItem.publishedUrl
                    ? `Previewing Object Storage (${previewItem.storageProvider})`
                    : 'Previewing securely via Google Drive server proxy (Unpublished)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[70vh]">
              {(() => {
                const src = resolvePreviewUrl(previewItem);
                if (!src) {
                  return (
                    <p className="text-xs text-slate-300">
                      Preview unavailable. Reconnect Google Drive if your session expired.
                    </p>
                  );
                }
                if (previewItem.mediaType === 'photo') {
                  return (
                    <img
                      src={src}
                      alt={previewItem.fileName}
                      className="max-h-[65vh] w-auto object-contain rounded"
                    />
                  );
                }
                if (previewItem.mediaType === 'video') {
                  return (
                    <video
                      src={src}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-[65vh] rounded"
                    />
                  );
                }
                if (previewItem.mediaType === 'audio') {
                  return <audio src={src} controls autoPlay className="w-full max-w-md" />;
                }
                return (
                  <p className="text-xs text-slate-300">
                    Unsupported file format ({previewItem.mimeType}).
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Copied Storage Asset */}
      <ConfirmDialog
        open={Boolean(removeStorageTarget)}
        title="Remove Copied Media from Object Storage?"
        message={`This deletes the published copy of "${removeStorageTarget?.fileName || 'this file'}" from Object Storage and unpublishes it from the public website. Your original file in Google Drive will NOT be deleted.`}
        confirmLabel="Remove Copied File"
        destructive
        loading={confirmBusy}
        onCancel={() => setRemoveStorageTarget(null)}
        onConfirm={() => void handleConfirmRemoveStorage()}
      />

      {/* Confirm Delete Drive Discovery Record */}
      <ConfirmDialog
        open={Boolean(deleteRecordTarget)}
        title="Remove Entry from Media Library?"
        message={`Remove "${deleteRecordTarget?.fileName || 'this entry'}" and any copied storage asset from the CMS? Your original Google Drive file will NOT be deleted.`}
        confirmLabel="Remove from CMS"
        destructive
        loading={confirmBusy}
        onCancel={() => setDeleteRecordTarget(null)}
        onConfirm={() => void handleConfirmDeleteRecord()}
      />

      {/* Confirm Delete Direct Upload */}
      <ConfirmDialog
        open={Boolean(deleteAssetTarget)}
        title="Delete Media Asset?"
        message={`Permanently delete "${deleteAssetTarget?.name || 'this file'}" from storage?`}
        confirmLabel="Delete Permanently"
        destructive
        loading={deletingAsset}
        onCancel={() => setDeleteAssetTarget(null)}
        onConfirm={async () => {
          if (!deleteAssetTarget) return;
          setDeletingAsset(true);
          try {
            await onDeleteMedia(deleteAssetTarget.id);
          } finally {
            setDeletingAsset(false);
            setDeleteAssetTarget(null);
          }
        }}
      />

      {/* Confirm Clear All Direct CMS Media Uploads */}
      <ConfirmDialog
        open={clearAllModalOpen}
        title="Clear All Direct CMS Media Uploads?"
        message={`Are you sure you want to delete all ${mediaLibrary.length} file(s) from Direct CMS Media Uploads? This will permanently remove all direct uploads from storage. Files in your Google Drive Library will NOT be affected.`}
        confirmLabel="Clear All Uploads"
        destructive
        loading={clearingAll}
        onCancel={() => setClearAllModalOpen(false)}
        onConfirm={async () => {
          if (!onClearAllMedia) return;
          setClearingAll(true);
          try {
            await onClearAllMedia();
            setClearAllModalOpen(false);
          } catch (err) {
            handleApiError(err);
          } finally {
            setClearingAll(false);
          }
        }}
      />
    </div>
  );
}
