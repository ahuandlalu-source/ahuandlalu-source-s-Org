import {useState, type FormEvent} from 'react';
import {AlertCircle, CheckCircle2, Loader2, Send, UserCheck, UserX} from 'lucide-react';
import type {Language} from '../types/wedding';
import type {PublicPhase3Settings, RsvpAttendance} from '../types/phase3';
import type {UIStrings} from '../config/translations';
import {submitPublicRsvp} from '../services/adminApi';
import {ScrollReveal} from './ScrollReveal';

interface RsvpSectionProps {
  settings: PublicPhase3Settings;
  language: Language;
  strings: UIStrings['rsvp'];
  isPreviewMode?: boolean;
}

function makeSubmissionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `rsvp-${crypto.randomUUID()}`;
  }
  return `rsvp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RsvpSection({
  settings,
  language,
  strings,
  isPreviewMode = false,
}: RsvpSectionProps) {
  const [guestName, setGuestName] = useState('');
  const [attendance, setAttendance] = useState<RsvpAttendance>('attending');
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [message, setMessage] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submissionKey, setSubmissionKey] = useState<string>(() => makeSubmissionKey());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedState, setConfirmedState] = useState<{
    guestName: string;
    attendance: RsvpAttendance;
    attendeeCount: number;
    duplicate: boolean;
  } | null>(null);

  if (!settings.rsvpEnabled) {
    return null;
  }

  const heading =
    language === 'ml'
      ? settings.rsvpHeadingMl || settings.rsvpHeadingEn
      : settings.rsvpHeadingEn;
  const subtitle =
    language === 'ml'
      ? settings.rsvpSubtitleMl || settings.rsvpSubtitleEn
      : settings.rsvpSubtitleEn;

  const activeCustomFields = settings.rsvpCustomFields.filter((f) => f.enabled);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (isPreviewMode) {
      setError(
        language === 'ml'
          ? 'ഡ്രാഫ്റ്റ് പ്രിവ്യൂ മോഡിൽ RSVP സേവ് ചെയ്യുന്നില്ല. ലൈവ് സൈറ്റിൽ പരിശോധിക്കുക.'
          : 'RSVP submissions are disabled inside Draft Preview. Guests submit on the live wedding site.'
      );
      return;
    }

    const cleanName = guestName.trim();
    if (cleanName.length < 2) {
      setError(
        language === 'ml'
          ? 'ദയവായി നിങ്ങളുടെ പേര് നൽകുക.'
          : 'Please enter your full name (at least 2 characters).'
      );
      return;
    }

    for (const field of activeCustomFields) {
      const val = (customValues[field.id] || '').trim();
      if (field.required && !val) {
        const label = language === 'ml' ? field.labelMl || field.labelEn : field.labelEn;
        setError(
          language === 'ml'
            ? `${label} നിർബന്ധമാണ്.`
            : `Please fill in "${label}".`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await submitPublicRsvp({
        guestName: cleanName,
        attendance,
        attendeeCount:
          attendance === 'attending' && settings.rsvpAllowAttendeeCount
            ? attendeeCount
            : attendance === 'attending'
            ? 1
            : 0,
        message: message.trim(),
        customFields: customValues,
        clientSubmissionKey: submissionKey,
        website: honeypot,
      });

      setConfirmedState({
        guestName: res.entry.guestName,
        attendance: res.entry.attendance,
        attendeeCount: res.entry.attendeeCount,
        duplicate: res.duplicate,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your RSVP right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setGuestName('');
    setAttendance('attending');
    setAttendeeCount(1);
    setMessage('');
    setCustomValues({});
    setConfirmedState(null);
    setError(null);
    setSubmissionKey(makeSubmissionKey());
  };

  return (
    <section
      id="rsvp"
      aria-labelledby="rsvp-heading"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto"
    >
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
          {strings.sectionKicker}
        </p>
        <h2
          id="rsvp-heading"
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

      <ScrollReveal delay={0.08}>
        <div className="bg-[#F4EFE6] kasavu-frame p-6 sm:p-10 shadow-sm">
          {confirmedState ? (
            <div className="text-center py-6 space-y-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#5C6B57]/15 text-[#5C6B57]">
                <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="font-display text-2xl sm:text-3xl text-[#2C221E]">
                  {strings.successTitle}
                </h3>
                <p className="text-sm font-medium text-[#2C221E]">
                  {confirmedState.guestName} ·{' '}
                  {confirmedState.attendance === 'attending'
                    ? strings.attendingOption
                    : strings.notAttendingOption}
                  {confirmedState.attendance === 'attending' &&
                  settings.rsvpAllowAttendeeCount
                    ? ` (${confirmedState.attendeeCount})`
                    : ''}
                </p>
                <p className="text-sm text-[#5E4C45] leading-relaxed">
                  {confirmedState.attendance === 'attending'
                    ? strings.successAttending
                    : strings.successNotAttending}
                </p>
                {confirmedState.duplicate && (
                  <p className="text-xs text-[#7A675F]">{strings.duplicateNote}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#2C221E]/20 bg-[#FAF7F0] text-[#2C221E] text-xs sm:text-sm font-medium hover:bg-[#EAE1D3] transition-colors cursor-pointer min-h-[44px]"
              >
                {strings.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Honeypot spam protection (screen-reader & tab ignored) */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="rsvp-website-hp">Website</label>
                <input
                  id="rsvp-website-hp"
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
                <label
                  htmlFor="rsvp-guest-name"
                  className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2"
                >
                  {strings.guestNameLabel} <span className="text-[#9E2A2B]">*</span>
                </label>
                <input
                  id="rsvp-guest-name"
                  type="text"
                  required
                  maxLength={100}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={strings.guestNamePlaceholder}
                  className="w-full px-4 py-3 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm sm:text-base placeholder:text-[#8E7D75] focus:border-[#B68D40] focus:outline-none min-h-[46px]"
                />
              </div>

              <div>
                <span className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2">
                  {strings.attendanceLabel} <span className="text-[#9E2A2B]">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAttendance('attending')}
                    aria-pressed={attendance === 'attending'}
                    className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[48px] ${
                      attendance === 'attending'
                        ? 'bg-[#2C221E] text-[#FAF7F0] border-[#2C221E]'
                        : 'bg-[#FAF7F0] text-[#2C221E] border-[#2C221E]/18 hover:bg-[#EAE1D3]'
                    }`}
                  >
                    <UserCheck
                      className={`w-4 h-4 ${
                        attendance === 'attending' ? 'text-[#D5B97D]' : 'text-[#5C6B57]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{strings.attendingOption}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttendance('not_attending')}
                    aria-pressed={attendance === 'not_attending'}
                    className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer min-h-[48px] ${
                      attendance === 'not_attending'
                        ? 'bg-[#2C221E] text-[#FAF7F0] border-[#2C221E]'
                        : 'bg-[#FAF7F0] text-[#2C221E] border-[#2C221E]/18 hover:bg-[#EAE1D3]'
                    }`}
                  >
                    <UserX
                      className={`w-4 h-4 ${
                        attendance === 'not_attending'
                          ? 'text-[#D5B97D]'
                          : 'text-[#8E7D75]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{strings.notAttendingOption}</span>
                  </button>
                </div>
              </div>

              {attendance === 'attending' && settings.rsvpAllowAttendeeCount && (
                <div>
                  <label
                    htmlFor="rsvp-attendee-count"
                    className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2"
                  >
                    {strings.attendeeCountLabel}
                  </label>
                  <select
                    id="rsvp-attendee-count"
                    value={attendeeCount}
                    onChange={(e) => setAttendeeCount(Number(e.target.value))}
                    className="w-full sm:w-56 px-4 py-3 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm sm:text-base focus:border-[#B68D40] focus:outline-none min-h-[46px] tabular-nums"
                  >
                    {Array.from(
                      {length: Math.max(1, settings.rsvpMaxAttendees)},
                      (_, i) => i + 1
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Admin-configured additional fields */}
              {activeCustomFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {activeCustomFields.map((field) => {
                    const label =
                      language === 'ml'
                        ? field.labelMl || field.labelEn
                        : field.labelEn;
                    const placeholder =
                      language === 'ml'
                        ? field.placeholderMl || field.placeholderEn || ''
                        : field.placeholderEn || '';
                    const val = customValues[field.id] || '';

                    return (
                      <div
                        key={field.id}
                        className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
                      >
                        <label
                          htmlFor={`rsvp-custom-${field.id}`}
                          className="block text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium mb-2"
                        >
                          {label}{' '}
                          {field.required && <span className="text-[#9E2A2B]">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            id={`rsvp-custom-${field.id}`}
                            rows={2}
                            maxLength={300}
                            value={val}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            placeholder={placeholder}
                            className="w-full px-4 py-2.5 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm focus:border-[#B68D40] focus:outline-none resize-y"
                          />
                        ) : field.type === 'select' && field.options?.length ? (
                          <select
                            id={`rsvp-custom-${field.id}`}
                            value={val}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm focus:border-[#B68D40] focus:outline-none min-h-[46px]"
                          >
                            <option value="">Select…</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`rsvp-custom-${field.id}`}
                            type={field.type === 'number' ? 'number' : 'text'}
                            maxLength={150}
                            value={val}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            placeholder={placeholder}
                            className="w-full px-4 py-3 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm focus:border-[#B68D40] focus:outline-none min-h-[46px]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label
                    htmlFor="rsvp-message"
                    className="text-xs uppercase tracking-[0.14em] text-[#5E4C45] font-medium"
                  >
                    {strings.messageLabel}
                  </label>
                  <span className="text-[11px] text-[#7A675F] tabular-nums">
                    {message.length}/600
                  </span>
                </div>
                <textarea
                  id="rsvp-message"
                  rows={3}
                  maxLength={600}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={strings.messagePlaceholder}
                  className="w-full px-4 py-3 rounded-lg bg-[#FAF7F0] border border-[#2C221E]/18 text-[#2C221E] text-sm placeholder:text-[#8E7D75] focus:border-[#B68D40] focus:outline-none resize-y"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-sm font-medium hover:bg-[#3F312B] disabled:opacity-60 transition-colors cursor-pointer min-h-[48px]"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="w-4 h-4 text-[#D5B97D]" aria-hidden="true" />
                  )}
                  <span>
                    {submitting ? strings.submittingButton : strings.submitButton}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </ScrollReveal>
    </section>
  );
}
