import {useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Loader2,
  SkipForward,
} from 'lucide-react';
import type {WeddingConfig} from '../../types/wedding';
import type {
  AdminSectionId,
  MediaAsset,
  SetupWizardState,
} from '../../types/admin';
import {
  FileUploadButton,
  LocalizedInput,
  LocalizedTextarea,
  SectionCard,
  ToggleSwitch,
} from './AdminPrimitives';

interface SetupWizardProps {
  draftConfig: WeddingConfig;
  setupState: SetupWizardState;
  mediaLibrary: MediaAsset[];
  onSaveProgress: (
    nextConfig: WeddingConfig,
    nextSetup: SetupWizardState,
    summary: string
  ) => Promise<void>;
  onUploadMedia: (file: File) => Promise<MediaAsset>;
  onOpenPreview: () => void;
  onNavigateSection: (section: AdminSectionId) => void;
}

const WIZARD_STEPS = [
  {step: 1, title: 'Couple Nicknames & Full Names', required: true},
  {step: 2, title: 'Bride & Groom Photographs', required: false},
  {step: 3, title: 'Family Information', required: false},
  {step: 4, title: 'Wedding Date & Muhurtham', required: true},
  {step: 5, title: 'Venue & Address', required: true},
  {step: 6, title: 'Events & Schedule', required: false},
  {step: 7, title: 'Invitation Message', required: true},
  {step: 8, title: 'Gallery Media', required: false},
  {step: 9, title: 'Background Music', required: false},
  {step: 10, title: 'Language Preferences', required: false},
  {step: 11, title: 'Social Sharing Image & Details', required: false},
  {step: 12, title: 'Footer Preferences', required: false},
  {step: 13, title: 'Final Website Preview', required: false},
] as const;

