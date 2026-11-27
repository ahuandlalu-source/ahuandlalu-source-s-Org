import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {MotionConfig} from 'motion/react';
import {ArrowLeft, Eye} from 'lucide-react';
import {translations} from '../config/translations';
import {weddingConfig as defaultConfig} from '../config/weddingConfig';
import type {Language, SectionKey, WeddingConfig} from '../types/wedding';
import type {Phase3PublicPayload, PublicWishCard} from '../types/phase3';
import {fetchPublicPhase3} from '../services/adminApi';
import {createKeralaAmbienceWavUrl} from '../utils/audioSynth';
import {InvitationScreen} from './InvitationScreen';
import {InvitationOpeningAnimation} from './InvitationOpeningAnimation';
import {TopNav} from './TopNav';
import {WeddingHero} from './WeddingHero';
import {CoupleProfiles} from './CoupleProfiles';
import {FamilyDirectory} from './FamilyDirectory';
import {WeddingCountdown} from './WeddingCountdown';
import {WeddingDetails} from './WeddingDetails';
import {PhotoGallery} from './PhotoGallery';
import {RsvpSection} from './RsvpSection';
import {WishesSection} from './WishesSection';
import {WeddingFooter} from './WeddingFooter';
import {BackgroundMusicPlayer} from './BackgroundMusicPlayer';
import {NilavilakkuCrest} from './KeralaMotifs';

type InvitationStage = 'closed' | 'opening' | 'opened';

const SESSION_PREF_KEY = 'kerala_wedding_music_pref';

interface PublicWeddingSiteProps {
  config: WeddingConfig;
  publicationStatus?: 'published' | 'unpublished';
  isPreviewMode?: boolean;
  onNavigate?: (path: string) => void;
}

