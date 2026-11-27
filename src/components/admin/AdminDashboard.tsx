import {useCallback, useEffect, useState, type ComponentType} from 'react';
import {
  AlertCircle,
  CalendarHeart,
  ClipboardCheck,
  Eye,
  Film,
  FolderOpen,
  Globe,
  HardDrive,
  Heart,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquareHeart,
  Music,
  RefreshCw,
  Rocket,
  Share2,
  UserCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {ConfirmDialog, SectionCard} from './AdminPrimitives';
import type {WeddingConfig} from '../../types/wedding';
import type {
  AdminDraftPayload,
  AdminOverviewData,
  AdminSectionId,
  AdminUser,
  MediaAsset,
  SetupWizardState,
} from '../../types/admin';
import {
  clearAllAdminMedia,
  deleteAdminMedia,
  discardAdminDraft,
  fetchAdminDraft,
  fetchAdminOverview,
  publishAdminDraft,
  saveAdminDraft,
  unpublishAdminSite,
  uploadAdminMedia,
} from '../../services/adminApi';
import {AdminOverview} from './AdminOverview';
import {SetupWizard} from './SetupWizard';
import {
  CoupleProfileEditor,
  EventsScheduleEditor,
  FamilyInfoEditor,
  WeddingDetailsEditor,
} from './sections/WeddingContentForms';
import {
  BackgroundMusicEditor,
  FooterSettingsEditor,
  LanguageManagementEditor,
  PhotoGalleryEditor,
  PublishSettingsEditor,
  SocialSharingEditor,
  VideoGalleryEditor,
  WebsiteSectionsEditor,
} from './sections/MediaAndSiteEditors';
import {GoogleDriveSection} from './sections/GoogleDriveSection';
import {RsvpManagementSection} from './sections/RsvpManagementSection';
import {UnifiedMediaLibrarySection} from './sections/UnifiedMediaLibrarySection';
import {WishesManagementSection} from './sections/WishesManagementSection';

interface AdminDashboardProps {
  token: string;
  user: AdminUser;
  onDraftSynced: (payload: AdminDraftPayload) => void;
  onOpenPreview: () => void;
  onOpenPublic: () => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

interface NavItem {
  id: AdminSectionId;
  label: string;
  icon: ComponentType<{className?: string}>;
  group: 'workspace' | 'guests' | 'content' | 'appearance' | 'publishing';
}

const NAV_ITEMS: NavItem[] = [
  {id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'workspace'},
  {id: 'setup-wizard', label: 'Setup Wizard', icon: Wand2, group: 'workspace'},

  {id: 'rsvp-management', label: 'RSVP Management', icon: ClipboardCheck, group: 'guests'},
  {id: 'wedding-wishes', label: 'Wedding Wishes', icon: MessageSquareHeart, group: 'guests'},

  {id: 'wedding-details', label: 'Wedding Details', icon: Heart, group: 'content'},
  {id: 'bride-profile', label: 'Bride Profile', icon: UserCheck, group: 'content'},
  {id: 'groom-profile', label: 'Groom Profile', icon: UserCheck, group: 'content'},
  {id: 'family-info', label: 'Family Information', icon: Users, group: 'content'},
  {id: 'events-schedule', label: 'Events & Schedule', icon: CalendarHeart, group: 'content'},

  {id: 'photo-gallery', label: 'Photo Gallery', icon: ImageIcon, group: 'appearance'},
  {id: 'video-gallery', label: 'Video Gallery', icon: Film, group: 'appearance'},
  {id: 'google-drive', label: 'Google Drive Sync', icon: HardDrive, group: 'appearance'},
  {id: 'media-library', label: 'Media Library', icon: FolderOpen, group: 'appearance'},
  {id: 'background-music', label: 'Background Music', icon: Music, group: 'appearance'},
  {id: 'website-sections', label: 'Website Sections', icon: LayoutTemplate, group: 'appearance'},
  {id: 'language-management', label: 'Language Management', icon: Languages, group: 'appearance'},
  {id: 'social-sharing', label: 'Social Sharing Settings', icon: Share2, group: 'appearance'},
  {id: 'footer-settings', label: 'Footer Settings', icon: Globe, group: 'appearance'},

  {id: 'website-preview', label: 'Website Preview', icon: Eye, group: 'publishing'},
  {id: 'publish-settings', label: 'Publish Settings', icon: Rocket, group: 'publishing'},
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  workspace: 'Workspace',
  guests: 'Guests & Wishes',
  content: 'Wedding Content',
  appearance: 'Media & Design',
  publishing: 'Preview & Publish',
};

export function AdminDashboard({
  token,
  user,
  onDraftSynced,
  onOpenPreview,
  onOpenPublic,
  onLogout,
  onSessionExpired,
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [draftPayload, setDraftPayload] = useState<AdminDraftPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [quickPublishOpen, setQuickPublishOpen] = useState(false);
  const [quickPublishing, setQuickPublishing] = useState(false);

  const handleAuthError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.toLowerCase().includes('authentication required') ||
        msg.toLowerCase().includes('invalid or expired')
      ) {
        onSessionExpired();
        return true;
      }
      return false;
    },
    [onSessionExpired]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ov, dr] = await Promise.all([
        fetchAdminOverview(token),
        fetchAdminDraft(token),
      ]);
      setOverview(ov);
      setDraftPayload(dr);
      onDraftSynced(dr);
    } catch (err) {
      if (!handleAuthError(err)) {
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load dashboard data.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, onDraftSynced, handleAuthError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshOverviewOnly = useCallback(async () => {
    try {
      const ov = await fetchAdminOverview(token);
      setOverview(ov);
    } catch (err) {
      handleAuthError(err);
    }
  }, [token, handleAuthError]);

  const handleSaveDraft = async (
    nextConfig: WeddingConfig,
    sectionLabel: string,
    summary: string
  ) => {
    try {
      const updated = await saveAdminDraft(token, {
        draftConfig: nextConfig,
        sectionLabel,
        summary,
      });
      setDraftPayload(updated);
      onDraftSynced(updated);
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleSaveWizardProgress = async (
    nextConfig: WeddingConfig,
    nextSetup: SetupWizardState,
    summary: string
  ) => {
    try {
      const updated = await saveAdminDraft(token, {
        draftConfig: nextConfig,
        setupState: nextSetup,
        sectionLabel: 'Setup Wizard',
        summary,
      });
      setDraftPayload(updated);
      onDraftSynced(updated);
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleUploadMedia = async (file: File): Promise<MediaAsset> => {
    try {
      const asset = await uploadAdminMedia(token, file);
      setDraftPayload((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          mediaLibrary: [asset, ...prev.mediaLibrary],
        };
        onDraftSynced(next);
        return next;
      });
      await refreshOverviewOnly();
      return asset;
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleDeleteMedia = async (assetId: string) => {
    try {
      const nextLibrary = await deleteAdminMedia(token, assetId);
      setDraftPayload((prev) => {
        if (!prev) return prev;
        const next = {...prev, mediaLibrary: nextLibrary};
        onDraftSynced(next);
        return next;
      });
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleClearAllMedia = async () => {
    try {
      const nextLibrary = await clearAllAdminMedia(token);
      setDraftPayload((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          mediaLibrary: nextLibrary,
          draftConfig: {
            ...prev.draftConfig,
            media: {
              ...prev.draftConfig.media,
              photos: [],
              videos: [],
            },
          },
        };
        onDraftSynced(next);
        return next;
      });
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handlePublish = async () => {
    try {
      const updated = await publishAdminDraft(token);
      setDraftPayload(updated);
      onDraftSynced(updated);
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleUnpublish = async () => {
    try {
      const updated = await unpublishAdminSite(token);
      setDraftPayload(updated);
      onDraftSynced(updated);
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const handleDiscardDraft = async () => {
    try {
      const updated = await discardAdminDraft(token);
      setDraftPayload(updated);
      setDraftRevision((r) => r + 1);
      onDraftSynced(updated);
      await refreshOverviewOnly();
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const activeMeta = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const selectSection = (id: AdminSectionId) => {
    setActiveSection(id);
    setSidebarOpen(false);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            Wedding CMS
          </p>
          <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav
        aria-label="Admin sections"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {(['workspace', 'guests', 'content', 'appearance', 'publishing'] as const).map(
          (group) => (
            <div key={group}>
              <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs sm:text-[13px] font-medium transition-colors cursor-pointer text-left ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    if (activeSection === 'overview') {
      return (
        <AdminOverview
          overview={overview}
          loading={loading}
          onNavigateSection={selectSection}
          onOpenPreview={onOpenPreview}
        />
      );
    }

    if (activeSection === 'rsvp-management') {
      return (
        <RsvpManagementSection
          token={token}
          onSessionExpired={onSessionExpired}
        />
      );
    }

    if (activeSection === 'wedding-wishes') {
      return (
        <WishesManagementSection
          token={token}
          onSessionExpired={onSessionExpired}
        />
      );
    }

    if (activeSection === 'google-drive') {
      return (
        <GoogleDriveSection
          token={token}
          onSessionExpired={onSessionExpired}
          onOpenMediaLibrary={() => selectSection('media-library')}
          onDriveUpdated={() => void refreshOverviewOnly()}
        />
      );
    }

    if (loading || !draftPayload) {
      return (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      );
    }

    const editorKey = `${activeSection}-${draftRevision}`;

    switch (activeSection) {
      case 'setup-wizard':
        return (
          <SetupWizard
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            setupState={draftPayload.setupState}
            mediaLibrary={draftPayload.mediaLibrary}
            onSaveProgress={handleSaveWizardProgress}
            onUploadMedia={handleUploadMedia}
            onOpenPreview={onOpenPreview}
            onNavigateSection={selectSection}
          />
        );
      case 'wedding-details':
        return (
          <WeddingDetailsEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'bride-profile':
        return (
          <CoupleProfileEditor
            key={editorKey}
            role="bride"
            draftConfig={draftPayload.draftConfig}
            mediaLibrary={draftPayload.mediaLibrary}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'groom-profile':
        return (
          <CoupleProfileEditor
            key={editorKey}
            role="groom"
            draftConfig={draftPayload.draftConfig}
            mediaLibrary={draftPayload.mediaLibrary}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'family-info':
        return (
          <FamilyInfoEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'events-schedule':
        return (
          <EventsScheduleEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'photo-gallery':
        return (
          <PhotoGalleryEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'video-gallery':
        return (
          <VideoGalleryEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'media-library':
        return (
          <UnifiedMediaLibrarySection
            key={editorKey}
            token={token}
            mediaLibrary={draftPayload.mediaLibrary}
            onUploadMedia={handleUploadMedia}
            onDeleteMedia={handleDeleteMedia}
            onClearAllMedia={handleClearAllMedia}
            onSessionExpired={onSessionExpired}
            onOpenDriveSettings={() => selectSection('google-drive')}
          />
        );
      case 'background-music':
        return (
          <BackgroundMusicEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            mediaLibrary={draftPayload.mediaLibrary}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'website-sections':
        return (
          <WebsiteSectionsEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'language-management':
        return (
          <LanguageManagementEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'social-sharing':
        return (
          <SocialSharingEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onUploadMedia={handleUploadMedia}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'footer-settings':
        return (
          <FooterSettingsEditor
            key={editorKey}
            draftConfig={draftPayload.draftConfig}
            onSaveDraft={handleSaveDraft}
          />
        );
      case 'website-preview':
        return (
          <SectionCard
            title="Website Draft Preview"
            description="Inspect your saved draft edits across desktop and mobile before publishing live to guests."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                  <p className="text-slate-500">Couple Cover Title</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {draftPayload.draftConfig.couple.bride.nickname.en} &amp;{' '}
                    {draftPayload.draftConfig.couple.groom.nickname.en}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                  <p className="text-slate-500">Draft Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {draftPayload.publication.hasUnpublishedChanges
                      ? 'Unpublished draft edits ready'
                      : 'Draft synced with public site'}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                  <p className="text-slate-500">Enabled Sections</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                    {(draftPayload.draftConfig.sections || []).filter((s) => s.enabled).length}{' '}
                    visible sections
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer min-h-[42px]"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Open Full Interactive Draft Preview</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPublic}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-800 text-xs font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
                >
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span>View Current Live Public Site</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectSection('publish-settings')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-800 text-xs font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
                >
                  <Rocket className="w-4 h-4" aria-hidden="true" />
                  <span>Go to Publish Settings</span>
                </button>
              </div>
            </div>
          </SectionCard>
        );
      case 'publish-settings':
        return (
          <PublishSettingsEditor
            key={editorKey}
            publication={draftPayload.publication}
            onOpenPreview={onOpenPreview}
            onOpenPublic={onOpenPublic}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onDiscardDraft={handleDiscardDraft}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-dvh">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/40"
          />
          <aside className="relative z-10 w-[270px] max-w-[85vw] h-full">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Admin</span>
                <span>/</span>
                <span className="text-slate-900 font-semibold truncate">
                  {activeMeta.label}
                </span>
              </div>
              {draftPayload && (
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {draftPayload.publication.status === 'published'
                    ? 'Public: Live'
                    : 'Public: Unpublished'}
                  {draftPayload.publication.hasUnpublishedChanges
                    ? ' · Draft has unpublished changes'
                    : ' · Live matches draft'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {draftPayload?.publication.hasUnpublishedChanges && (
              <button
                type="button"
                onClick={() => setQuickPublishOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer min-h-[38px]"
              >
                <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Publish Live</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Preview Draft</span>
            </button>
            <button
              type="button"
              onClick={onOpenPublic}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[38px]"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">View Live</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {loadError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {renderActiveSection()}
        </main>
      </div>

      <ConfirmDialog
        open={quickPublishOpen}
        title="Publish Saved Draft to Live Website?"
        message="This will update the public wedding invitation (/) with all saved draft edits."
        confirmLabel="Publish Live"
        loading={quickPublishing}
        onCancel={() => setQuickPublishOpen(false)}
        onConfirm={async () => {
          setQuickPublishing(true);
          try {
            await handlePublish();
          } finally {
            setQuickPublishing(false);
            setQuickPublishOpen(false);
          }
        }}
      />
    </div>
  );
}
