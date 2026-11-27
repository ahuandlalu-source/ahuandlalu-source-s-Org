import {useEffect, useRef} from 'react';
import {ArrowRight, RotateCcw, X} from 'lucide-react';
import type {CouplePersonProfile, Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {ResilientImage} from './KeralaMotifs';

interface ProfileRevealProps {
  person: CouplePersonProfile;
  language: Language;
  strings: UIStrings['couple'];
  isRevealed: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function ProfileReveal({
  person,
  language,
  strings,
  isRevealed,
  onToggle,
  onClose,
}: ProfileRevealProps) {
  const frontButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasRevealedRef = useRef(false);

  useEffect(() => {
    if (isRevealed) {
      wasRevealedRef.current = true;
      const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 120);
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else if (wasRevealedRef.current) {
      wasRevealedRef.current = false;
      frontButtonRef.current?.focus();
    }
    return undefined;
  }, [isRevealed, onClose]);

  return (
    <article className="perspective-1200 w-full">
      <div
        className={`relative w-full min-h-[590px] sm:min-h-[620px] transition-transform duration-700 preserve-3d motion-reduce:transition-none ${
          isRevealed ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front Face: Interactive Portrait Card */}
        <button
          ref={frontButtonRef}
          type="button"
          onClick={onToggle}
          aria-expanded={isRevealed}
          aria-label={`${person.fullName[language]} — ${strings.knowMore}`}
          aria-hidden={isRevealed}
          tabIndex={isRevealed ? -1 : 0}
          className={`group text-left absolute inset-0 w-full h-full backface-hidden bg-[#F4EFE6] border border-[#2C221E]/10 hover:border-[#B68D40]/45 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm cursor-pointer transition-colors duration-200 ${
            isRevealed ? 'pointer-events-none motion-reduce:hidden' : ''
          }`}
        >
          <div className="relative h-[375px] sm:h-[415px] w-full overflow-hidden bg-[#EAE1D3]">
            <ResilientImage
              src={person.portraitUrl}
              alt={person.portraitAlt[language]}
              loading="eager"
              fallbackLabel={person.fullName[language]}
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-start gap-4 bg-[#F4EFE6] flex-1 w-full justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#7A675F] mb-1">
                {person.roleLabel[language]}
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#2C221E] leading-snug">
                {person.fullName[language]}
              </h3>
            </div>

            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#2C221E]/20 bg-[#FAF7F0] text-[#2C221E] text-sm font-medium group-hover:bg-[#2C221E] group-hover:text-[#FAF7F0] transition-colors duration-200 min-h-[44px]">
              <span>{strings.knowMore}</span>
              <ArrowRight
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </button>

        {/* Back Face: Separate Family Genealogy & Personal Details */}
        <div
          aria-hidden={!isRevealed}
          className={`absolute inset-0 backface-hidden rotate-y-180 bg-[#F4EFE6] border border-[#B68D40]/45 rounded-xl p-6 sm:p-8 flex flex-col justify-between shadow-sm overflow-y-auto ${
            !isRevealed ? 'pointer-events-none motion-reduce:hidden' : 'motion-reduce:rotate-y-0'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#2C221E]/10">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#B68D40] mb-1">
                  {person.roleLabel[language]}
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#2C221E]">
                  {person.fullName[language]}
                </h3>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                tabIndex={isRevealed ? 0 : -1}
                aria-label={strings.closeProfileAria}
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#2C221E]/15 bg-[#FAF7F0] text-[#2C221E] hover:bg-[#EAE1D3] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[#7A675F] mb-1">
                  {strings.parentsLabel}
                </dt>
                <dd className="text-[#2C221E] font-medium leading-relaxed">
                  {person.fatherName[language]} &amp; {person.motherName[language]}
                </dd>
              </div>

              <div className="pt-3 border-t border-[#2C221E]/8">
                <dt className="text-xs uppercase tracking-[0.12em] text-[#7A675F] mb-1.5">
                  {strings.grandparentsLabel}
                </dt>
                <dd className="space-y-1.5 text-[#5E4C45]">
                  <p>
                    <span className="font-medium text-[#2C221E]">{strings.paternalLabel}: </span>
                    {person.paternalGrandparents[language]}
                  </p>
                  <p>
                    <span className="font-medium text-[#2C221E]">{strings.maternalLabel}: </span>
                    {person.maternalGrandparents[language]}
                  </p>
                </dd>
              </div>

              <div className="pt-3 border-t border-[#2C221E]/8">
                <dt className="text-xs uppercase tracking-[0.12em] text-[#7A675F] mb-1">
                  {strings.hometownLabel}
                </dt>
                <dd className="text-[#2C221E]">{person.hometown[language]}</dd>
              </div>

              <div className="pt-3 border-t border-[#2C221E]/8">
                <dt className="text-xs uppercase tracking-[0.12em] text-[#7A675F] mb-1">
                  {strings.aboutLabel}
                </dt>
                <dd className="text-[#5E4C45] leading-relaxed">
                  {person.personalIntro[language]}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 pt-4 border-t border-[#2C221E]/10 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-[#7A675F]">
              {person.additionalNote?.[language] || strings.placeholderTag}
            </span>
            <button
              type="button"
              onClick={onClose}
              tabIndex={isRevealed ? 0 : -1}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2C221E] text-[#FAF7F0] text-xs font-medium hover:bg-[#3F312B] transition-colors cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{strings.returnToPortrait}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