export function PublicWeddingSite({
  config,
  publicationStatus = 'published',
  isPreviewMode = false,
  onNavigate,
}: PublicWeddingSiteProps) {
  const malayalamEnabled = config.languageSettings?.malayalamEnabled !== false;
  const showLanguageSwitcher =
    malayalamEnabled && config.languageSettings?.showLanguageSwitcher !== false;
  const defaultLanguage: Language =
    malayalamEnabled && config.languageSettings?.defaultLanguage === 'ml'
      ? 'ml'
      : 'en';

  const [stage, setStage] = useState<InvitationStage>(
    isPreviewMode ? 'opened' : 'closed'
  );
  const [language, setLanguage] = useState<Language>(defaultLanguage);

  useEffect(() => {
    if (!malayalamEnabled && language === 'ml') {
      setLanguage('en');
    }
  }, [malayalamEnabled, language]);

  // Keep <html lang="..."> synced for Malayalam typography calibration
  useEffect(() => {
    document.documentElement.lang = language === 'ml' ? 'ml' : 'en';
  }, [language]);

  // Phase 3 public RSVP settings & approved Wedding Wishes Wall
  const [phase3Data, setPhase3Data] = useState<Phase3PublicPayload>({
    settings: {
      rsvpEnabled: true,
      rsvpHeadingEn: 'Will You Be Joining Us?',
      rsvpHeadingMl: 'ഞങ്ങളോടൊപ്പം പങ്കുചേരുമോ?',
      rsvpSubtitleEn:
        'Kindly let us know if you will grace our wedding celebration with your presence.',
      rsvpSubtitleMl:
        'വിവാഹ ചടങ്ങിൽ പങ്കെടുക്കുമോ എന്ന് ദയവായി ഞങ്ങളെ അറിയിക്കുക.',
      rsvpAllowAttendeeCount: true,
      rsvpMaxAttendees: 10,
      rsvpCustomFields: [],
      wishesEnabled: true,
      wishesHeadingEn: 'Send Your Wishes',
      wishesHeadingMl: 'ആശംസകൾ നേരുക',
      wishesSubtitleEn:
        'Share your blessings, fond memories, and messages of love for the couple.',
      wishesSubtitleMl:
        'വധൂവരന്മാർക്കായി നിങ്ങളുടെ അനുഗ്രഹങ്ങളും സ്നേഹാശംസകളും പങ്കുവയ്ക്കുക.',
    },
    approvedWishes: [],
    migrationRequired: false,
  });
  const [loadingWishes, setLoadingWishes] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicPhase3()
      .then((res) => {
        if (active) setPhase3Data(res);
      })
      .catch(() => {
        // Keep safe defaults if Phase 3 endpoint is temporarily unreachable
      })
      .finally(() => {
        if (active) setLoadingWishes(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleWishPublished = useCallback((wish: PublicWishCard) => {
    setPhase3Data((prev) => ({
      ...prev,
      approvedWishes: [wish, ...prev.approvedWishes],
    }));
  }, []);

  // Sync social sharing metadata in live public view
  useEffect(() => {
    if (isPreviewMode || !config.socialSharing) return;
    if (config.socialSharing.title) {
      document.title = config.socialSharing.title;
    }
    const updateMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el && content) {
        el.setAttribute('content', content);
      }
    };
    updateMeta('meta[name="description"]', config.socialSharing.description);
    updateMeta('meta[property="og:title"]', config.socialSharing.title);
    updateMeta('meta[property="og:description"]', config.socialSharing.description);
    updateMeta('meta[property="og:image"]', config.socialSharing.imageUrl);
    updateMeta('meta[name="twitter:title"]', config.socialSharing.title);
    updateMeta('meta[name="twitter:description"]', config.socialSharing.description);
    updateMeta('meta[name="twitter:image"]', config.socialSharing.imageUrl);
  }, [config.socialSharing, isPreviewMode]);

  // Persistent audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);
  const [musicSrc, setMusicSrc] = useState<string | null>(config.media.musicUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_PREF_KEY);
      return saved ? JSON.parse(saved).muted === true : false;
    } catch {
      return false;
    }
  });
  const [audioError, setAudioError] = useState(false);

  const musicEnabled = config.media.musicEnabled !== false;
  const ui = translations[language];

  // Update music source cleanly when config changes
  useEffect(() => {
    if (!musicEnabled) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (config.media.musicUrl) {
      setAudioError(false);
      setMusicSrc(config.media.musicUrl);
      return;
    }

    if (!generatedAudioUrlRef.current) {
      generatedAudioUrlRef.current = createKeralaAmbienceWavUrl();
    }
    setAudioError(false);
    setMusicSrc(generatedAudioUrlRef.current);
  }, [config.media.musicUrl, musicEnabled]);

  useEffect(() => {
    return () => {
      if (generatedAudioUrlRef.current) {
        URL.revokeObjectURL(generatedAudioUrlRef.current);
        generatedAudioUrlRef.current = null;
      }
    };
  }, []);

  const saveMusicPref = useCallback((paused: boolean, muted: boolean) => {
    try {
      sessionStorage.setItem(SESSION_PREF_KEY, JSON.stringify({paused, muted}));
    } catch {
      // Ignore storage limits
    }
  }, []);

  const startMusicFromUserGesture = useCallback(() => {
    if (!musicEnabled) return;
    const audio = audioRef.current;
    if (!audio) return;

    setAudioError(false);
    setIsMuted(false);
    audio.muted = false;
    audio.volume = 0.72;
    saveMusicPref(false, false);

    // Ensure a valid playable source is attached right inside the click gesture
    if (!audio.getAttribute('src')) {
      if (!generatedAudioUrlRef.current) {
        generatedAudioUrlRef.current = createKeralaAmbienceWavUrl();
      }
      audio.src = generatedAudioUrlRef.current;
      setMusicSrc(generatedAudioUrlRef.current);
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // If external/configured track fails to play, fall back immediately to synthesized ambience
          if (!generatedAudioUrlRef.current) {
            generatedAudioUrlRef.current = createKeralaAmbienceWavUrl();
          }
          const fallbackUrl = generatedAudioUrlRef.current;
          setMusicSrc(fallbackUrl);
          audio.src = fallbackUrl;
          audio.load();
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        });
    }
  }, [musicEnabled, saveMusicPref]);

  const handleOpenInvitation = () => {
    startMusicFromUserGesture();
    setStage('opening');
  };

  const handleOpeningComplete = useCallback(() => {
    setStage('opened');
  }, []);

  const handleTogglePlay = () => {
    if (!musicEnabled) return;
    const audio = audioRef.current;
    if (!audio || audioError) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          saveMusicPref(false, isMuted);
        })
        .catch(() => setAudioError(true));
    } else {
      audio.pause();
      setIsPlaying(false);
      saveMusicPref(true, isMuted);
    }
  };

  const handleToggleMute = () => {
    const audio = audioRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audio) {
      audio.muted = nextMuted;
    }
    saveMusicPref(!isPlaying, nextMuted);
  };

  // Resolve ordered & enabled sections from CMS configuration
  const orderedSections = useMemo(() => {
    const configured =
      config.sections && config.sections.length > 0
        ? config.sections
        : defaultConfig.sections || [];
    return [...configured]
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
  }, [config.sections]);

  // If public site is unpublished (and not in owner preview), show serene holding page
  if (!isPreviewMode && publicationStatus === 'unpublished') {
    return (
      <main className="min-h-dvh bg-[#FAF7F0] paper-grain flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-lg bg-[#F4EFE6] kasavu-frame p-8 sm:p-12">
          <div className="flex justify-center text-[#B68D40] mb-5">
            <NilavilakkuCrest className="w-11 h-11" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-[#2C221E] mb-4">
            Invitation Coming Soon
          </h1>
          <p className="text-sm sm:text-base text-[#5E4C45] leading-relaxed mb-8">
            This wedding invitation is currently being prepared by the families and will be published shortly.
          </p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="text-xs font-medium text-[#7A675F] hover:text-[#2C221E] underline underline-offset-4 cursor-pointer"
            >
              Owner Sign In
            </button>
          )}
        </div>
      </main>
    );
  }

  const coupleShortTitle = `${config.couple.bride.nickname[language]} & ${config.couple.groom.nickname[language]}`;

  const renderSection = (key: SectionKey, heading?: string, subtitle?: string) => {
    switch (key) {
      case 'couple':
        return (
          <CoupleProfiles
            key="couple"
            couple={config.couple}
            language={language}
            strings={ui.couple}
            headingOverride={heading}
            subtitleOverride={subtitle}
          />
        );
      case 'family':
        return (
          <FamilyDirectory
            key="family"
            members={config.familyMembers || []}
            language={language}
            heading={heading || (language === 'ml' ? 'കുടുംബാംഗങ്ങൾ' : 'Our Loved Ones & Elders')}
            subtitle={subtitle}
          />
        );
      case 'countdown':
        return (
          <WeddingCountdown
            key="countdown"
            targetIso={config.dateAndTime.muhurthamIso}
            strings={ui.countdown}
            headingOverride={heading}
          />
        );
      case 'details':
        return (
          <WeddingDetails
            key="details"
            config={config}
            language={language}
            strings={ui.details}
            headingOverride={heading}
          />
        );
      case 'gallery':
        return (
          <PhotoGallery
            key="gallery"
            photos={config.media.photos}
            videos={config.media.videos}
            language={language}
            strings={ui.gallery}
            videoStrings={ui.videos}
            headingOverride={heading}
            subtitleOverride={subtitle}
          />
        );
      case 'videos':
        return null;
      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* Draft Preview Ribbon */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 bg-[#18181B] text-[#FAF7F0] px-4 py-2.5 border-b border-[#B68D40]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <Eye className="w-4 h-4 text-[#D5B97D] shrink-0" aria-hidden="true" />
            <span className="font-medium">Draft Preview ({coupleShortTitle})</span>
            <span className="text-[#FAF7F0]/70 hidden sm:inline">
              · Private saved draft before publishing to /
            </span>
          </div>
          <div className="flex items-center gap-2">
            {stage === 'opened' ? (
              <button
                type="button"
                onClick={() => setStage('closed')}
                className="px-3 py-1.5 rounded-md bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/20 text-xs font-medium cursor-pointer"
              >
                Preview Cover Card
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStage('opened')}
                className="px-3 py-1.5 rounded-md bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/20 text-xs font-medium cursor-pointer"
              >
                Skip to Main Page
              </button>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#B68D40] text-[#18181B] text-xs font-semibold hover:bg-[#D5B97D] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Admin</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Persistent Audio Element */}
      {musicEnabled && (
        <audio
          ref={audioRef}
          src={musicSrc || undefined}
          loop
          preload={musicSrc?.startsWith('blob:') ? 'auto' : 'metadata'}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            if (
              config.media.musicUrl &&
              musicSrc === config.media.musicUrl &&
              !generatedAudioUrlRef.current
            ) {
              const fallbackBlob = createKeralaAmbienceWavUrl();
              generatedAudioUrlRef.current = fallbackBlob;
              setMusicSrc(fallbackBlob);
            } else {
              setAudioError(true);
              setIsPlaying(false);
            }
          }}
        />
      )}

      {stage === 'closed' ? (
        <InvitationScreen
          brideNickname={config.couple.bride.nickname[language]}
          groomNickname={config.couple.groom.nickname[language]}
          blessing={config.invitation.blessing[language]}
          phrase={config.invitation.phrase[language]}
          openButtonLabel={config.invitation.openButtonLabel[language]}
          language={language}
          onLanguageChange={setLanguage}
          strings={ui.invitation}
          onOpen={handleOpenInvitation}
          showLanguageSwitcher={showLanguageSwitcher}
        />
      ) : (
        <div className="min-h-dvh flex flex-col bg-[#FAF7F0] text-[#2C221E]">
          <TopNav
            coupleShortTitle={coupleShortTitle}
            language={language}
            onLanguageChange={setLanguage}
            strings={ui.nav}
            showLanguageSwitcher={showLanguageSwitcher}
          />

          <main className="flex-1">
            <WeddingHero config={config} language={language} strings={ui.hero} />

            {orderedSections.map((sec) =>
              renderSection(
                sec.key,
                sec.heading?.[language]?.trim() || undefined,
                sec.subtitle?.[language]?.trim() || undefined
              )
            )}

            <RsvpSection
              settings={phase3Data.settings}
              language={language}
              strings={ui.rsvp}
              isPreviewMode={isPreviewMode}
            />

            <WishesSection
              settings={phase3Data.settings}
              approvedWishes={phase3Data.approvedWishes}
              loadingWishes={loadingWishes}
              onWishPublished={handleWishPublished}
              language={language}
              strings={ui.wishes}
              isPreviewMode={isPreviewMode}
            />
          </main>

          <WeddingFooter config={config} language={language} strings={ui.footer} />
        </div>
      )}

      <InvitationOpeningAnimation
        brideNickname={config.couple.bride.nickname[language]}
        groomNickname={config.couple.groom.nickname[language]}
        isOpening={stage === 'opening'}
        onComplete={handleOpeningComplete}
      />

      <BackgroundMusicPlayer
        visible={musicEnabled && stage !== 'closed'}
        isPlaying={isPlaying}
        isMuted={isMuted}
        hasError={audioError}
        trackTitle={config.media.musicTitle[language]}
        strings={ui.music}
        onTogglePlay={handleTogglePlay}
        onToggleMute={handleToggleMute}
      />
    </MotionConfig>
  );
}
