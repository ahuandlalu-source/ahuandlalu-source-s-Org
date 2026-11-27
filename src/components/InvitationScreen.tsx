import {motion, useReducedMotion} from 'motion/react';
import {ArrowRight} from 'lucide-react';
import type {Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {KasavuDivider, NilavilakkuCrest} from './KeralaMotifs';
import {LanguageSwitcher} from './LanguageSwitcher';

interface InvitationScreenProps {
  brideNickname: string;
  groomNickname: string;
  blessing: string;
  phrase: string;
  openButtonLabel: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  strings: UIStrings['invitation'];
  onOpen: () => void;
  showLanguageSwitcher?: boolean;
}

export function InvitationScreen({
  brideNickname,
  groomNickname,
  blessing,
  phrase,
  openButtonLabel,
  language,
  onLanguageChange,
  strings,
  onOpen,
  showLanguageSwitcher = true,
}: InvitationScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <main
      aria-label="Wedding Invitation Cover"
      className="min-h-dvh w-full bg-[#FAF7F0] paper-grain flex flex-col justify-between px-4 py-6 sm:px-8 sm:py-8 relative overflow-hidden"
    >
      {/* Top quiet header row with language switch */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 relative z-10">
        <span className="text-xs font-medium tracking-[0.14em] uppercase text-[#7A675F] truncate">
          {strings.closedNote}
        </span>
        {showLanguageSwitcher && (
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
        )}
      </div>

      {/* Centered physical invitation card */}
      <div className="flex-1 flex items-center justify-center py-6 sm:py-10 relative z-10">
        <motion.section
          initial={shouldReduceMotion ? false : {opacity: 0, y: 16}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.75, ease: [0.22, 1, 0.36, 1]}}
          className="w-full max-w-xl bg-[#F4EFE6] kasavu-frame px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_24px_60px_-28px_rgba(44,34,30,0.22)] relative"
        >
          {/* Delicate top kasavu accent stripe */}
          <div className="h-1 w-28 mx-auto kasavu-border-x mb-7" aria-hidden="true" />

          <div className="flex justify-center text-[#B68D40] mb-4">
            <NilavilakkuCrest className="w-11 h-11" />
          </div>

          <p className="text-xs sm:text-[13px] tracking-[0.18em] uppercase text-[#7A675F] mb-6">
            {blessing}
          </p>

          {/* ONLY Nicknames are rendered on the closed invitation */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-normal text-[#2C221E] leading-[1.08] tracking-tight text-balance">
            <span>{brideNickname}</span>
            <span className="block sm:inline font-display italic text-[#B68D40] text-3xl sm:text-5xl mx-3 my-1 sm:my-0">
              &amp;
            </span>
            <span>{groomNickname}</span>
          </h1>

          <KasavuDivider className="my-7" />

          <p className="text-sm sm:text-base text-[#5E4C45] max-w-md mx-auto leading-relaxed mb-9">
            {phrase}
          </p>

          <button
            type="button"
            onClick={onOpen}
            className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-sm sm:text-base font-medium tracking-wide hover:bg-[#3F312B] active:scale-[0.99] transition-all duration-200 cursor-pointer shadow-sm min-h-[48px] whitespace-nowrap"
          >
            <span>{openButtonLabel}</span>
            <ArrowRight
              className="w-4 h-4 text-[#D5B97D] transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>

          <p className="mt-5 text-xs text-[#7A675F]">
            {strings.auspiciousInvocation}
          </p>

          <div className="h-1 w-28 mx-auto kasavu-border-x mt-8" aria-hidden="true" />
        </motion.section>
      </div>

      {/* Subtle footer spacing */}
      <div className="w-full max-w-4xl mx-auto text-center text-xs text-[#7A675F]/80 relative z-10">
        {shouldReduceMotion ? strings.reducedMotionHint : ''}
      </div>
    </main>
  );
}
