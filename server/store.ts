import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {weddingConfig as defaultWeddingConfig} from '../src/config/weddingConfig';
import type {WeddingConfig} from '../src/types/wedding';
import type {
  ActivityLogEntry,
  AdminDraftPayload,
  AdminOverviewData,
  AdminSectionId,
  MediaAsset,
  PublicWeddingPayload,
  SetupWizardState,
} from '../src/types/admin';
import {
  getMissingSupabaseVars,
  getSupabaseAdmin,
  isSupabaseConfigured,
  loadCmsFromSupabase,
  persistCmsToSupabase,
  uploadMediaToSupabaseStorage,
  type PersistedCmsDocument,
} from './supabase';
import {getPublishedDriveMediaForSite} from './driveStore';
import {classifyUploadMime, extensionForMime, isValidIsoDate, isValidSafeUrl} from './validation';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'wedding-store.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureStorageDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, {recursive: true});
  }
}

function createInitialSeedDocument(): PersistedCmsDocument {
  const now = new Date().toISOString();
  const cloned = structuredClone(defaultWeddingConfig);

  const initialMediaLibrary: MediaAsset[] = [];

  return {
    draftConfig: cloned,
    publishedConfig: structuredClone(cloned),
    publication: {
      status: 'published',
      hasUnpublishedChanges: false,
      publishedAt: now,
      updatedAt: now,
    },
    setupState: {
      completed: false,
      currentStep: 1,
      completedSteps: [],
      skippedSteps: [],
      lastSavedAt: null,
    },
    mediaLibrary: initialMediaLibrary,
    activityLog: [],
  };
}

