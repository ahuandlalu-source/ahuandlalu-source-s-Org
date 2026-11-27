import {useRef, useState, type ChangeEvent, type FormEvent} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  HeartHandshake,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
} from 'lucide-react';
import type {Language} from '../types/wedding';
import type {PublicPhase3Settings, PublicWishCard} from '../types/phase3';
import type {UIStrings} from '../config/translations';
import {submitPublicWish} from '../services/adminApi';
import {ScrollReveal} from './ScrollReveal';

const WISH_EMOJIS = ['🙏', '💐', '🪔', '❤️', '✨', '🥂', '🎊'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface WishesSectionProps {
  settings: PublicPhase3Settings;
  approvedWishes: PublicWishCard[];
  loadingWishes: boolean;
  onWishPublished: (wish: PublicWishCard) => void;
  language: Language;
  strings: UIStrings['wishes'];
  isPreviewMode?: boolean;
}

type ComposeStep = 'compose' | 'preview' | 'submitted';

function makeWishKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `wish-${crypto.randomUUID()}`;
  }
  return `wish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function WishCardView({
  guestName,
  message,
  emoji,
  photoUrl,
  dateLabel,
}: {
  guestName: string;
  message: string;
  emoji?: string;
  photoUrl?: string | null;
  dateLabel?: string;
}) {
  return (
    <article className="bg-[#FAF7F0] border border-[#2C221E]/12 rounded-xl overflow-hidden flex flex-col shadow-xs">
      {photoUrl && (
        <div className="w-full aspect-[4/3] bg-[#EAE1D3]/60 overflow-hidden">
          <img
            src={photoUrl}
            alt={`Wedding wish photograph from ${guestName}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
        <p className="text-sm sm:text-[15px] text-[#2C221E] leading-relaxed whitespace-pre-line">
          “{message}”
        </p>
        <div className="pt-3 border-t border-[#2C221E]/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-lg text-[#2C221E] truncate">
              {guestName}
            </p>
            {dateLabel && (
              <p className="text-[11px] text-[#7A675F]">{dateLabel}</p>
            )}
          </div>
          {emoji && (
            <span className="text-xl shrink-0" aria-hidden="true">
              {emoji}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function WishesSection({
  settings,
  approvedWishes,
  loadingWishes,
  onWishPublished,
  language,
  strings,
  isPreviewMode = false,
}: WishesSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ComposeStep>('compose');
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [submissionKey, setSubmissionKey] = useState<string>(() => makeWishKey());

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{
    publishedImmediately: boolean;
  } | null>(null);

  if (!settings.wishesEnabled) {
    return null;
  }

  const heading =
    language === 'ml'
      ? settings.wishesHeadingMl || settings.wishesHeadingEn
      : settings.wishesHeadingEn;
  const subtitle =
    language === 'ml'
      ? settings.wishesSubtitleMl || settings.wishesSubtitleEn
      : settings.wishesSubtitleEn;

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError(
        language === 'ml'
          ? 'JPEG, PNG, WebP അല്ലെങ്കിൽ GIF ചിത്രങ്ങൾ മാത്രം തിരഞ്ഞെടുക്കുക.'
          : 'Please choose a JPEG, PNG, WebP, or GIF image.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setError(
        language === 'ml'
          ? 'ചിത്രത്തിന്റെ വലിപ്പം 5 MB-യിൽ കുറവായിരിക്കണം.'
          : 'Photograph must be 5 MB or smaller.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setPhotoName(file.name);
      }
    };
    reader.onerror = () => {
      setError('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setPhotoDataUrl(null);
    setPhotoName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step 1 -> Step 2 (Local preview ONLY; zero database or upload calls)
  const handleProceedToPreview = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (guestName.trim().length < 2) {
      setError(
        language === 'ml'
          ? 'ദയവായി നിങ്ങളുടെ പേര് നൽകുക.'
          : 'Please enter your name (at least 2 characters).'
      );
      return;
    }
    if (message.trim().length < 3) {
      setError(
        language === 'ml'
          ? 'ദയവായി കുറഞ്ഞത് 3 അക്ഷരങ്ങളെങ്കിലും ഉള്ള ആശംസ എഴുതുക.'
          : 'Please write a wedding wish message (at least 3 characters).'
      );
      return;
    }

    setStep('preview');
  };

  // Step 2 -> Step 3 (Actual submission ONLY after explicit guest confirmation)
  const handleConfirmAndSend = async () => {
    if (sending) return;
    setError(null);

    if (isPreviewMode) {
      setError(
        language === 'ml'
          ? 'ഡ്രാഫ്റ്റ് പ്രിവ്യൂ മോഡിൽ ആശംസകൾ സമർപ്പിക്കാൻ കഴിയില്ല.'
          : 'Submitting wedding wishes is disabled inside Draft Preview. Guests submit on the live wedding site.'
      );
      return;
    }

    setSending(true);
    try {
      const res = await submitPublicWish({
        guestName: guestName.trim(),
        message: message.trim(),
        emoji,
        photoDataUrl,
        previewConfirmed: true,
        clientSubmissionKey: submissionKey,
        website: honeypot,
      });

      const publishedNow =
        res.wish.status === 'approved' && res.wish.isPublished;
      if (publishedNow) {
        onWishPublished({
          id: res.wish.id,
          guestName: res.wish.guestName,
          message: res.wish.message,
          emoji: res.wish.emoji,
          photoUrl: res.wish.photoUrl,
          createdAt: res.wish.createdAt,
        });
      }

      setSubmittedInfo({publishedImmediately: publishedNow});
      setStep('submitted');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send your wedding wish right now. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleWriteAnother = () => {
    setGuestName('');
    setMessage('');
    setEmoji('');
    handleClearPhoto();
    setError(null);
    setSubmittedInfo(null);
    setSubmissionKey(makeWishKey());
    setStep('compose');
  };

  return (
    <section
      id="wishes"
      aria-labelledby="wishes-heading"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-[#F4EFE6]/70 border-y border-[#2C221E]/10"
    >
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
            {strings.sectionKicker}
          </p>
          <h2
            id="wishes-heading"
            className="font-display text-3xl sm:text-5xl font-normal text-[#2C221E] text-balance"
          >
            {heading}
          </h2>
          {subtitle && (
            <p className="mt-4 text-sm sm:text-base text-[#5E4C45] leading-relaxed">
              {subtitle}
            </p>
          )}
        </ScrollReveal>

        {/* Composer / Preview / Confirmation Card */}
        <ScrollReveal delay={0.06} className="max-w-3xl mx-auto mb-16">
          <div className="bg-[#FAF7F0] kasavu-frame p-6 sm:p-10 shadow-sm">
            {step === 'compose' && (
              <form onSubmit={handleProceedToPreview} noValidate className="space-y-6">
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="wishes-website-hp">Website</label>
                  <input
                    id="wishes-website-hp"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#9E2A2B]/30 bg-[#9E2A2B]/8 px-4 py-3 text-xs sm:text-sm text-[#7A1E1F] flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label
                      htmlFor="wish-guest-name"
                      className="text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium"
                    >
                      {strings.guestNameLabel} <span className="text-[#9E2A2B]">*</span>
                    </label>
                    <span className="text-[11px] text-[#7A675F] tabular-nums">
                      {guestName.length}/80
                    </span>
                  </div>
                  <input
                    id="wish-guest-name"
                    type="text"
                    required
                    maxLength={80}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={strings.guestNamePlaceholder}
                    className="w-full px-4 py-3 rounded-lg bg-[#F4EFE6]/60 border border-[#2C221E]/18 text-[#2C221E] text-sm sm:text-base placeholder:text-[#8E7D75] focus:border-[#B68D40] focus:outline-none min-h-[46px]"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label
                      htmlFor="wish-message"
                      className="text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium"
                    >
                      {strings.messageLabel} <span className="text-[#9E2A2B]">*</span>
                    </label>
                    <span className="text-[11px] text-[#7A675F] tabular-nums">
                      {message.length}/500
                    </span>
                  </div>
                  <textarea
                    id="wish-message"
                    required
                    rows={4}
                    maxLength={500}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={strings.messagePlaceholder}
                    className="w-full px-4 py-3 rounded-lg bg-[#F4EFE6]/60 border border-[#2C221E]/18 text-[#2C221E] text-sm sm:text-base placeholder:text-[#8E7D75] focus:border-[#B68D40] focus:outline-none resize-y"
                  />
                </div>

                {/* Optional Blessing Emoji */}
                <div>
                  <span className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2.5">
                    {strings.emojiLabel}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {WISH_EMOJIS.map((item) => {
                      const selected = emoji === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setEmoji(selected ? '' : item)}
                          aria-pressed={selected}
                          className={`w-11 h-11 rounded-lg border text-lg flex items-center justify-center transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#2C221E] border-[#2C221E] ring-2 ring-[#B68D40]/40'
                              : 'bg-[#F4EFE6]/70 border-[#2C221E]/15 hover:bg-[#EAE1D3]'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Photo Upload */}
                <div>
                  <label className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2">
                    {strings.photoLabel}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {photoDataUrl ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-lg border border-[#2C221E]/15 bg-[#F4EFE6]/60">
                      <img
                        src={photoDataUrl}
                        alt="Selected wish attachment preview"
                        className="w-24 h-20 object-cover rounded-md border border-[#2C221E]/10"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-[#2C221E] truncate">
                          {photoName || 'Selected photograph'}
                        </p>
                        <button
                          type="button"
                          onClick={handleClearPhoto}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#9E2A2B] hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{strings.removePhoto}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#2C221E]/20 bg-[#F4EFE6] text-[#2C221E] text-xs sm:text-sm font-medium hover:bg-[#EAE1D3] transition-colors cursor-pointer min-h-[44px]"
                      >
                        <ImagePlus className="w-4 h-4 text-[#B68D40]" aria-hidden="true" />
                        <span>{strings.photoLabel}</span>
                      </button>
                      <span className="text-xs text-[#7A675F]">{strings.photoHint}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-sm font-medium hover:bg-[#3F312B] transition-colors cursor-pointer min-h-[48px]"
                  >
                    <Eye className="w-4 h-4 text-[#D5B97D]" aria-hidden="true" />
                    <span>{strings.previewButton}</span>
                  </button>
                </div>
              </form>
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <div className="text-center space-y-1.5">
                  <h3 className="font-display text-2xl sm:text-3xl text-[#2C221E]">
                    {strings.previewHeading}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E4C45]">
                    {strings.previewNote}
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#9E2A2B]/30 bg-[#9E2A2B]/8 px-4 py-3 text-xs sm:text-sm text-[#7A1E1F] flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="max-w-md mx-auto">
                  <WishCardView
                    guestName={guestName.trim()}
                    message={message.trim()}
                    emoji={emoji}
                    photoUrl={photoDataUrl}
                    dateLabel={
                      language === 'ml' ? 'പ്രിവ്യൂ കാർഡ്' : 'Card Preview'
                    }
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      setError(null);
                      setStep('compose');
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-[#2C221E]/22 bg-[#F4EFE6] text-[#2C221E] text-sm font-medium hover:bg-[#EAE1D3] disabled:opacity-50 transition-colors cursor-pointer min-h-[46px]"
                  >
                    <Edit3 className="w-4 h-4" aria-hidden="true" />
                    <span>{strings.editButton}</span>
                  </button>

                  <button
                    type="button"
                    disabled={sending}
                    onClick={handleConfirmAndSend}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-sm font-medium hover:bg-[#3F312B] disabled:opacity-60 transition-colors cursor-pointer min-h-[46px]"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="w-4 h-4 text-[#D5B97D]" aria-hidden="true" />
                    )}
                    <span>
                      {sending ? strings.sendingButton : strings.confirmSendButton}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {step === 'submitted' && (
              <div className="text-center py-6 space-y-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#5C6B57]/15 text-[#5C6B57]">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <h3 className="font-display text-2xl sm:text-3xl text-[#2C221E]">
                    {strings.successTitle}
                  </h3>
                  <p className="text-sm text-[#5E4C45] leading-relaxed">
                    {submittedInfo?.publishedImmediately
                      ? strings.successPublished
                      : strings.successModerated}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleWriteAnother}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#2C221E]/20 bg-[#F4EFE6] text-[#2C221E] text-xs sm:text-sm font-medium hover:bg-[#EAE1D3] transition-colors cursor-pointer min-h-[44px]"
                >
                  {strings.sendAnother}
                </button>
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* Public Wedding Wishes Wall (Approved & Published Wishes ONLY) */}
        <div id="wishes-wall" className="space-y-8">
          <div className="flex items-center justify-center gap-3 text-center">
            <HeartHandshake className="w-5 h-5 text-[#B68D40]" aria-hidden="true" />
            <h3 className="font-display text-2xl sm:text-3xl text-[#2C221E]">
              {strings.wallHeading}
            </h3>
          </div>

          {loadingWishes ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl bg-[#FAF7F0] border border-[#2C221E]/10 animate-pulse"
                />
              ))}
            </div>
          ) : approvedWishes.length === 0 ? (
            <div className="max-w-xl mx-auto text-center bg-[#FAF7F0] border border-[#2C221E]/10 rounded-xl p-8">
              <p className="text-sm text-[#5E4C45]">{strings.wallEmpty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {approvedWishes.map((wish) => (
                <WishCardView
                  key={wish.id}
                  guestName={wish.guestName}
                  message={wish.message}
                  emoji={wish.emoji}
                  photoUrl={wish.photoUrl}
                  dateLabel={new Date(wish.createdAt).toLocaleDateString(
                    language === 'ml' ? 'ml-IN' : 'en-IN',
                    {dateStyle: 'medium'}
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
