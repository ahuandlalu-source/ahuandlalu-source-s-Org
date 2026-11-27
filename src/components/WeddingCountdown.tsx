import {useEffect, useState} from 'react';
import type {UIStrings} from '../config/translations';
import {KasavuDivider} from './KeralaMotifs';
import {ScrollReveal} from './ScrollReveal';

interface WeddingCountdownProps {
  targetIso: string;
  strings: UIStrings['countdown'];
  headingOverride?: string;
}

interface TimeRemaining {
  passed: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateRemaining(targetIso: string): TimeRemaining {
  const targetTime = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = targetTime - now;

  if (Number.isNaN(targetTime) || diff <= 0) {
    return {passed: true, days: 0, hours: 0, minutes: 0, seconds: 0};
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {passed: false, days, hours, minutes, seconds};
}

export function WeddingCountdown({
  targetIso,
  strings,
  headingOverride,
}: WeddingCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining>(() =>
    calculateRemaining(targetIso)
  );

  useEffect(() => {
    setRemaining(calculateRemaining(targetIso));
    const timer = window.setInterval(() => {
      setRemaining(calculateRemaining(targetIso));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  const units = [
    {label: strings.days, value: remaining.days},
    {label: strings.hours, value: remaining.hours},
    {label: strings.minutes, value: remaining.minutes},
    {label: strings.seconds, value: remaining.seconds},
  ];

  return (
    <section
      aria-labelledby="countdown-heading"
      className="py-16 sm:py-24 bg-[#F4EFE6] border-y border-[#2C221E]/8 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-5xl mx-auto text-center">
        <ScrollReveal>
          <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
            {strings.sectionKicker}
          </p>
          <h2
            id="countdown-heading"
            className="font-display text-3xl sm:text-4xl font-normal text-[#2C221E] text-balance"
          >
            {remaining.passed
              ? strings.celebratedTitle
              : headingOverride || strings.sectionTitle}
          </h2>

          {remaining.passed ? (
            <div className="mt-8 max-w-xl mx-auto">
              <KasavuDivider className="mb-6" />
              <p className="text-base sm:text-lg text-[#5E4C45] leading-relaxed">
                {strings.celebratedMessage}
              </p>
            </div>
          ) : (
            <>
              <div
                role="timer"
                aria-live="off"
                className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto"
              >
                {units.map((unit) => (
                  <div
                    key={unit.label}
                    className="bg-[#FAF7F0] border border-[#2C221E]/10 rounded-xl px-4 py-6 sm:py-8 shadow-[0_6px_24px_-16px_rgba(44,34,30,0.16)]"
                  >
                    <p className="font-display text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2C221E] tabular-nums leading-none">
                      {String(unit.value).padStart(2, '0')}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#7A675F]">
                      {unit.label}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-xs text-[#7A675F] tracking-wide">
                {strings.timezoneNote}
              </p>
            </>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