export function SetupWizard({
  draftConfig,
  setupState,
  onSaveProgress,
  onUploadMedia,
  onOpenPreview,
  onNavigateSection,
}: SetupWizardProps) {
  const [localConfig, setLocalConfig] = useState<WeddingConfig>(() =>
    structuredClone(draftConfig)
  );
  const [currentStep, setCurrentStep] = useState<number>(
    Math.min(Math.max(setupState.currentStep || 1, 1), 13)
  );
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    setupState.completedSteps || []
  );
  const [skippedSteps, setSkippedSteps] = useState<number[]>(
    setupState.skippedSteps || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const stepMeta = WIZARD_STEPS[currentStep - 1];

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (
        !localConfig.couple.bride.nickname.en.trim() ||
        !localConfig.couple.groom.nickname.en.trim() ||
        !localConfig.couple.bride.fullName.en.trim() ||
        !localConfig.couple.groom.fullName.en.trim()
      ) {
        return 'Please enter English nicknames and full names for both the bride and groom.';
      }
    }
    if (step === 4) {
      if (
        !localConfig.dateAndTime.displayDate.en.trim() ||
        !localConfig.dateAndTime.muhurthamWindow.en.trim() ||
        Number.isNaN(Date.parse(localConfig.dateAndTime.muhurthamIso))
      ) {
        return 'Please enter a valid wedding date, Muhurtham ISO timestamp, and Muhurtham window.';
      }
    }
    if (step === 5) {
      if (
        !localConfig.venue.name.en.trim() ||
        !localConfig.venue.addressLine1.en.trim()
      ) {
        return 'Please enter the venue name and address.';
      }
    }
    if (step === 7) {
      if (
        !localConfig.invitation.phrase.en.trim() ||
        !localConfig.hero.invitationMessage.en.trim()
      ) {
        return 'Please enter both the cover invitation phrase and hero invitation message.';
      }
    }
    return null;
  };

  const persistStep = async (opts: {
    nextStep: number;
    markCompleted?: boolean;
    markSkipped?: boolean;
    markWizardDone?: boolean;
    summary: string;
  }) => {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      const nextCompleted = opts.markCompleted
        ? Array.from(new Set([...completedSteps, currentStep]))
        : completedSteps;
      const nextSkipped = opts.markSkipped
        ? Array.from(new Set([...skippedSteps, currentStep])).filter(
            (s) => !nextCompleted.includes(s)
          )
        : skippedSteps.filter((s) => s !== currentStep);

      const nextSetup: SetupWizardState = {
        completed: opts.markWizardDone ? true : setupState.completed,
        currentStep: opts.nextStep,
        completedSteps: nextCompleted,
        skippedSteps: nextSkipped,
        lastSavedAt: new Date().toISOString(),
      };

      await onSaveProgress(localConfig, nextSetup, opts.summary);
      setCompletedSteps(nextCompleted);
      setSkippedSteps(nextSkipped);
      setCurrentStep(opts.nextStep);
      setSavedNotice('Progress saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save setup progress.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const err = validateStep(currentStep);
    if (err) {
      setError(err);
      return;
    }
    const nextStep = Math.min(currentStep + 1, 13);
    await persistStep({
      nextStep,
      markCompleted: true,
      markWizardDone: currentStep === 13,
      summary: `Setup Wizard step ${currentStep} (${stepMeta.title}) saved.`,
    });
  };

  const handleSaveAndPause = async () => {
    const err = validateStep(currentStep);
    if (err) {
      setError(err);
      return;
    }
    await persistStep({
      nextStep: currentStep,
      markCompleted: true,
      summary: `Saved Setup Wizard progress at step ${currentStep}.`,
    });
  };

  const handleSkip = async () => {
    if (stepMeta.required) return;
    const nextStep = Math.min(currentStep + 1, 13);
    await persistStep({
      nextStep,
      markSkipped: true,
      summary: `Skipped optional step ${currentStep} (${stepMeta.title}).`,
    });
  };

  const progressPct = Math.round(
    (Array.from(new Set([...completedSteps, ...skippedSteps])).length / 13) * 100
  );

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <SectionCard
        title="Guided Wedding Setup Wizard"
        description="Complete required steps and skip optional ones anytime. Drafts never publish automatically."
        actions={
          <span className="text-xs font-medium text-slate-600 tabular-nums">
            Step {currentStep} of 13 · {progressPct}% progressed
          </span>
        }
      >
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-5">
          <div
            className="h-full bg-slate-900 transition-all duration-300"
            style={{width: `${Math.max(progressPct, Math.round((currentStep / 13) * 100))}%`}}
          />
        </div>

        {/* Clickable Step Rail */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WIZARD_STEPS.map((item) => {
            const isActive = item.step === currentStep;
            const isDone = completedSteps.includes(item.step);
            const isSkipped = skippedSteps.includes(item.step);

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  setError(null);
                  setSavedNotice(null);
                  setCurrentStep(item.step);
                }}
                className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : isDone
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      : isSkipped
                        ? 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-medium tabular-nums">
                  <span>{String(item.step).padStart(2, '0')}</span>
                  {isDone && <Check className="w-3 h-3" aria-hidden="true" />}
                </div>
                <p className="truncate text-[11px] opacity-85 mt-0.5">{item.title}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Active Step Form */}
      <SectionCard
        title={`Step ${currentStep}: ${stepMeta.title}`}
        description={
          stepMeta.required
            ? 'Required information before publishing your invitation.'
            : 'Optional step — you can fill this now or skip and customize later.'
        }
        actions={
          <span
            className={`text-xs font-medium ${
              stepMeta.required ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            {stepMeta.required ? 'Required' : 'Optional'}
          </span>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {savedNotice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Step 1: Couple Nicknames & Full Names */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <LocalizedInput
              label="Bride's Nickname (Shown on closed invitation card)"
              required
              value={localConfig.couple.bride.nickname}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    bride: {...localConfig.couple.bride, nickname: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Bride's Full Name (Shown after opening invitation)"
              required
              value={localConfig.couple.bride.fullName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    bride: {...localConfig.couple.bride, fullName: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Groom's Nickname (Shown on closed invitation card)"
              required
              value={localConfig.couple.groom.nickname}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    groom: {...localConfig.couple.groom, nickname: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Groom's Full Name (Shown after opening invitation)"
              required
              value={localConfig.couple.groom.fullName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    groom: {...localConfig.couple.groom, fullName: next},
                  },
                })
              }
            />
          </div>
        )}

        {/* Step 2: Bride & Groom Photographs */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['bride', 'groom'] as const).map((role) => (
              <div key={role} className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-slate-900 capitalize">
                  {role} Portrait
                </p>
                <img
                  src={localConfig.couple[role].portraitUrl}
                  alt={role}
                  className="w-full h-56 object-cover object-top rounded-lg bg-slate-100"
                />
                <FileUploadButton
                  accept="image/*"
                  label={`Upload ${role} photo`}
                  onUpload={async (file) => {
                    const asset = await onUploadMedia(file);
                    setLocalConfig((prev) => ({
                      ...prev,
                      couple: {
                        ...prev.couple,
                        [role]: {...prev.couple[role], portraitUrl: asset.url},
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Family Information */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <LocalizedInput
              label="Bride's Father Name"
              value={localConfig.couple.bride.fatherName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    bride: {...localConfig.couple.bride, fatherName: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Bride's Mother Name"
              value={localConfig.couple.bride.motherName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    bride: {...localConfig.couple.bride, motherName: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Groom's Father Name"
              value={localConfig.couple.groom.fatherName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    groom: {...localConfig.couple.groom, fatherName: next},
                  },
                })
              }
            />
            <LocalizedInput
              label="Groom's Mother Name"
              value={localConfig.couple.groom.motherName}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  couple: {
                    ...localConfig.couple,
                    groom: {...localConfig.couple.groom, motherName: next},
                  },
                })
              }
            />
          </div>
        )}

        {/* Step 4: Wedding Date & Muhurtham */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <LocalizedInput
              label="Display Wedding Date"
              required
              value={localConfig.dateAndTime.displayDate}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  dateAndTime: {...localConfig.dateAndTime, displayDate: next},
                })
              }
            />
            <LocalizedInput
              label="Muhurtham Time Window"
              required
              value={localConfig.dateAndTime.muhurthamWindow}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  dateAndTime: {...localConfig.dateAndTime, muhurthamWindow: next},
                })
              }
            />
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Muhurtham Countdown Timestamp (ISO 8601 with +05:30 IST) *
              </label>
              <input
                type="text"
                value={localConfig.dateAndTime.muhurthamIso}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    dateAndTime: {
                      ...localConfig.dateAndTime,
                      muhurthamIso: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 5: Venue & Address */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <LocalizedInput
              label="Venue Name"
              required
              value={localConfig.venue.name}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  venue: {...localConfig.venue, name: next},
                })
              }
            />
            <LocalizedInput
              label="Address Line 1"
              required
              value={localConfig.venue.addressLine1}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  venue: {...localConfig.venue, addressLine1: next},
                })
              }
            />
            <LocalizedInput
              label="Address Line 2 (City, District, PIN)"
              value={localConfig.venue.addressLine2}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  venue: {...localConfig.venue, addressLine2: next},
                })
              }
            />
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Google Maps Link
              </label>
              <input
                type="url"
                value={localConfig.venue.googleMapsUrl}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    venue: {...localConfig.venue, googleMapsUrl: e.target.value},
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 6: Events & Schedule */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You currently have{' '}
              <strong className="text-slate-900">
                {localConfig.events.length} ceremonies
              </strong>{' '}
              in your schedule. You can edit the Muhurtham title below or manage all
              ceremonies in the Events &amp; Schedule tab.
            </p>
            {localConfig.events[0] && (
              <LocalizedInput
                label="First Ceremony Title"
                value={localConfig.events[0].title}
                onChange={(next) => {
                  const updated = [...localConfig.events];
                  updated[0] = {...updated[0], title: next};
                  setLocalConfig({...localConfig, events: updated});
                }}
              />
            )}
            <button
              type="button"
              onClick={() => onNavigateSection('events-schedule')}
              className="text-xs font-medium text-slate-700 underline underline-offset-4 cursor-pointer"
            >
              Open Full Events &amp; Schedule Editor
            </button>
          </div>
        )}

        {/* Step 7: Invitation Message */}
        {currentStep === 7 && (
          <div className="space-y-5">
            <LocalizedTextarea
              label="Closed Invitation Card Phrase"
              required
              value={localConfig.invitation.phrase}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  invitation: {...localConfig.invitation, phrase: next},
                })
              }
            />
            <LocalizedTextarea
              label="Hero Invitation Message"
              required
              value={localConfig.hero.invitationMessage}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  hero: {...localConfig.hero, invitationMessage: next},
                })
              }
            />
          </div>
        )}

        {/* Step 8: Gallery Media */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Currently configured:{' '}
              <strong className="text-slate-900">
                {localConfig.media.photos.length} photos
              </strong>{' '}
              and{' '}
              <strong className="text-slate-900">
                {localConfig.media.videos.length} videos
              </strong>
              . Upload a new gallery photograph now or manage full galleries later.
            </p>
            <FileUploadButton
              accept="image/*"
              label="Upload & Add Photo to Gallery"
              onUpload={async (file) => {
                const asset = await onUploadMedia(file);
                setLocalConfig((prev) => ({
                  ...prev,
                  media: {
                    ...prev.media,
                    photos: [
                      ...prev.media.photos,
                      {
                        id: `photo-${Date.now()}`,
                        src: asset.url,
                        alt: {en: asset.name, ml: asset.name},
                        caption: {en: asset.name, ml: asset.name},
                        aspect: 'landscape',
                        order: prev.media.photos.length + 1,
                        visible: true,
                        status: 'approved',
                        source: asset.source === 'supabase' ? 'supabase' : 'local',
                        isPlaceholder: false,
                      },
                    ],
                  },
                }));
                setSavedNotice(`Added "${asset.name}" to gallery draft.`);
              }}
            />
          </div>
        )}

        {/* Step 9: Background Music */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <ToggleSwitch
              label="Enable Background Wedding Music"
              description="Plays gently after the visitor clicks Open Invitation."
              checked={localConfig.media.musicEnabled !== false}
              onChange={(checked) =>
                setLocalConfig({
                  ...localConfig,
                  media: {...localConfig.media, musicEnabled: checked},
                })
              }
            />
            <LocalizedInput
              label="Music Track Title"
              value={localConfig.media.musicTitle}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  media: {...localConfig.media, musicTitle: next},
                })
              }
            />
          </div>
        )}

        {/* Step 10: Language Preferences */}
        {currentStep === 10 && (
          <div className="space-y-4">
            <ToggleSwitch
              label="Enable Malayalam Language Support"
              description="Allows guests to switch between English and മലയാളം."
              checked={localConfig.languageSettings?.malayalamEnabled !== false}
              onChange={(checked) =>
                setLocalConfig({
                  ...localConfig,
                  languageSettings: {
                    defaultLanguage:
                      localConfig.languageSettings?.defaultLanguage || 'en',
                    showLanguageSwitcher: checked,
                    malayalamEnabled: checked,
                  },
                })
              }
            />
          </div>
        )}

        {/* Step 11: Social Sharing Image & Details */}
        {currentStep === 11 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                WhatsApp / Open Graph Title
              </label>
              <input
                type="text"
                value={localConfig.socialSharing?.title || ''}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    socialSharing: {
                      ...(localConfig.socialSharing || {
                        description: '',
                        imageUrl: localConfig.hero.fallbackImageUrl,
                        siteName: '',
                      }),
                      title: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                WhatsApp / Open Graph Description
              </label>
              <textarea
                rows={3}
                value={localConfig.socialSharing?.description || ''}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    socialSharing: {
                      ...(localConfig.socialSharing || {
                        title: '',
                        imageUrl: localConfig.hero.fallbackImageUrl,
                        siteName: '',
                      }),
                      description: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 12: Footer Preferences */}
        {currentStep === 12 && (
          <div className="space-y-4">
            <LocalizedInput
              label="Family Hosts Sign-Off"
              value={localConfig.footer.hostsLine}
              onChange={(next) =>
                setLocalConfig({
                  ...localConfig,
                  footer: {...localConfig.footer, hostsLine: next},
                })
              }
            />
            <ToggleSwitch
              label="Show Maker Credit in Footer"
              checked={Boolean(localConfig.footer.showCredit)}
              onChange={(checked) =>
                setLocalConfig({
                  ...localConfig,
                  footer: {...localConfig.footer, showCredit: checked},
                })
              }
            />
          </div>
        )}

        {/* Step 13: Final Website Preview */}
        {currentStep === 13 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 leading-relaxed">
              Your guided setup is ready to preview. Completing this wizard saves your
              draft privately — nothing goes live until you review and publish from{' '}
              <strong>Publish Settings</strong> or the <strong>Publish Live</strong> button.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await persistStep({
                    nextStep: 13,
                    markCompleted: true,
                    markWizardDone: true,
                    summary: 'Saved Setup Wizard draft before opening preview.',
                  });
                  onOpenPreview();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[42px]"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>Save &amp; Open Full Draft Preview</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection('publish-settings')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-800 text-xs font-medium hover:bg-slate-50 cursor-pointer min-h-[42px]"
              >
                <span>Go to Publish Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentStep === 1 || saving}
              onClick={() => {
                setError(null);
                setSavedNotice(null);
                setCurrentStep((prev) => Math.max(1, prev - 1));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer min-h-[40px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAndPause}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[40px]"
            >
              Save &amp; Continue Later
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!stepMeta.required && currentStep < 13 && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer min-h-[40px]"
              >
                <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Skip Optional</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[40px]"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : currentStep === 13 ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{currentStep === 13 ? 'Complete Setup (Keep Draft)' : 'Save & Next'}</span>
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
