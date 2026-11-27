import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {WeddingConfig} from '../src/types/wedding';
import type {
  ActivityLogEntry,
  MediaAsset,
  PublicationState,
  SetupWizardState,
} from '../src/types/admin';

const REQUIRED_SUPABASE_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function getMissingSupabaseVars(): string[] {
  return REQUIRED_SUPABASE_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ''
  );
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseVars().length === 0;
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedAdminClient;
}

export function getSupabasePublic(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedPublicClient;
}

export interface PersistedCmsDocument {
  draftConfig: WeddingConfig;
  publishedConfig: WeddingConfig;
  publication: PublicationState;
  setupState: SetupWizardState;
  mediaLibrary: MediaAsset[];
  activityLog: ActivityLogEntry[];
}

/**
 * Loads the primary wedding site document from Supabase Postgres tables.
 * Seeds initial tables on first run if empty.
 */
export async function loadCmsFromSupabase(
  seedDocument: PersistedCmsDocument
): Promise<PersistedCmsDocument | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const {data: siteRow, error} = await supabase
    .from('wedding_sites')
    .select('*')
    .eq('slug', 'primary')
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!siteRow) {
    await persistCmsToSupabase(seedDocument);
    return seedDocument;
  }

  const siteId = siteRow.id as string;

  const [profilesRes, familyRes, eventsRes, mediaRes, sectionsRes, activityRes] =
    await Promise.all([
      supabase.from('couple_profiles').select('*').eq('site_id', siteId),
      supabase
        .from('family_members')
        .select('*')
        .eq('site_id', siteId)
        .order('display_order', {ascending: true}),
      supabase
        .from('wedding_events')
        .select('*')
        .eq('site_id', siteId)
        .order('display_order', {ascending: true}),
      supabase
        .from('media_items')
        .select('*')
        .eq('site_id', siteId)
        .order('display_order', {ascending: true}),
      supabase
        .from('website_sections')
        .select('*')
        .eq('site_id', siteId)
        .order('display_order', {ascending: true}),
      supabase
        .from('admin_activity_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', {ascending: false})
        .limit(20),
    ]);

  for (const res of [
    profilesRes,
    familyRes,
    eventsRes,
    mediaRes,
    sectionsRes,
    activityRes,
  ]) {
    if (res.error) {
      throw new Error(`Supabase load error: ${res.error.message}`);
    }
  }

  const brideRow = (profilesRes.data || []).find((p) => p.role === 'bride');
  const groomRow = (profilesRes.data || []).find((p) => p.role === 'groom');

  const snapshotMedia = (siteRow.published_snapshot as WeddingConfig | null)?.media;
  const mediaRowsData = mediaRes.data || [];

  const galleryPhotoRows = mediaRowsData.filter(
    (m) => m.media_type === 'photo' && m.storage_path !== 'library-only'
  );
  const galleryVideoRows = mediaRowsData.filter(
    (m) => m.media_type === 'video' && m.storage_path !== 'library-only'
  );

  const photos =
    mediaRowsData.length === 0 && snapshotMedia?.photos
      ? snapshotMedia.photos
      : galleryPhotoRows.map((m) => ({
          id: m.id,
          src: m.url,
          alt: {en: m.alt_en || '', ml: m.alt_ml || ''},
          caption: {en: m.caption_en || '', ml: m.caption_ml || ''},
          description: {en: m.title_en || '', ml: m.title_ml || ''},
          aspect: (m.aspect as 'landscape' | 'portrait' | 'square') || 'landscape',
          featured: Boolean(m.featured),
          order: m.display_order ?? 0,
          visible: m.is_visible !== false,
          status: (m.status as 'approved' | 'pending') || 'approved',
          source: (m.source as 'local' | 'supabase' | 'drive' | 'r2') || 'supabase',
        }));

  const videos =
    mediaRowsData.length === 0 && snapshotMedia?.videos
      ? snapshotMedia.videos
      : galleryVideoRows.map((m) => ({
          id: m.id,
          title: {en: m.title_en || '', ml: m.title_ml || ''},
          caption: {en: m.caption_en || '', ml: m.caption_ml || ''},
          duration: m.duration || '01:00',
          posterUrl: m.poster_url || seedDocument.draftConfig.hero.fallbackImageUrl,
          videoUrl: m.url || null,
          order: m.display_order ?? 0,
          visible: m.is_visible !== false,
          status: (m.status as 'approved' | 'pending') || 'approved',
          source: (m.source as 'local' | 'supabase' | 'drive' | 'r2') || 'supabase',
        }));

  const draftConfig: WeddingConfig = {
    meta: {
      isPlaceholderData: Boolean(siteRow.is_placeholder_data),
      placeholderNotice: seedDocument.draftConfig.meta.placeholderNotice,
    },
    invitation: {
      blessing: {en: siteRow.invitation_blessing_en, ml: siteRow.invitation_blessing_ml},
      phrase: {en: siteRow.invitation_phrase_en, ml: siteRow.invitation_phrase_ml},
      openButtonLabel: {en: siteRow.invitation_button_en, ml: siteRow.invitation_button_ml},
    },
    hero: {
      invitationMessage: {en: siteRow.hero_message_en, ml: siteRow.hero_message_ml},
      backgroundVideoUrl: siteRow.hero_video_url || null,
      fallbackImageUrl: siteRow.hero_fallback_image_url,
      fallbackImageAlt: seedDocument.draftConfig.hero.fallbackImageAlt,
      additionalInfo: {
        en: siteRow.additional_info_en || '',
        ml: siteRow.additional_info_ml || '',
      },
    },
    dateAndTime: {
      muhurthamIso: siteRow.muhurtham_iso,
      calendarEndIso: siteRow.calendar_end_iso,
      displayDate: {en: siteRow.display_date_en, ml: siteRow.display_date_ml},
      muhurthamWindow: {en: siteRow.muhurtham_window_en, ml: siteRow.muhurtham_window_ml},
      malayalamCalendarDate: {
        en: siteRow.malayalam_calendar_date_en || '',
        ml: siteRow.malayalam_calendar_date_ml || '',
      },
    },
    venue: {
      name: {en: siteRow.venue_name_en, ml: siteRow.venue_name_ml},
      addressLine1: {en: siteRow.venue_address1_en, ml: siteRow.venue_address1_ml},
      addressLine2: {en: siteRow.venue_address2_en, ml: siteRow.venue_address2_ml},
      googleMapsUrl: siteRow.google_maps_url,
      directionsHint: {
        en: siteRow.directions_hint_en || '',
        ml: siteRow.directions_hint_ml || '',
      },
    },
    couple: {
      bride: brideRow
        ? {
            id: 'bride',
            nickname: {en: siteRow.bride_nickname_en, ml: siteRow.bride_nickname_ml},
            fullName: {en: brideRow.full_name_en, ml: brideRow.full_name_ml},
            roleLabel: seedDocument.draftConfig.couple.bride.roleLabel,
            portraitUrl: brideRow.portrait_url,
            portraitAlt: {en: brideRow.portrait_alt_en, ml: brideRow.portrait_alt_ml},
            fatherName: {en: brideRow.father_name_en, ml: brideRow.father_name_ml},
            motherName: {en: brideRow.mother_name_en, ml: brideRow.mother_name_ml},
            paternalGrandparents: {
              en: brideRow.paternal_grandparents_en,
              ml: brideRow.paternal_grandparents_ml,
            },
            maternalGrandparents: {
              en: brideRow.maternal_grandparents_en,
              ml: brideRow.maternal_grandparents_ml,
            },
            hometown: {en: brideRow.hometown_en, ml: brideRow.hometown_ml},
            personalIntro: {en: brideRow.personal_intro_en, ml: brideRow.personal_intro_ml},
            additionalNote: {
              en: brideRow.additional_note_en || '',
              ml: brideRow.additional_note_ml || '',
            },
          }
        : seedDocument.draftConfig.couple.bride,
      groom: groomRow
        ? {
            id: 'groom',
            nickname: {en: siteRow.groom_nickname_en, ml: siteRow.groom_nickname_ml},
            fullName: {en: groomRow.full_name_en, ml: groomRow.full_name_ml},
            roleLabel: seedDocument.draftConfig.couple.groom.roleLabel,
            portraitUrl: groomRow.portrait_url,
            portraitAlt: {en: groomRow.portrait_alt_en, ml: groomRow.portrait_alt_ml},
            fatherName: {en: groomRow.father_name_en, ml: groomRow.father_name_ml},
            motherName: {en: groomRow.mother_name_en, ml: groomRow.mother_name_ml},
            paternalGrandparents: {
              en: groomRow.paternal_grandparents_en,
              ml: groomRow.paternal_grandparents_ml,
            },
            maternalGrandparents: {
              en: groomRow.maternal_grandparents_en,
              ml: groomRow.maternal_grandparents_ml,
            },
            hometown: {en: groomRow.hometown_en, ml: groomRow.hometown_ml},
            personalIntro: {en: groomRow.personal_intro_en, ml: groomRow.personal_intro_ml},
            additionalNote: {
              en: groomRow.additional_note_en || '',
              ml: groomRow.additional_note_ml || '',
            },
          }
        : seedDocument.draftConfig.couple.groom,
    },
    familyMembers: (familyRes.data || []).map((f) => ({
      id: f.id,
      side: f.side,
      name: {en: f.name_en, ml: f.name_ml},
      relationship: {en: f.relationship_en, ml: f.relationship_ml},
      note: {en: f.note_en || '', ml: f.note_ml || ''},
      order: f.display_order ?? 0,
      visible: f.is_visible !== false,
    })),
    events: (eventsRes.data || []).map((e) => ({
      id: e.id,
      title: {en: e.title_en, ml: e.title_ml},
      dateLabel: {en: e.date_label_en, ml: e.date_label_ml},
      timeRange: {en: e.time_range_en, ml: e.time_range_ml},
      venueName: {en: e.venue_name_en, ml: e.venue_name_ml},
      description: {en: e.description_en || '', ml: e.description_ml || ''},
      imageUrl: e.image_url || undefined,
      isMuhurtham: Boolean(e.is_muhurtham),
      order: e.display_order ?? 0,
      visible: e.is_visible !== false,
    })),
    media: {
      musicEnabled: siteRow.music_enabled !== false,
      musicUrl: siteRow.music_url || null,
      musicTitle: {en: siteRow.music_title_en, ml: siteRow.music_title_ml},
      photos,
      videos,
    },
    sections:
      (sectionsRes.data || []).length > 0
        ? (sectionsRes.data || []).map((s) => ({
            key: s.section_key,
            enabled: s.is_enabled !== false,
            order: s.display_order ?? 0,
            heading: {en: s.heading_en, ml: s.heading_ml},
            subtitle: {en: s.subtitle_en || '', ml: s.subtitle_ml || ''},
          }))
        : seedDocument.draftConfig.sections,
    languageSettings: {
      defaultLanguage: siteRow.default_language || 'en',
      malayalamEnabled: siteRow.malayalam_enabled !== false,
      showLanguageSwitcher: true,
    },
    socialSharing: {
      title: siteRow.social_title,
      description: siteRow.social_description,
      imageUrl: siteRow.social_image_url,
      siteName: `${siteRow.bride_nickname_en} & ${siteRow.groom_nickname_en} Wedding`,
    },
    footer: {
      blessingQuote: {en: siteRow.footer_blessing_en, ml: siteRow.footer_blessing_ml},
      hostsLine: {en: siteRow.footer_hosts_en, ml: siteRow.footer_hosts_ml},
      showDateAndNames: true,
      showCredit: Boolean(siteRow.footer_show_credit),
      creditName: siteRow.footer_credit_name || '',
      creditUrl: siteRow.footer_credit_url || '',
    },
  };

  const publishedConfig = (siteRow.published_snapshot as WeddingConfig) || draftConfig;

  const mediaLibrary: MediaAsset[] = (mediaRes.data || []).map((m) => ({
    id: m.id,
    name: m.title_en || m.caption_en || 'Media asset',
    type: m.media_type,
    url: m.url || m.poster_url || '',
    mimeType:
      m.media_type === 'audio'
        ? 'audio/mpeg'
        : m.media_type === 'video'
          ? 'video/mp4'
          : 'image/jpeg',
    sizeBytes: 0,
    source: m.source === 'supabase' ? 'supabase' : 'builtin',
    createdAt: m.created_at,
  }));

  const activityLog: ActivityLogEntry[] = (activityRes.data || []).map((a) => ({
    id: a.id,
    actorEmail: a.actor_email,
    action: a.action,
    section: a.section,
    summary: a.summary,
    createdAt: a.created_at,
  }));

  return {
    draftConfig,
    publishedConfig,
    publication: {
      status: siteRow.publication_status || 'published',
      hasUnpublishedChanges: Boolean(siteRow.has_unpublished_changes),
      publishedAt: siteRow.published_at || null,
      updatedAt: siteRow.updated_at || new Date().toISOString(),
    },
    setupState: {
      completed: Boolean(siteRow.setup_completed),
      currentStep: siteRow.setup_current_step || 1,
      completedSteps: [],
      skippedSteps: [],
      lastSavedAt: siteRow.updated_at || null,
    },
    mediaLibrary,
    activityLog,
  };
}

