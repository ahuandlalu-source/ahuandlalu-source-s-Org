import {useState} from 'react';
import {CalendarPlus, Check, MapPin, Clock, Calendar} from 'lucide-react';
import type {Language, WeddingConfig} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {downloadWeddingCalendarReminder} from '../utils/calendar';
import {EventSchedule} from './EventSchedule';
import {ScrollReveal} from './ScrollReveal';

interface WeddingDetailsProps {
  config: WeddingConfig;
  language: Language;
  strings: UIStrings['details'];
  headingOverride?: string;
}

export function WeddingDetails({
  config,
  language,
  strings,
  headingOverride,
}: WeddingDetailsProps) {
  const [calendarSaved, setCalendarSaved] = useState(false);

  const handleSaveCalendar = () => {
    downloadWeddingCalendarReminder(config);
    setCalendarSaved(true);
    window.setTimeout(() => setCalendarSaved(false), 3000);
  };

  return (
    <section
      id="details"
      aria-labelledby="details-heading"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
    >
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
          {strings.sectionKicker}
        </p>
        <h2
          id="details-heading"
          className="font-display text-3xl sm:text-5xl font-normal text-[#2C221E] text-balance"
        >
          {headingOverride || strings.sectionTitle}
        </h2>
        {config.hero.additionalInfo?.[language] && (
          <p className="mt-4 text-sm sm:text-base text-[#5E4C45]">
            {config.hero.additionalInfo[language]}
          </p>
        )}
      </ScrollReveal>

      {/* Primary 3-column summary + Venue & Actions */}
      <ScrollReveal delay={0.08}>
        <div className="bg-[#F4EFE6] border border-[#2C221E]/10 rounded-xl p-6 sm:p-10 lg:p-12 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Date */}
            <div className="space-y-2 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r border-[#2C221E]/10 lg:pr-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#7A675F]">
                <Calendar className="w-4 h-4 text-[#B68D40]" aria-hidden="true" />
                <span>{strings.dateTitle}</span>
              </div>
              <p className="font-display text-2xl sm:text-3xl text-[#2C221E]">
                {config.dateAndTime.displayDate[language]}
              </p>
              {config.dateAndTime.malayalamCalendarDate?.[language] && (
                <p className="text-xs sm:text-sm text-[#5E4C45]">
                  {config.dateAndTime.malayalamCalendarDate[language]}
                </p>
              )}
            </div>

            {/* Muhurtham */}
            <div className="space-y-2 pb-6 lg:pb-0 border-b lg:border-b-0 lg:border-r border-[#2C221E]/10 lg:pr-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#7A675F]">
                <Clock className="w-4 h-4 text-[#B68D40]" aria-hidden="true" />
                <span>{strings.muhurthamTitle}</span>
              </div>
              <p className="font-display text-2xl sm:text-3xl text-[#2C221E] tabular-nums">
                {config.dateAndTime.muhurthamWindow[language]}
              </p>
              <p className="text-xs sm:text-sm text-[#5E4C45]">
                {config.venue.directionsHint?.[language]}
              </p>
            </div>

            {/* Venue & Directions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#7A675F]">
                <MapPin className="w-4 h-4 text-[#B68D40]" aria-hidden="true" />
                <span>{strings.venueTitle}</span>
              </div>
              <p className="font-display text-2xl text-[#2C221E] leading-snug">
                {config.venue.name[language]}
              </p>
              <address className="not-italic text-sm text-[#5E4C45] leading-relaxed">
                {config.venue.addressLine1[language]}
                <br />
                {config.venue.addressLine2[language]}
              </address>

              <div className="pt-3 flex flex-wrap items-center gap-3">
                <a
                  href={config.venue.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-xs sm:text-sm font-medium hover:bg-[#3F312B] transition-colors min-h-[44px] whitespace-nowrap"
                >
                  <MapPin className="w-4 h-4 text-[#D5B97D]" aria-hidden="true" />
                  <span>{strings.getDirections}</span>
                </a>

                <button
                  type="button"
                  onClick={handleSaveCalendar}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#2C221E]/20 bg-[#FAF7F0] text-[#2C221E] text-xs sm:text-sm font-medium hover:bg-[#EAE1D3] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
                >
                  {calendarSaved ? (
                    <Check className="w-4 h-4 text-[#5C6B57]" aria-hidden="true" />
                  ) : (
                    <CalendarPlus className="w-4 h-4 text-[#B68D40]" aria-hidden="true" />
                  )}
                  <span>
                    {calendarSaved
                      ? language === 'ml'
                        ? 'കലണ്ടർ ഫയൽ ഡൗൺലോഡ് ചെയ്തു'
                        : 'Calendar Reminder Saved'
                      : strings.addToCalendar}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <EventSchedule events={config.events} language={language} strings={strings} />
    </section>
  );
}