function readLocalDocument(): PersistedCmsDocument {
  ensureStorageDirs();
  if (!fs.existsSync(STORE_FILE)) {
    const seed = createInitialSeedDocument();
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw) as PersistedCmsDocument;
  } catch {
    const seed = createInitialSeedDocument();
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

function writeLocalDocument(doc: PersistedCmsDocument): void {
  ensureStorageDirs();
  const tempPath = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(doc, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_FILE);
}

async function loadDocument(): Promise<PersistedCmsDocument> {
  const seed = createInitialSeedDocument();
  if (isSupabaseConfigured()) {
    const fromSupabase = await loadCmsFromSupabase(seed);
    if (fromSupabase) return fromSupabase;
  }
  return readLocalDocument();
}

async function saveDocument(
  doc: PersistedCmsDocument,
  newActivity?: ActivityLogEntry
): Promise<void> {
  if (isSupabaseConfigured()) {
    await persistCmsToSupabase(doc, newActivity);
    return;
  }
  writeLocalDocument(doc);
}

function getBackendStatus(): AdminOverviewData['backendStatus'] {
  const supabaseConfigured = isSupabaseConfigured();
  const missing = getMissingSupabaseVars();
  return {
    mode: supabaseConfigured ? 'supabase' : 'local',
    supabaseConfigured,
    supabaseMissingVars: missing,
    storageDescription: supabaseConfigured
      ? 'Connected to Supabase PostgreSQL, Auth & Storage.'
      : 'Supabase credentials are not configured. Persisting changes to server local file storage (data/wedding-store.json) until Supabase env vars are added.',
  };
}

function looksLikePlaceholder(text: string | undefined | null): boolean {
  if (!text || text.trim() === '') return true;
  return /placeholder|മാതൃക/i.test(text);
}

export async function getPublicWeddingPayload(): Promise<PublicWeddingPayload> {
  const doc = await loadDocument();
  if (doc.publication.status !== 'published') {
    return {
      publicationStatus: 'unpublished',
      config: null,
      publishedAt: doc.publication.publishedAt,
    };
  }

  const mergedConfig = structuredClone(doc.publishedConfig);
  const publishedDriveItems = await getPublishedDriveMediaForSite().catch(() => []);

  if (publishedDriveItems.length > 0) {
    // 1. Photo Gallery (approved + published Drive items appended after existing CMS photos)
    const existingPhotoUrls = new Set(mergedConfig.media.photos.map((p) => p.src));
    const maxPhotoOrder = mergedConfig.media.photos.reduce(
      (max, p) => Math.max(max, p.order ?? 0),
      0
    );
    const drivePhotos = publishedDriveItems
      .filter(
        (i) =>
          i.assignedSection === 'photo_gallery' &&
          i.mediaType === 'photo' &&
          Boolean(i.publishedUrl) &&
          !existingPhotoUrls.has(i.publishedUrl!)
      )
      .map((item, idx) => ({
        id: `drive-${item.id}`,
        src: item.publishedUrl!,
        alt: {
          en: item.captionEn || item.fileName,
          ml: item.captionMl || item.captionEn || item.fileName,
        },
        caption: {
          en: item.captionEn || item.fileName,
          ml: item.captionMl || item.captionEn || item.fileName,
        },
        aspect: 'landscape' as const,
        status: 'approved' as const,
        visible: true,
        order: maxPhotoOrder + (item.displayOrder || idx + 1),
        source:
          item.storageProvider === 'supabase'
            ? ('supabase' as const)
            : item.storageProvider === 'r2'
              ? ('r2' as const)
              : ('local' as const),
        isPlaceholder: false,
      }));
    if (drivePhotos.length > 0) {
      mergedConfig.media.photos = [...mergedConfig.media.photos, ...drivePhotos];
    }

    // 2. Video Gallery
    const existingVideoUrls = new Set(
      mergedConfig.media.videos.map((v) => v.videoUrl).filter(Boolean)
    );
    const maxVideoOrder = mergedConfig.media.videos.reduce(
      (max, v) => Math.max(max, v.order ?? 0),
      0
    );
    const driveVideos = publishedDriveItems
      .filter(
        (i) =>
          i.assignedSection === 'video_gallery' &&
          i.mediaType === 'video' &&
          Boolean(i.publishedUrl) &&
          !existingVideoUrls.has(i.publishedUrl!)
      )
      .map((item, idx) => ({
        id: `drive-${item.id}`,
        title: {
          en: item.captionEn || item.fileName,
          ml: item.captionMl || item.captionEn || item.fileName,
        },
        caption: {
          en: item.captionEn || item.fileName,
          ml: item.captionMl || item.captionEn || item.fileName,
        },
        duration: 'HD',
        posterUrl: '',
        videoUrl: item.publishedUrl!,
        status: 'approved' as const,
        visible: true,
        order: maxVideoOrder + (item.displayOrder || idx + 1),
        source:
          item.storageProvider === 'supabase'
            ? ('supabase' as const)
            : item.storageProvider === 'r2'
              ? ('r2' as const)
              : ('local' as const),
        isPlaceholder: false,
      }));
    if (driveVideos.length > 0) {
      mergedConfig.media.videos = [...mergedConfig.media.videos, ...driveVideos];
    }

    // 3. Hero Background Video (first published item by displayOrder)
    const heroVideo = publishedDriveItems.find(
      (i) =>
        i.assignedSection === 'hero_video' &&
        i.mediaType === 'video' &&
        Boolean(i.publishedUrl)
    );
    if (heroVideo?.publishedUrl) {
      mergedConfig.hero.backgroundVideoUrl = heroVideo.publishedUrl;
    }

    // 4. Background Music (first published audio track by displayOrder)
    const musicTrack = publishedDriveItems.find(
      (i) =>
        i.assignedSection === 'background_music' &&
        i.mediaType === 'audio' &&
        Boolean(i.publishedUrl)
    );
    if (musicTrack?.publishedUrl) {
      mergedConfig.media.musicEnabled = true;
      mergedConfig.media.musicUrl = musicTrack.publishedUrl;
      mergedConfig.media.musicTitle = {
        en: musicTrack.captionEn || musicTrack.fileName,
        ml: musicTrack.captionMl || musicTrack.captionEn || musicTrack.fileName,
      };
    }
  }

  return {
    publicationStatus: 'published',
    config: mergedConfig,
    publishedAt: doc.publication.publishedAt,
  };
}

export async function getAdminDraftPayload(): Promise<AdminDraftPayload> {
  const doc = await loadDocument();
  return {
    draftConfig: doc.draftConfig,
    publication: doc.publication,
    setupState: doc.setupState,
    mediaLibrary: doc.mediaLibrary,
    activityLog: doc.activityLog,
    backendStatus: getBackendStatus(),
  };
}

export async function getAdminOverview(): Promise<AdminOverviewData> {
  const doc = await loadDocument();
  const cfg = doc.draftConfig;
  const pub = doc.publishedConfig;

  const sectionsNeedingInfo: AdminOverviewData['sectionsNeedingInfo'] = [];

  const checklist: Array<{
    id: AdminSectionId;
    label: string;
    complete: boolean;
    reason: string;
  }> = [
    {
      id: 'wedding-details',
      label: 'Wedding Details & Venue',
      complete:
        !looksLikePlaceholder(cfg.venue.name.en) &&
        !looksLikePlaceholder(cfg.couple.bride.nickname.en) &&
        isValidIsoDate(cfg.dateAndTime.muhurthamIso),
      reason: 'Update sample couple nicknames, Muhurtham date, or venue placeholder text.',
    },
    {
      id: 'bride-profile',
      label: 'Bride Profile',
      complete:
        !looksLikePlaceholder(cfg.couple.bride.fullName.en) &&
        !looksLikePlaceholder(cfg.couple.bride.fatherName.en),
      reason: 'Replace sample placeholder bride name and family lineage.',
    },
    {
      id: 'groom-profile',
      label: 'Groom Profile',
      complete:
        !looksLikePlaceholder(cfg.couple.groom.fullName.en) &&
        !looksLikePlaceholder(cfg.couple.groom.fatherName.en),
      reason: 'Replace sample placeholder groom name and family lineage.',
    },
    {
      id: 'family-info',
      label: 'Family Information',
      complete:
        (cfg.familyMembers || []).length > 0 &&
        !(cfg.familyMembers || []).every((f) => looksLikePlaceholder(f.name.en)),
      reason: 'Add real family members or update sample entries.',
    },
    {
      id: 'events-schedule',
      label: 'Events & Schedule',
      complete:
        cfg.events.filter((e) => e.visible !== false).length > 0 &&
        !cfg.events.every((e) => looksLikePlaceholder(e.title.en)),
      reason: 'Customize ceremony timings and replace placeholder event titles.',
    },
    {
      id: 'photo-gallery',
      label: 'Photo Gallery',
      complete:
        cfg.media.photos.some((p) => p.visible !== false && !p.isPlaceholder),
      reason: 'Upload or select real wedding photographs to replace sample placeholders.',
    },
    {
      id: 'video-gallery',
      label: 'Video Gallery',
      complete: cfg.media.videos.some((v) => v.visible !== false && Boolean(v.videoUrl)),
      reason: 'Link or upload wedding highlight videos.',
    },
    {
      id: 'background-music',
      label: 'Background Music',
      complete: cfg.media.musicEnabled === false || Boolean(cfg.media.musicUrl),
      reason: 'Upload a custom audio track or confirm built-in temple ambience.',
    },
    {
      id: 'social-sharing',
      label: 'Social Sharing Settings',
      complete:
        Boolean(cfg.socialSharing?.title) &&
        Boolean(cfg.socialSharing?.description) &&
        Boolean(cfg.socialSharing?.imageUrl),
      reason: 'Configure WhatsApp & OpenGraph preview title and image.',
    },
    {
      id: 'footer-settings',
      label: 'Footer Settings',
      complete: !looksLikePlaceholder(cfg.footer.hostsLine.en),
      reason: 'Update family hosts sign-off line in Footer Settings.',
    },
  ];

  for (const item of checklist) {
    if (!item.complete) {
      sectionsNeedingInfo.push({
        id: item.id,
        label: item.label,
        reason: item.reason,
      });
    }
  }

  const completedChecklistCount = checklist.filter((c) => c.complete).length;
  const completionPercent = Math.round(
    (completedChecklistCount / checklist.length) * 100
  );

  const publishedPhotosCount =
    doc.publication.status === 'published'
      ? pub.media.photos.filter((p) => p.status === 'approved' && p.visible !== false).length
      : 0;
  const draftPhotosCount = cfg.media.photos.filter((p) => p.visible !== false).length;

  const publishedVideosCount =
    doc.publication.status === 'published'
      ? pub.media.videos.filter((v) => v.status === 'approved' && v.visible !== false).length
      : 0;
  const draftVideosCount = cfg.media.videos.filter((v) => v.visible !== false).length;

  return {
    publication: doc.publication,
    weddingDate: cfg.dateAndTime.displayDate.en,
    muhurthamIso: cfg.dateAndTime.muhurthamIso,
    coupleTitle: `${cfg.couple.bride.nickname.en} & ${cfg.couple.groom.nickname.en}`,
    completionPercent,
    completedChecklistCount,
    totalChecklistCount: checklist.length,
    publishedPhotosCount,
    draftPhotosCount,
    publishedVideosCount,
    draftVideosCount,
    visibleEventsCount: cfg.events.filter((e) => e.visible !== false).length,
    familyMembersCount: (cfg.familyMembers || []).filter((f) => f.visible).length,
    sectionsNeedingInfo,
    recentActivity: doc.activityLog.slice(0, 8),
    setupState: doc.setupState,
    backendStatus: getBackendStatus(),
  };
}

export function validateWeddingConfigUpdate(cfg: WeddingConfig): string | null {
  if (!cfg.couple?.bride?.nickname?.en?.trim() || !cfg.couple?.groom?.nickname?.en?.trim()) {
    return 'Bride and groom nicknames (English) are required.';
  }
  if (!cfg.couple?.bride?.fullName?.en?.trim() || !cfg.couple?.groom?.fullName?.en?.trim()) {
    return 'Bride and groom full names (English) are required.';
  }
  if (!isValidIsoDate(cfg.dateAndTime?.muhurthamIso)) {
    return 'Muhurtham date/time must be a valid ISO date.';
  }
  if (!isValidSafeUrl(cfg.venue?.googleMapsUrl)) {
    return 'Google Maps link must be a valid http(s) URL.';
  }
  if (!isValidSafeUrl(cfg.couple?.bride?.portraitUrl) || !isValidSafeUrl(cfg.couple?.groom?.portraitUrl)) {
    return 'Couple portrait URL must be a valid http(s) or local path.';
  }
  if (!isValidSafeUrl(cfg.hero?.backgroundVideoUrl) || !isValidSafeUrl(cfg.hero?.fallbackImageUrl)) {
    return 'Hero media URL must be a valid http(s) or local path.';
  }
  if (!isValidSafeUrl(cfg.media?.musicUrl)) {
    return 'Background music URL must be a valid http(s) or local path.';
  }
  if (!isValidSafeUrl(cfg.socialSharing?.imageUrl)) {
    return 'Social preview image URL must be a valid http(s) or local path.';
  }
  if (!isValidSafeUrl(cfg.footer?.creditUrl)) {
    return 'Footer portfolio URL must be a valid http(s) URL.';
  }
  for (const evt of cfg.events || []) {
    if (!isValidSafeUrl(evt.imageUrl)) {
      return `Event image URL for "${evt.title.en || evt.id}" is invalid.`;
    }
  }
  for (const photo of cfg.media?.photos || []) {
    if (!isValidSafeUrl(photo.src)) {
      return `Photo URL for "${photo.caption.en || photo.id}" is invalid.`;
    }
  }
  for (const video of cfg.media?.videos || []) {
    if (!isValidSafeUrl(video.videoUrl) || !isValidSafeUrl(video.posterUrl)) {
      return `Video URL for "${video.title.en || video.id}" is invalid.`;
    }
  }
  return null;
}

export async function updateDraftConfig(params: {
  draftConfig: WeddingConfig;
  setupState?: SetupWizardState;
  actorEmail: string;
  sectionLabel: string;
  summary: string;
}): Promise<AdminDraftPayload> {
  const validationError = validateWeddingConfigUpdate(params.draftConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  const doc = await loadDocument();
  const now = new Date().toISOString();

  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail: params.actorEmail,
    action: 'Updated draft',
    section: params.sectionLabel,
    summary: params.summary,
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    draftConfig: params.draftConfig,
    setupState: params.setupState
      ? {...params.setupState, lastSavedAt: now}
      : doc.setupState,
    publication: {
      ...doc.publication,
      hasUnpublishedChanges: true,
      updatedAt: now,
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);

  return {
    draftConfig: nextDoc.draftConfig,
    publication: nextDoc.publication,
    setupState: nextDoc.setupState,
    mediaLibrary: nextDoc.mediaLibrary,
    activityLog: nextDoc.activityLog,
    backendStatus: getBackendStatus(),
  };
}

export async function uploadMediaAsset(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  actorEmail: string;
}): Promise<MediaAsset> {
  const mediaType = classifyUploadMime(params.mimeType);
  if (!mediaType) {
    throw new Error(
      'Unsupported file format. Please upload JPEG/PNG/WebP images, MP4/WebM videos, or MP3/WAV/OGG audio.'
    );
  }
  if (params.buffer.length === 0 || params.buffer.length > 25 * 1024 * 1024) {
    throw new Error('File must be between 1 byte and 25 MB.');
  }

  const cleanBase = path
    .basename(params.originalName || 'asset')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
  const ext = path.extname(cleanBase) || extensionForMime(params.mimeType);
  const stem = path.basename(cleanBase, path.extname(cleanBase)) || 'media';
  const storedFilename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${stem}${ext}`;

  let finalUrl: string;
  let source: 'local' | 'supabase' = 'local';

  if (isSupabaseConfigured()) {
    const uploaded = await uploadMediaToSupabaseStorage(
      params.buffer,
      storedFilename,
      params.mimeType
    );
    finalUrl = uploaded.url;
    source = 'supabase';
  } else {
    ensureStorageDirs();
    const targetPath = path.resolve(UPLOADS_DIR, storedFilename);
    if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
      throw new Error('Invalid upload target path.');
    }
    fs.writeFileSync(targetPath, params.buffer);
    finalUrl = `/api/media/file/${encodeURIComponent(storedFilename)}`;
  }

  const now = new Date().toISOString();
  const asset: MediaAsset = {
    id: `media-${crypto.randomUUID()}`,
    name: cleanBase || storedFilename,
    type: mediaType,
    url: finalUrl,
    mimeType: params.mimeType,
    sizeBytes: params.buffer.length,
    source,
    createdAt: now,
  };

  const doc = await loadDocument();
  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail: params.actorEmail,
    action: 'Uploaded media',
    section: 'Media Library',
    summary: `Uploaded ${asset.type} "${asset.name}"`,
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    mediaLibrary: [asset, ...doc.mediaLibrary],
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);
  return asset;
}

export async function deleteMediaAsset(
  assetId: string,
  actorEmail: string
): Promise<MediaAsset[]> {
  const doc = await loadDocument();
  const target = doc.mediaLibrary.find((a) => a.id === assetId);

  if (target?.source === 'local' && target.url.startsWith('/api/media/file/')) {
    const rawName = decodeURIComponent(
      target.url.slice('/api/media/file/'.length)
    );
    const resolved = path.resolve(UPLOADS_DIR, path.basename(rawName));
    if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch (e) {
        console.warn('Failed to unlink local media file:', e);
      }
    }
  }

  // Delete from Supabase media_items table if configured
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('media_items').delete().eq('id', assetId);
    }
  }

  const now = new Date().toISOString();
  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail,
    action: 'Deleted media',
    section: 'Media Library',
    summary: `Removed "${target?.name || assetId}" from Media Library`,
    createdAt: now,
  };

  const nextLibrary = doc.mediaLibrary.filter((a) => a.id !== assetId);
  const nextDoc: PersistedCmsDocument = {
    ...doc,
    mediaLibrary: nextLibrary,
    draftConfig: {
      ...doc.draftConfig,
      media: {
        ...doc.draftConfig.media,
        photos: doc.draftConfig.media.photos.filter((p) => p.id !== assetId && (target ? p.src !== target.url : true)),
        videos: doc.draftConfig.media.videos.filter(
          (v) => v.id !== assetId && (target ? v.videoUrl !== target.url && v.posterUrl !== target.url : true)
        ),
      },
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);
  return nextLibrary;
}

export async function clearAllMediaAssets(
  actorEmail: string
): Promise<MediaAsset[]> {
  const doc = await loadDocument();

  // 1. Delete all local upload files from disk
  if (fs.existsSync(UPLOADS_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.warn('Failed to clear uploads directory:', e);
    }
  }

  // 2. Clear all media_items records from Supabase Postgres
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const {data: siteRow} = await supabase
        .from('wedding_sites')
        .select('id')
        .eq('slug', 'primary')
        .maybeSingle();

      if (siteRow?.id) {
        await supabase
          .from('media_items')
          .delete()
          .eq('site_id', siteRow.id);
      }
    }
  }

  const now = new Date().toISOString();
  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail,
    action: 'Cleared media library',
    section: 'Media Library',
    summary: 'Cleared all items from Direct CMS Media Uploads',
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    mediaLibrary: [],
    draftConfig: {
      ...doc.draftConfig,
      media: {
        ...doc.draftConfig.media,
        photos: [],
        videos: [],
      },
    },
    publishedConfig: {
      ...doc.publishedConfig,
      media: {
        ...doc.publishedConfig.media,
        photos: [],
        videos: [],
      },
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);
  return [];
}

export async function publishDraftToPublic(
  actorEmail: string
): Promise<AdminDraftPayload> {
  const doc = await loadDocument();
  const validationError = validateWeddingConfigUpdate(doc.draftConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  const now = new Date().toISOString();
  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail,
    action: 'Published website',
    section: 'Publish Settings',
    summary: 'Published saved draft changes to the live wedding website.',
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    publishedConfig: structuredClone(doc.draftConfig),
    publication: {
      status: 'published',
      hasUnpublishedChanges: false,
      publishedAt: now,
      updatedAt: now,
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);

  return {
    draftConfig: nextDoc.draftConfig,
    publication: nextDoc.publication,
    setupState: nextDoc.setupState,
    mediaLibrary: nextDoc.mediaLibrary,
    activityLog: nextDoc.activityLog,
    backendStatus: getBackendStatus(),
  };
}

export async function unpublishPublicSite(
  actorEmail: string
): Promise<AdminDraftPayload> {
  const doc = await loadDocument();
  const now = new Date().toISOString();

  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail,
    action: 'Unpublished website',
    section: 'Publish Settings',
    summary: 'Temporarily unpublished the public wedding website.',
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    publication: {
      ...doc.publication,
      status: 'unpublished',
      updatedAt: now,
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);

  return {
    draftConfig: nextDoc.draftConfig,
    publication: nextDoc.publication,
    setupState: nextDoc.setupState,
    mediaLibrary: nextDoc.mediaLibrary,
    activityLog: nextDoc.activityLog,
    backendStatus: getBackendStatus(),
  };
}

export async function discardUnpublishedDraft(
  actorEmail: string
): Promise<AdminDraftPayload> {
  const doc = await loadDocument();
  const now = new Date().toISOString();

  const nextActivity: ActivityLogEntry = {
    id: crypto.randomUUID(),
    actorEmail,
    action: 'Discarded draft',
    section: 'Publish Settings',
    summary: 'Restored draft workspace to match the currently published version.',
    createdAt: now,
  };

  const nextDoc: PersistedCmsDocument = {
    ...doc,
    draftConfig: structuredClone(doc.publishedConfig),
    publication: {
      ...doc.publication,
      hasUnpublishedChanges: false,
      updatedAt: now,
    },
    activityLog: [nextActivity, ...doc.activityLog].slice(0, 30),
  };

  await saveDocument(nextDoc, nextActivity);

  return {
    draftConfig: nextDoc.draftConfig,
    publication: nextDoc.publication,
    setupState: nextDoc.setupState,
    mediaLibrary: nextDoc.mediaLibrary,
    activityLog: nextDoc.activityLog,
    backendStatus: getBackendStatus(),
  };
}