export async function persistCmsToSupabase(
  doc: PersistedCmsDocument,
  newActivity?: ActivityLogEntry
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const cfg = doc.draftConfig;

  const {data: siteRow, error: siteErr} = await supabase
    .from('wedding_sites')
    .upsert(
      {
        slug: 'primary',
        publication_status: doc.publication.status,
        is_placeholder_data: cfg.meta.isPlaceholderData,
        setup_completed: doc.setupState.completed,
        setup_current_step: doc.setupState.currentStep,
        bride_nickname_en: cfg.couple.bride.nickname.en,
        bride_nickname_ml: cfg.couple.bride.nickname.ml,
        groom_nickname_en: cfg.couple.groom.nickname.en,
        groom_nickname_ml: cfg.couple.groom.nickname.ml,
        invitation_blessing_en: cfg.invitation.blessing.en,
        invitation_blessing_ml: cfg.invitation.blessing.ml,
        invitation_phrase_en: cfg.invitation.phrase.en,
        invitation_phrase_ml: cfg.invitation.phrase.ml,
        invitation_button_en: cfg.invitation.openButtonLabel.en,
        invitation_button_ml: cfg.invitation.openButtonLabel.ml,
        hero_message_en: cfg.hero.invitationMessage.en,
        hero_message_ml: cfg.hero.invitationMessage.ml,
        hero_video_url: cfg.hero.backgroundVideoUrl,
        hero_fallback_image_url: cfg.hero.fallbackImageUrl,
        muhurtham_iso: cfg.dateAndTime.muhurthamIso,
        calendar_end_iso: cfg.dateAndTime.calendarEndIso,
        display_date_en: cfg.dateAndTime.displayDate.en,
        display_date_ml: cfg.dateAndTime.displayDate.ml,
        muhurtham_window_en: cfg.dateAndTime.muhurthamWindow.en,
        muhurtham_window_ml: cfg.dateAndTime.muhurthamWindow.ml,
        malayalam_calendar_date_en: cfg.dateAndTime.malayalamCalendarDate?.en || null,
        malayalam_calendar_date_ml: cfg.dateAndTime.malayalamCalendarDate?.ml || null,
        additional_info_en: cfg.hero.additionalInfo?.en || null,
        additional_info_ml: cfg.hero.additionalInfo?.ml || null,
        venue_name_en: cfg.venue.name.en,
        venue_name_ml: cfg.venue.name.ml,
        venue_address1_en: cfg.venue.addressLine1.en,
        venue_address1_ml: cfg.venue.addressLine1.ml,
        venue_address2_en: cfg.venue.addressLine2.en,
        venue_address2_ml: cfg.venue.addressLine2.ml,
        google_maps_url: cfg.venue.googleMapsUrl,
        directions_hint_en: cfg.venue.directionsHint?.en || null,
        directions_hint_ml: cfg.venue.directionsHint?.ml || null,
        music_enabled: cfg.media.musicEnabled !== false,
        music_url: cfg.media.musicUrl,
        music_title_en: cfg.media.musicTitle.en,
        music_title_ml: cfg.media.musicTitle.ml,
        default_language: cfg.languageSettings?.defaultLanguage || 'en',
        malayalam_enabled: cfg.languageSettings?.malayalamEnabled !== false,
        social_title: cfg.socialSharing?.title || 'Wedding Invitation',
        social_description: cfg.socialSharing?.description || '',
        social_image_url:
          cfg.socialSharing?.imageUrl || cfg.hero.fallbackImageUrl,
        footer_blessing_en: cfg.footer.blessingQuote.en,
        footer_blessing_ml: cfg.footer.blessingQuote.ml,
        footer_hosts_en: cfg.footer.hostsLine.en,
        footer_hosts_ml: cfg.footer.hostsLine.ml,
        footer_credit_name: cfg.footer.creditName || null,
        footer_credit_url: cfg.footer.creditUrl || null,
        footer_show_credit: Boolean(cfg.footer.showCredit),
        published_snapshot: doc.publishedConfig,
        has_unpublished_changes: doc.publication.hasUnpublishedChanges,
        published_at: doc.publication.publishedAt,
        updated_at: doc.publication.updatedAt,
      },
      {onConflict: 'slug'}
    )
    .select('id')
    .single();

  if (siteErr || !siteRow) {
    throw new Error(`Failed to persist wedding_sites: ${siteErr?.message}`);
  }

  const siteId = siteRow.id as string;

  const {error: profileErr} = await supabase.from('couple_profiles').upsert(
    [
      {
        site_id: siteId,
        role: 'bride',
        full_name_en: cfg.couple.bride.fullName.en,
        full_name_ml: cfg.couple.bride.fullName.ml,
        portrait_url: cfg.couple.bride.portraitUrl,
        portrait_alt_en: cfg.couple.bride.portraitAlt.en,
        portrait_alt_ml: cfg.couple.bride.portraitAlt.ml,
        father_name_en: cfg.couple.bride.fatherName.en,
        father_name_ml: cfg.couple.bride.fatherName.ml,
        mother_name_en: cfg.couple.bride.motherName.en,
        mother_name_ml: cfg.couple.bride.motherName.ml,
        paternal_grandparents_en: cfg.couple.bride.paternalGrandparents.en,
        paternal_grandparents_ml: cfg.couple.bride.paternalGrandparents.ml,
        maternal_grandparents_en: cfg.couple.bride.maternalGrandparents.en,
        maternal_grandparents_ml: cfg.couple.bride.maternalGrandparents.ml,
        hometown_en: cfg.couple.bride.hometown.en,
        hometown_ml: cfg.couple.bride.hometown.ml,
        personal_intro_en: cfg.couple.bride.personalIntro.en,
        personal_intro_ml: cfg.couple.bride.personalIntro.ml,
        additional_note_en: cfg.couple.bride.additionalNote?.en || null,
        additional_note_ml: cfg.couple.bride.additionalNote?.ml || null,
        updated_at: new Date().toISOString(),
      },
      {
        site_id: siteId,
        role: 'groom',
        full_name_en: cfg.couple.groom.fullName.en,
        full_name_ml: cfg.couple.groom.fullName.ml,
        portrait_url: cfg.couple.groom.portraitUrl,
        portrait_alt_en: cfg.couple.groom.portraitAlt.en,
        portrait_alt_ml: cfg.couple.groom.portraitAlt.ml,
        father_name_en: cfg.couple.groom.fatherName.en,
        father_name_ml: cfg.couple.groom.fatherName.ml,
        mother_name_en: cfg.couple.groom.motherName.en,
        mother_name_ml: cfg.couple.groom.motherName.ml,
        paternal_grandparents_en: cfg.couple.groom.paternalGrandparents.en,
        paternal_grandparents_ml: cfg.couple.groom.paternalGrandparents.ml,
        maternal_grandparents_en: cfg.couple.groom.maternalGrandparents.en,
        maternal_grandparents_ml: cfg.couple.groom.maternalGrandparents.ml,
        hometown_en: cfg.couple.groom.hometown.en,
        hometown_ml: cfg.couple.groom.hometown.ml,
        personal_intro_en: cfg.couple.groom.personalIntro.en,
        personal_intro_ml: cfg.couple.groom.personalIntro.ml,
        additional_note_en: cfg.couple.groom.additionalNote?.en || null,
        additional_note_ml: cfg.couple.groom.additionalNote?.ml || null,
        updated_at: new Date().toISOString(),
      },
    ],
    {onConflict: 'site_id,role'}
  );
  if (profileErr) {
    throw new Error(`Failed to persist couple_profiles: ${profileErr.message}`);
  }

  // Replace relational child collections cleanly
  const deleteResults = await Promise.all([
    supabase.from('family_members').delete().eq('site_id', siteId),
    supabase.from('wedding_events').delete().eq('site_id', siteId),
    supabase.from('media_items').delete().eq('site_id', siteId),
    supabase.from('website_sections').delete().eq('site_id', siteId),
  ]);
  for (const res of deleteResults) {
    if (res.error) {
      throw new Error(`Failed to refresh child records: ${res.error.message}`);
    }
  }

  if (cfg.familyMembers && cfg.familyMembers.length > 0) {
    const {error} = await supabase.from('family_members').insert(
      cfg.familyMembers.map((f, idx) => ({
        site_id: siteId,
        side: f.side,
        name_en: f.name.en,
        name_ml: f.name.ml,
        relationship_en: f.relationship.en,
        relationship_ml: f.relationship.ml,
        note_en: f.note?.en || null,
        note_ml: f.note?.ml || null,
        display_order: f.order ?? idx,
        is_visible: f.visible,
      }))
    );
    if (error) {
      throw new Error(`Failed to persist family_members: ${error.message}`);
    }
  }

  if (cfg.events.length > 0) {
    const {error} = await supabase.from('wedding_events').insert(
      cfg.events.map((e, idx) => ({
        site_id: siteId,
        title_en: e.title.en,
        title_ml: e.title.ml,
        date_label_en: e.dateLabel.en,
        date_label_ml: e.dateLabel.ml,
        time_range_en: e.timeRange.en,
        time_range_ml: e.timeRange.ml,
        venue_name_en: e.venueName.en,
        venue_name_ml: e.venueName.ml,
        description_en: e.description?.en || null,
        description_ml: e.description?.ml || null,
        image_url: e.imageUrl || null,
        is_muhurtham: Boolean(e.isMuhurtham),
        display_order: e.order ?? idx,
        is_visible: e.visible !== false,
      }))
    );
    if (error) {
      throw new Error(`Failed to persist wedding_events: ${error.message}`);
    }
  }

  const galleryUrls = new Set<string>([
    ...cfg.media.photos.map((p) => p.src),
    ...cfg.media.videos.flatMap((v) => [v.videoUrl || '', v.posterUrl]),
  ]);

  const mediaRows = [
    ...cfg.media.photos.map((p, idx) => ({
      site_id: siteId,
      media_type: 'photo' as const,
      url: p.src,
      poster_url: null,
      title_en: p.description?.en || '',
      title_ml: p.description?.ml || '',
      caption_en: p.caption.en,
      caption_ml: p.caption.ml,
      alt_en: p.alt.en,
      alt_ml: p.alt.ml,
      duration: null,
      aspect: p.aspect || 'landscape',
      featured: Boolean(p.featured),
      display_order: p.order ?? idx,
      is_visible: p.visible !== false,
      status: p.status || 'approved',
      source: p.source === 'supabase' || p.source === 'drive' || p.source === 'r2' ? p.source : 'local',
      storage_path: null,
    })),
    ...cfg.media.videos.map((v, idx) => ({
      site_id: siteId,
      media_type: 'video' as const,
      url: v.videoUrl || '',
      poster_url: v.posterUrl,
      title_en: v.title.en,
      title_ml: v.title.ml,
      caption_en: v.caption.en,
      caption_ml: v.caption.ml,
      alt_en: v.title.en,
      alt_ml: v.title.ml,
      duration: v.duration || '01:00',
      aspect: 'landscape' as const,
      featured: false,
      display_order: v.order ?? idx,
      is_visible: v.visible !== false,
      status: v.status || 'approved',
      source: v.source === 'supabase' || v.source === 'drive' || v.source === 'r2' ? v.source : 'local',
      storage_path: null,
    })),
    ...doc.mediaLibrary
      .filter((a) => a.type === 'audio' || !galleryUrls.has(a.url))
      .map((a, idx) => ({
        site_id: siteId,
        media_type: a.type,
        url: a.url,
        poster_url: null,
        title_en: a.name,
        title_ml: a.name,
        caption_en: a.name,
        caption_ml: a.name,
        alt_en: a.name,
        alt_ml: a.name,
        duration: null,
        aspect: 'landscape' as const,
        featured: false,
        display_order: idx,
        is_visible: true,
        status: 'approved' as const,
        source: a.source === 'supabase' ? ('supabase' as const) : ('local' as const),
        storage_path: 'library-only',
      })),
  ];

  if (mediaRows.length > 0) {
    const {error} = await supabase.from('media_items').insert(mediaRows);
    if (error) {
      throw new Error(`Failed to persist media_items: ${error.message}`);
    }
  }

  if (cfg.sections && cfg.sections.length > 0) {
    const {error} = await supabase.from('website_sections').insert(
      cfg.sections.map((s) => ({
        site_id: siteId,
        section_key: s.key,
        heading_en: s.heading.en,
        heading_ml: s.heading.ml,
        subtitle_en: s.subtitle?.en || null,
        subtitle_ml: s.subtitle?.ml || null,
        display_order: s.order,
        is_enabled: s.enabled,
      }))
    );
    if (error) {
      throw new Error(`Failed to persist website_sections: ${error.message}`);
    }
  }

  if (newActivity) {
    const {error} = await supabase.from('admin_activity_log').insert({
      site_id: siteId,
      actor_email: newActivity.actorEmail,
      action: newActivity.action,
      section: newActivity.section,
      summary: newActivity.summary,
    });
    if (error) {
      throw new Error(`Failed to log activity: ${error.message}`);
    }
  }
}

export async function uploadMediaToSupabaseStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{url: string; storagePath: string}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured.');
  }
  const storagePath = `uploads/${Date.now()}-${fileName}`;
  const {error} = await supabase.storage
    .from('wedding-media')
    .upload(storagePath, buffer, {contentType: mimeType, upsert: false});

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const {data} = supabase.storage.from('wedding-media').getPublicUrl(storagePath);
  return {url: data.publicUrl, storagePath};
}
