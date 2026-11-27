import {useState} from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Plus,
  Rocket,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  GalleryPhoto,
  GalleryVideo,
  Language,
  WeddingConfig,
  WebsiteSectionConfig,
} from '../../../types/wedding';
import type {MediaAsset, PublicationState} from '../../../types/admin';
import {
  ConfirmDialog,
  FileUploadButton,
  LocalizedInput,
  LocalizedTextarea,
  SaveActionBar,
  SectionCard,
  ToggleSwitch,
} from '../AdminPrimitives';

interface SectionSaveHandler {
  onSaveDraft: (
    nextConfig: WeddingConfig,
    sectionLabel: string,
    summary: string
  ) => Promise<void>;
}

/* ============================================================================
 * 5. PHOTO GALLERY EDITOR
 * ========================================================================== */
export function PhotoGalleryEditor({
  draftConfig,
  onUploadMedia,
  onSaveDraft,
}: {
  draftConfig: WeddingConfig;
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(() =>
    structuredClone(draftConfig.media.photos)
  );
  const [previewPhoto, setPreviewPhoto] = useState<GalleryPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryPhoto | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatePhoto = (id: string, updater: (p: GalleryPhoto) => GalleryPhoto) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
    setDirty(true);
    setSavedNotice(null);
  };

  const movePhoto = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const copy = [...photos];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setPhotos(copy.map((p, i) => ({...p, order: i + 1})));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {
          ...draftConfig,
          media: {...draftConfig.media, photos},
        },
        'Photo Gallery',
        `Updated ${photos.length} gallery photographs.`
      );
      setDirty(false);
      setSavedNotice('Photo gallery changes saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Photo Gallery"
        description="Upload photographs, edit captions, reorder tiles, and publish or hide individual images."
        actions={
          <FileUploadButton
            accept="image/*"
            label="Upload Photo"
            onUpload={async (file) => {
              const asset = await onUploadMedia(file);
              const newItem: GalleryPhoto = {
                id: `photo-${Date.now()}`,
                src: asset.url,
                alt: {en: asset.name, ml: asset.name},
                caption: {en: asset.name, ml: asset.name},
                description: {en: '', ml: ''},
                aspect: 'landscape',
                order: photos.length + 1,
                visible: true,
                status: 'approved',
                source: asset.source === 'supabase' ? 'supabase' : 'local',
                isPlaceholder: false,
              };
              setPhotos((prev) => [...prev, newItem]);
              setDirty(true);
            }}
          />
        }
      >
        <div className="space-y-5">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="border border-slate-200 rounded-xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-50/40"
            >
              <div className="space-y-2">
                <img
                  src={photo.src}
                  alt={photo.alt.en}
                  className="w-full h-40 object-cover rounded-lg border border-slate-200 bg-slate-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <select
                    value={photo.aspect}
                    onChange={(e) =>
                      updatePhoto(photo.id, (p) => ({
                        ...p,
                        aspect: e.target.value as GalleryPhoto['aspect'],
                      }))
                    }
                    aria-label="Aspect ratio"
                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                    <option value="square">Square</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-3 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    Photo #{index + 1} {photo.isPlaceholder ? '· Sample Placeholder' : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => movePhoto(index, -1)}
                      disabled={index === 0}
                      aria-label="Move photo up"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(index, 1)}
                      disabled={index === photos.length - 1}
                      aria-label="Move photo down"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updatePhoto(photo.id, (p) => ({
                          ...p,
                          visible: p.visible === false,
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {photo.visible !== false ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Published</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(photo)}
                      aria-label="Delete photo"
                      className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <LocalizedInput
                  label="Caption"
                  value={photo.caption}
                  onChange={(next) =>
                    updatePhoto(photo.id, (p) => ({
                      ...p,
                      caption: next,
                      alt: next,
                      isPlaceholder: false,
                    }))
                  }
                />
                <LocalizedInput
                  label="Description (Optional)"
                  value={photo.description || {en: '', ml: ''}}
                  onChange={(next) =>
                    updatePhoto(photo.id, (p) => ({...p, description: next}))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />

      {previewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-white rounded-xl overflow-hidden p-4 space-y-3"
          >
            <img
              src={previewPhoto.src}
              alt={previewPhoto.alt.en}
              className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-100"
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-900">
                {previewPhoto.caption.en}
              </p>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Photo from Gallery?"
        message={`Remove "${deleteTarget?.caption.en || 'this photo'}" from the wedding photo gallery?`}
        confirmLabel="Delete Photo"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDirty(true);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/* ============================================================================
 * 6. VIDEO GALLERY EDITOR
 * ========================================================================== */
export function VideoGalleryEditor({
  draftConfig,
  onUploadMedia,
  onSaveDraft,
}: {
  draftConfig: WeddingConfig;
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [videos, setVideos] = useState<GalleryVideo[]>(() =>
    structuredClone(draftConfig.media.videos)
  );
  const [previewVideo, setPreviewVideo] = useState<GalleryVideo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryVideo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateVideo = (id: string, updater: (v: GalleryVideo) => GalleryVideo) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? updater(v) : v)));
    setDirty(true);
    setSavedNotice(null);
  };

  const addVideo = () => {
    setVideos((prev) => [
      ...prev,
      {
        id: `vid-${Date.now()}`,
        title: {en: 'New Wedding Film', ml: 'പുതിയ വീഡിയോ'},
        caption: {en: '', ml: ''},
        duration: '01:30',
        posterUrl: draftConfig.hero.fallbackImageUrl,
        videoUrl: null,
        order: prev.length + 1,
        visible: true,
        status: 'approved',
        source: 'local',
        isPlaceholder: false,
      },
    ]);
    setDirty(true);
  };

  const moveVideo = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= videos.length) return;
    const copy = [...videos];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setVideos(copy.map((v, i) => ({...v, order: i + 1})));
    setDirty(true);
  };

  const handleSave = async () => {
    if (videos.some((v) => !v.title.en.trim())) {
      setError('Every video requires an English title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {
          ...draftConfig,
          media: {...draftConfig.media, videos},
        },
        'Video Gallery',
        `Updated ${videos.length} wedding film entries.`
      );
      setDirty(false);
      setSavedNotice('Video gallery changes saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Video Gallery"
        description="Upload MP4/WebM videos or paste hosted video links, update poster thumbnails, reorder, and toggle visibility."
        actions={
          <button
            type="button"
            onClick={addVideo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Video</span>
          </button>
        }
      >
        <div className="space-y-5">
          {videos.map((vid, index) => (
            <div
              key={vid.id}
              className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 bg-slate-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  Video #{index + 1}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewVideo(vid)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveVideo(index, -1)}
                    disabled={index === 0}
                    aria-label="Move video up"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveVideo(index, 1)}
                    disabled={index === videos.length - 1}
                    aria-label="Move video down"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateVideo(vid.id, (v) => ({
                        ...v,
                        visible: v.visible === false,
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    {vid.visible !== false ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Published</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vid)}
                    aria-label="Delete video"
                    className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <LocalizedInput
                label="Video Title"
                required
                value={vid.title}
                onChange={(next) =>
                  updateVideo(vid.id, (v) => ({...v, title: next, isPlaceholder: false}))
                }
              />
              <LocalizedInput
                label="Caption / Description"
                value={vid.caption}
                onChange={(next) => updateVideo(vid.id, (v) => ({...v, caption: next}))}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Video Stream URL (MP4/WebM)
                  </label>
                  <input
                    type="url"
                    value={vid.videoUrl || ''}
                    onChange={(e) =>
                      updateVideo(vid.id, (v) => ({
                        ...v,
                        videoUrl: e.target.value.trim() || null,
                      }))
                    }
                    placeholder="https://... or upload below"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={vid.duration}
                    onChange={(e) =>
                      updateVideo(vid.id, (v) => ({...v, duration: e.target.value}))
                    }
                    className="w-full px-3 py-2 text-sm tabular-nums border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <FileUploadButton
                  accept="video/*"
                  label="Upload Video File"
                  onUpload={async (file) => {
                    const asset = await onUploadMedia(file);
                    updateVideo(vid.id, (v) => ({
                      ...v,
                      videoUrl: asset.url,
                      isPlaceholder: false,
                    }));
                  }}
                />
                <FileUploadButton
                  accept="image/*"
                  label="Upload Poster Image"
                  onUpload={async (file) => {
                    const asset = await onUploadMedia(file);
                    updateVideo(vid.id, (v) => ({...v, posterUrl: asset.url}));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />

      {previewVideo && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewVideo(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-white rounded-xl overflow-hidden p-4 space-y-3"
          >
            {previewVideo.videoUrl ? (
              <video
                src={previewVideo.videoUrl}
                poster={previewVideo.posterUrl}
                controls
                className="w-full aspect-video rounded-lg bg-slate-900"
              />
            ) : (
              <img
                src={previewVideo.posterUrl}
                alt={previewVideo.title.en}
                className="w-full aspect-video object-cover rounded-lg"
              />
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-900">
                {previewVideo.title.en}{' '}
                {!previewVideo.videoUrl && '(Poster Preview — No video URL linked yet)'}
              </p>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Video?"
        message={`Remove "${deleteTarget?.title.en || 'this video'}" from the video gallery?`}
        confirmLabel="Delete Video"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
            setDirty(true);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/* ============================================================================
 * 7. MEDIA LIBRARY EDITOR
 * ========================================================================== */
export function MediaLibraryEditor({
  mediaLibrary,
  onUploadMedia,
  onDeleteMedia,
}: {
  mediaLibrary: MediaAsset[];
  onUploadMedia: (file: File) => Promise<MediaAsset>;
  onDeleteMedia: (assetId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<'all' | 'photo' | 'video' | 'audio'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleAssets = mediaLibrary.filter(
    (a) => filter === 'all' || a.type === filter
  );

  const handleCopy = (asset: MediaAsset) => {
    navigator.clipboard?.writeText(asset.url);
    setCopiedId(asset.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Media Library"
        description="Central library of uploaded photos, videos, and music files."
        actions={
          <FileUploadButton
            accept="image/*,video/*,audio/*"
            label="Upload Media File"
            onUpload={async (file) => {
              await onUploadMedia(file);
            }}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['all', 'photo', 'video', 'audio'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {visibleAssets.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No media files in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleAssets.map((asset) => (
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
                      onClick={() => handleCopy(asset)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === asset.id ? 'Copied URL' : 'Copy URL'}</span>
                    </button>

                    {asset.source !== 'builtin' && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(asset)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Media Asset?"
        message={`Permanently delete "${deleteTarget?.name || 'this file'}" from storage?`}
        confirmLabel="Delete Permanently"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await onDeleteMedia(deleteTarget.id);
          } finally {
            setDeleting(false);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

/* ============================================================================
 * 8. BACKGROUND MUSIC EDITOR
 * ========================================================================== */
export function BackgroundMusicEditor({
  draftConfig,
  mediaLibrary,
  onUploadMedia,
  onSaveDraft,
}: {
  draftConfig: WeddingConfig;
  mediaLibrary: MediaAsset[];
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [musicEnabled, setMusicEnabled] = useState<boolean>(
    draftConfig.media.musicEnabled !== false
  );
  const [musicUrl, setMusicUrl] = useState<string>(draftConfig.media.musicUrl || '');
  const [musicTitle, setMusicTitle] = useState(draftConfig.media.musicTitle);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioAssets = mediaLibrary.filter((a) => a.type === 'audio');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {
          ...draftConfig,
          media: {
            ...draftConfig.media,
            musicEnabled,
            musicUrl: musicUrl.trim() || null,
            musicTitle,
          },
        },
        'Background Music',
        `Updated background music (${musicEnabled ? 'Enabled' : 'Disabled'}).`
      );
      setDirty(false);
      setSavedNotice('Background music settings saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Background Wedding Music"
        description="Upload an MP3/WAV track, choose from uploaded audio, or use the built-in classical temple ambience."
      >
        <div className="space-y-5">
          <ToggleSwitch
            label="Enable Background Music"
            description="When enabled, music starts gently when the visitor clicks Open Invitation."
            checked={musicEnabled}
            onChange={(checked) => {
              setMusicEnabled(checked);
              setDirty(true);
            }}
          />

          <LocalizedInput
            label="Track Display Title"
            value={musicTitle}
            onChange={(next) => {
              setMusicTitle(next);
              setDirty(true);
            }}
          />

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Audio File URL (Leave empty to use built-in synthesized Kerala ambience)
            </label>
            <input
              type="text"
              value={musicUrl}
              onChange={(e) => {
                setMusicUrl(e.target.value);
                setDirty(true);
              }}
              placeholder="Built-in Classical Kerala Temple Ambience"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <FileUploadButton
                accept="audio/*"
                label="Upload Audio File (MP3/WAV)"
                onUpload={async (file) => {
                  const asset = await onUploadMedia(file);
                  setMusicUrl(asset.url);
                  setDirty(true);
                }}
              />
              {musicUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setMusicUrl('');
                    setDirty(true);
                  }}
                  className="text-xs text-slate-600 hover:underline cursor-pointer"
                >
                  Reset to Built-in Temple Ambience
                </button>
              )}
            </div>
          </div>

          {audioAssets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Select Uploaded Audio from Media Library
              </label>
              <select
                value={musicUrl}
                onChange={(e) => {
                  setMusicUrl(e.target.value);
                  setDirty(true);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Built-in Classical Kerala Temple Ambience</option>
                {audioAssets.map((a) => (
                  <option key={a.id} value={a.url}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {musicUrl && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-2">Audio Preview</p>
              <audio src={musicUrl} controls className="w-full max-w-md" />
            </div>
          )}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 9. WEBSITE SECTIONS EDITOR
 * ========================================================================== */
export function WebsiteSectionsEditor({
  draftConfig,
  onSaveDraft,
}: {draftConfig: WeddingConfig} & SectionSaveHandler) {
  const [sections, setSections] = useState<WebsiteSectionConfig[]>(() =>
    structuredClone(draftConfig.sections || [])
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setSections(copy.map((s, i) => ({...s, order: i + 1})));
    setDirty(true);
  };

  const updateSection = (
    key: WebsiteSectionConfig['key'],
    updater: (s: WebsiteSectionConfig) => WebsiteSectionConfig
  ) => {
    setSections((prev) => prev.map((s) => (s.key === key ? updater(s) : s)));
    setDirty(true);
    setSavedNotice(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {...draftConfig, sections},
        'Website Sections',
        'Updated section visibility, headings, and display order.'
      );
      setDirty(false);
      setSavedNotice('Website section settings saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Website Sections & Layout Order"
        description="Enable or disable optional sections, customize headings, and reorder how sections appear."
      >
        <div className="space-y-4">
          {sections.map((sec, index) => (
            <div
              key={sec.key}
              className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-semibold text-slate-900 capitalize">
                    {sec.key} Section
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    aria-label="Move section up"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sections.length - 1}
                    aria-label="Move section down"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSection(sec.key, (s) => ({...s, enabled: !s.enabled}))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      sec.enabled
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    {sec.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              <LocalizedInput
                label="Section Heading"
                value={sec.heading}
                onChange={(next) =>
                  updateSection(sec.key, (s) => ({...s, heading: next}))
                }
              />

              {sec.subtitle && (
                <LocalizedInput
                  label="Section Subtitle"
                  value={sec.subtitle}
                  onChange={(next) =>
                    updateSection(sec.key, (s) => ({...s, subtitle: next}))
                  }
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 10. LANGUAGE MANAGEMENT EDITOR
 * ========================================================================== */
export function LanguageManagementEditor({
  draftConfig,
  onSaveDraft,
}: {draftConfig: WeddingConfig} & SectionSaveHandler) {
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(
    draftConfig.languageSettings?.defaultLanguage || 'en'
  );
  const [malayalamEnabled, setMalayalamEnabled] = useState<boolean>(
    draftConfig.languageSettings?.malayalamEnabled !== false
  );
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState<boolean>(
    draftConfig.languageSettings?.showLanguageSwitcher !== false
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {
          ...draftConfig,
          languageSettings: {
            defaultLanguage: malayalamEnabled ? defaultLanguage : 'en',
            malayalamEnabled,
            showLanguageSwitcher: malayalamEnabled && showLanguageSwitcher,
          },
        },
        'Language Management',
        'Updated default language and Malayalam availability.'
      );
      setDirty(false);
      setSavedNotice('Language preferences saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Language Management"
        description="Control English and Malayalam availability and default visitor language."
      >
        <div className="space-y-5">
          <ToggleSwitch
            label="Enable Malayalam Translation Support"
            description="Allow visitors to view the wedding invitation in Malayalam (മലയാളം)."
            checked={malayalamEnabled}
            onChange={(checked) => {
              setMalayalamEnabled(checked);
              if (!checked) setDefaultLanguage('en');
              setDirty(true);
            }}
          />
          <ToggleSwitch
            label="Show Language Switcher in Header & Cover"
            description="Hide if you prefer a single-language invitation."
            checked={malayalamEnabled && showLanguageSwitcher}
            onChange={(checked) => {
              setShowLanguageSwitcher(checked);
              setDirty(true);
            }}
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Default Initial Language
            </label>
            <select
              value={malayalamEnabled ? defaultLanguage : 'en'}
              disabled={!malayalamEnabled}
              onChange={(e) => {
                setDefaultLanguage(e.target.value as Language);
                setDirty(true);
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="en">English</option>
              <option value="ml">Malayalam (മലയാളം)</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 11. SOCIAL SHARING SETTINGS EDITOR
 * ========================================================================== */
export function SocialSharingEditor({
  draftConfig,
  onUploadMedia,
  onSaveDraft,
}: {
  draftConfig: WeddingConfig;
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [title, setTitle] = useState(draftConfig.socialSharing?.title || '');
  const [description, setDescription] = useState(
    draftConfig.socialSharing?.description || ''
  );
  const [imageUrl, setImageUrl] = useState(
    draftConfig.socialSharing?.imageUrl || draftConfig.hero.fallbackImageUrl
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {
          ...draftConfig,
          socialSharing: {
            title,
            description,
            imageUrl,
            siteName: `${draftConfig.couple.bride.nickname.en} & ${draftConfig.couple.groom.nickname.en} Wedding`,
          },
        },
        'Social Sharing',
        'Updated WhatsApp and OpenGraph social preview metadata.'
      );
      setDirty(false);
      setSavedNotice('Social sharing settings saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="WhatsApp & Social Sharing Settings"
        description="Configure how the invitation link preview appears when shared on WhatsApp and social platforms."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Share Preview Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Share Preview Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <FileUploadButton
              accept="image/*"
              label="Upload Social Preview Image"
              onUpload={async (file) => {
                const asset = await onUploadMedia(file);
                setImageUrl(asset.url);
                setDirty(true);
              }}
            />
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              WhatsApp Link Card Preview
            </p>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <img
                src={imageUrl}
                alt="Social preview"
                className="w-full h-44 object-cover"
              />
              <div className="p-3.5 space-y-1">
                <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                  {title || 'Wedding Invitation'}
                </p>
                <p className="text-xs text-slate-600 line-clamp-2">{description}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 12. FOOTER SETTINGS EDITOR
 * ========================================================================== */
export function FooterSettingsEditor({
  draftConfig,
  onSaveDraft,
}: {draftConfig: WeddingConfig} & SectionSaveHandler) {
  const [footer, setFooter] = useState(() => structuredClone(draftConfig.footer));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {...draftConfig, footer},
        'Footer Settings',
        'Updated footer blessing, hosts line, and credit preferences.'
      );
      setDirty(false);
      setSavedNotice('Footer settings saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Footer Settings"
        description="Configure closing blessings, family sign-off, and optional maker credit."
      >
        <div className="space-y-5">
          <LocalizedTextarea
            label="Closing Blessing Quote"
            value={footer.blessingQuote}
            onChange={(next) => {
              setFooter({...footer, blessingQuote: next});
              setDirty(true);
            }}
            rows={2}
          />
          <LocalizedInput
            label="Family Hosts Sign-Off"
            value={footer.hostsLine}
            onChange={(next) => {
              setFooter({...footer, hostsLine: next});
              setDirty(true);
            }}
          />
          <ToggleSwitch
            label="Display Couple Names & Wedding Date in Footer"
            checked={footer.showDateAndNames !== false}
            onChange={(checked) => {
              setFooter({...footer, showDateAndNames: checked});
              setDirty(true);
            }}
          />
          <ToggleSwitch
            label='Show "Made with love by [Your Name]" Credit'
            checked={Boolean(footer.showCredit)}
            onChange={(checked) => {
              setFooter({...footer, showCredit: checked});
              setDirty(true);
            }}
          />
          {footer.showCredit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Creator Name
                </label>
                <input
                  type="text"
                  value={footer.creditName || ''}
                  onChange={(e) => {
                    setFooter({...footer, creditName: e.target.value});
                    setDirty(true);
                  }}
                  placeholder="Your Name"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Optional Portfolio Link
                </label>
                <input
                  type="url"
                  value={footer.creditUrl || ''}
                  onChange={(e) => {
                    setFooter({...footer, creditUrl: e.target.value});
                    setDirty(true);
                  }}
                  placeholder="https://yourportfolio.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 13. PUBLISH SETTINGS EDITOR
 * ========================================================================== */
export function PublishSettingsEditor({
  publication,
  onOpenPreview,
  onOpenPublic,
  onPublish,
  onUnpublish,
  onDiscardDraft,
}: {
  publication: PublicationState;
  onOpenPreview: () => void;
  onOpenPublic: () => void;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onDiscardDraft: () => Promise<void>;
}) {
  const [confirmAction, setConfirmAction] = useState<
    'publish' | 'unpublish' | 'discard' | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runConfirmed = async () => {
    if (!confirmAction) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      if (confirmAction === 'publish') {
        await onPublish();
        setStatusMessage('Published! Your saved draft is now live on the public website.');
      } else if (confirmAction === 'unpublish') {
        await onUnpublish();
        setStatusMessage('Public website unpublished. Visitors now see the coming-soon notice.');
      } else if (confirmAction === 'discard') {
        await onDiscardDraft();
        setStatusMessage('Unpublished draft edits discarded.');
      }
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Publication & Version Control"
        description="Draft edits remain private until you explicitly publish them. Always preview before publishing."
      >
        <div className="space-y-6">
          {statusMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
              <p className="text-xs font-medium text-slate-500">Public Website Status</p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <span>
                  {publication.status === 'published'
                    ? 'Live & Published'
                    : 'Unpublished (Holding Page)'}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {publication.publishedAt
                  ? `Last published: ${new Date(publication.publishedAt).toLocaleString()}`
                  : 'Not published yet'}
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
              <p className="text-xs font-medium text-slate-500">Draft Sync Status</p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900 flex items-center gap-2">
                {publication.hasUnpublishedChanges ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Unpublished Draft Changes</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Public Matches Saved Draft</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                Last draft save: {new Date(publication.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer min-h-[42px]"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Saved Draft</span>
            </button>

            <button
              type="button"
              onClick={onOpenPublic}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer min-h-[42px]"
            >
              <Globe className="w-4 h-4" />
              <span>View Live Public Site</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmAction('publish')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer min-h-[42px]"
            >
              <Rocket className="w-4 h-4" />
              <span>Publish Draft to Live Website</span>
            </button>

            {publication.status === 'published' && (
              <button
                type="button"
                onClick={() => setConfirmAction('unpublish')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-medium hover:bg-rose-50 cursor-pointer min-h-[42px]"
              >
                <EyeOff className="w-4 h-4" />
                <span>Unpublish Website</span>
              </button>
            )}

            {publication.hasUnpublishedChanges && (
              <button
                type="button"
                onClick={() => setConfirmAction('discard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Discard Draft Edits</span>
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'publish'
            ? 'Publish Draft Changes?'
            : confirmAction === 'unpublish'
              ? 'Unpublish Public Wedding Website?'
              : 'Discard Unpublished Draft Changes?'
        }
        message={
          confirmAction === 'publish'
            ? 'All saved draft changes will immediately become visible to guests visiting your public invitation URL.'
            : confirmAction === 'unpublish'
              ? 'Guests visiting the public URL will see a calm "Invitation Coming Soon" page until you publish again.'
              : 'Your unpublished draft edits will be overwritten by the currently published version.'
        }
        confirmLabel={
          confirmAction === 'publish'
            ? 'Confirm & Publish'
            : confirmAction === 'unpublish'
              ? 'Confirm Unpublish'
              : 'Discard Draft'
        }
        destructive={confirmAction !== 'publish'}
        loading={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
}
