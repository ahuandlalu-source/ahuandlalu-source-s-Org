import {useState} from 'react';
import {motion, useReducedMotion} from 'motion/react';
import {ChevronDown} from 'lucide-react';
import type {Language, WeddingConfig} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {KasavuDivider} from './KeralaMotifs';

interface WeddingHeroProps {
  config: WeddingConfig;
  language: Language;
  strings: UIStrings['hero'];
}

export function WeddingHero({config, language, strings}: WeddingHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  const showVideo = Boolean(config.hero.backgroundVideoUrl) && !videoFailed;

  return (
    <section
      id="hero"
      aria-label="Wedding Announcement Hero"
      className="relative min-h-[calc(100dvh-4rem)] w-full flex items-center justify-center overflow-hidden bg-[#2C221E] text-[#FAF7F0]"
    >
      {/* Background Video or Graceful Fallback Image */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {showVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={config.hero.fallbackImageUrl}
            onError={() => setVideoFailed(true)}
            className="w-full h-full object-cover"
          >
            <source src={config.hero.backgroundVideoUrl || ''} />
          </video>
        ) : (
          <img
            src={config.hero.fallbackImageUrl}
            alt={config.hero.fallbackImageAlt[language]}
            loading="eager"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover animate-ken-burns"
          />
        )}

        {/* Measured multi-stop scrim for WCAG AA text legibility */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#2C221E]/65 via-[#2C221E]/48 to-[#2C221E]/85"
          aria-hidden="true"
        />
      </div>

      {/* Hero Foreground Editorial Composition */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-24 text-center">
        <motion.div
          initial={shouldReduceMotion ? false : {opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.85, delay: 0.1, ease: [0.22, 1, 0.36, 1]}}
        >
          <p className="text-xs sm:text-sm tracking-[0.2em] uppercase text-[#E5C98B] mb-4">
            {config.invitation.blessing[language]}
          </p>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.12] tracking-tight text-[#FAF7F0] text-balance">
            <span className="block">{config.couple.bride.fullName[language]}</span>
            <span className="block font-display italic text-[#D5B97D] text-2xl sm:text-4xl my-2">
              &amp;
            </span>
            <span className="block">{config.couple.groom.fullName[language]}</span>
          </h1>

          <KasavuDivider className="my-7 opacity-85" />

          <p className="text-sm sm:text-lg text-[#FAF7F0]/90 max-w-2xl mx-auto leading-relaxed mb-10">
            {config.hero.invitationMessage[language]}
          </p>

          {/* Clean unboxed editorial metadata strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 max-w-3xl mx-auto pt-6 border-t border-[#FAF7F0]/22 text-left sm:text-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#D5B97D] mb-1">
                {strings.dateLabel}
              </p>
              <p className="text-sm sm:text-base font-medium text-[#FAF7F0]">
                {config.dateAndTime.displayDate[language]}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#D5B97D] mb-1">
                {strings.muhurthamLabel}
              </p>
              <p className="text-sm sm:text-base font-medium text-[#FAF7F0] tabular-nums">
                {config.dateAndTime.muhurthamWindow[language]}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#D5B97D] mb-1">
                {strings.venueLabel}
              </p>
              <p className="text-sm sm:text-base font-medium text-[#FAF7F0]">
                {config.venue.name[language]}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Subtle Scroll Indicator */}
      <a
        href="#couple"
        aria-label={strings.scrollPrompt}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 inline-flex items-center justify-center text-[#FAF7F0]/80 hover:text-[#FAF7F0] transition-colors p-2.5"
      >
        <ChevronDown
          className={`w-5 h-5 text-[#D5B97D] ${shouldReduceMotion ? '' : 'animate-bounce'}`}
          aria-hidden="true"
        />
      </a>
    </section>
  );
}
