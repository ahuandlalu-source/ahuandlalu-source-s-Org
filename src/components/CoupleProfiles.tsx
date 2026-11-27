import {useState} from 'react';
import type {Language, WeddingConfig} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {ProfileReveal} from './ProfileReveal';
import {ScrollReveal} from './ScrollReveal';

interface CoupleProfilesProps {
  couple: WeddingConfig['couple'];
  language: Language;
  strings: UIStrings['couple'];
  headingOverride?: string;
  subtitleOverride?: string;
}

export function CoupleProfiles({
  couple,
  language,
  strings,
  headingOverride,
  subtitleOverride,
}: CoupleProfilesProps) {
  const [revealedBride, setRevealedBride] = useState(false);
  const [revealedGroom, setRevealedGroom] = useState(false);

  return (
    <section
      id="couple"
      aria-labelledby="couple-heading"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
    >
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
          {strings.sectionKicker}
        </p>
        <h2
          id="couple-heading"
          className="font-display text-3xl sm:text-5xl font-normal text-[#2C221E] text-balance"
        >
          {headingOverride || strings.sectionTitle}
        </h2>
        <p className="mt-4 text-sm sm:text-base text-[#5E4C45]">
          {subtitleOverride || strings.sectionSubtitle}
        </p>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
        <ScrollReveal delay={0.05}>
          <ProfileReveal
            person={couple.bride}
            language={language}
            strings={strings}
            isRevealed={revealedBride}
            onToggle={() => setRevealedBride((prev) => !prev)}
            onClose={() => setRevealedBride(false)}
          />
        </ScrollReveal>

        <ScrollReveal delay={0.14}>
          <ProfileReveal
            person={couple.groom}
            language={language}
            strings={strings}
            isRevealed={revealedGroom}
            onToggle={() => setRevealedGroom((prev) => !prev)}
            onClose={() => setRevealedGroom(false)}
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
