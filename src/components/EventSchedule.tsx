import type {Language, WeddingEvent} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {ScrollReveal} from './ScrollReveal';

interface EventScheduleProps {
  events: WeddingEvent[];
  language: Language;
  strings: UIStrings['details'];
}

export function EventSchedule({events, language, strings}: EventScheduleProps) {
  const configuredEvents = [...events]
    .filter(
      (evt) =>
        evt.visible !== false &&
        evt.title[language].trim().length > 0 &&
        evt.timeRange[language].trim().length > 0
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (configuredEvents.length === 0) return null;

  return (
    <div className="mt-16 pt-14 border-t border-[#2C221E]/10">
      <ScrollReveal>
        <h3 className="font-display text-2xl sm:text-3xl font-normal text-[#2C221E] mb-10 text-center">
          {strings.scheduleHeading}
        </h3>
      </ScrollReveal>

      <ol className="relative max-w-3xl mx-auto space-y-6">
        {configuredEvents.map((event, index) => (
          <ScrollReveal key={event.id} delay={index * 0.06}>
            <li
              className={`rounded-xl p-6 sm:p-7 border transition-colors ${
                event.isMuhurtham
                  ? 'bg-[#F4EFE6] border-[#B68D40]/45 shadow-sm'
                  : 'bg-[#FAF7F0] border-[#2C221E]/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-2">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-xs font-medium text-[#B68D40] tabular-nums">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <h4 className="font-display text-xl sm:text-2xl font-medium text-[#2C221E]">
                    {event.title[language]}
                  </h4>
                  {event.isMuhurtham && (
                    <span className="text-xs font-medium text-[#9E6361]">
                      · {strings.muhurthamHighlight}
                    </span>
                  )}
                </div>

                <span className="text-xs sm:text-sm font-medium text-[#5E4C45] tabular-nums shrink-0">
                  {event.timeRange[language]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#7A675F] mb-2">
                <span>{event.dateLabel[language]}</span>
                <span aria-hidden="true">·</span>
                <span>{event.venueName[language]}</span>
              </div>

              {event.description?.[language] && (
                <p className="text-sm text-[#5E4C45] leading-relaxed mt-2">
                  {event.description[language]}
                </p>
              )}

              {event.imageUrl && (
                <div className="mt-4 overflow-hidden rounded-lg border border-[#2C221E]/10 max-h-56">
                  <img
                    src={event.imageUrl}
                    alt={event.title[language]}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
            </li>
          </ScrollReveal>
        ))}
      </ol>
    </div>
  );
}
