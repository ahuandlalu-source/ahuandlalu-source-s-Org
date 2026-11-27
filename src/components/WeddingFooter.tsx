import {ArrowUp} from 'lucide-react';
import type {Language, WeddingConfig} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {KasavuDivider, NilavilakkuCrest} from './KeralaMotifs';

interface WeddingFooterProps {
  config: WeddingConfig;
  language: Language;
  strings: UIStrings['footer'];
}

function isSafeExternalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function WeddingFooter({config, language, strings}: WeddingFooterProps) {
  const showDateAndNames = config.footer.showDateAndNames !== false;
  const showCredit =
    Boolean(config.footer.showCredit) &&
    Boolean(config.footer.creditName?.trim());

  return (
    <footer className="bg-[#2C221E] text-[#FAF7F0] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#B68D40]/30">
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex justify-center text-[#D5B97D] mb-5">
          <NilavilakkuCrest className="w-10 h-10" />
        </div>

        <p className="font-display italic text-2xl sm:text-3xl text-[#FAF7F0] max-w-2xl mx-auto leading-relaxed">
          {config.footer.blessingQuote[language]}
        </p>

        <KasavuDivider className="my-8 opacity-75" />

        {showDateAndNames && (
          <>
            <p className="font-display text-2xl text-[#D5B97D]">
              {config.couple.bride.nickname[language]} &amp;{' '}
              {config.couple.groom.nickname[language]}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#EAE1D3]/75">
              {config.dateAndTime.displayDate[language]}
            </p>
          </>
        )}

        <p className="mt-3 text-sm text-[#EAE1D3]/85">
          {config.footer.hostsLine[language]}
        </p>

        <div className="mt-8">
          <a
            href="#hero"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FAF7F0]/20 text-xs font-medium text-[#FAF7F0] hover:bg-[#FAF7F0]/10 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5 text-[#D5B97D]" aria-hidden="true" />
            <span>{strings.backToTop}</span>
          </a>
        </div>

        {showCredit && (
          <p className="mt-8 text-xs text-[#EAE1D3]/75">
            Made with love by{' '}
            {isSafeExternalUrl(config.footer.creditUrl) ? (
              <a
                href={config.footer.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 text-[#D5B97D] hover:text-[#FAF7F0]"
              >
                {config.footer.creditName}
              </a>
            ) : (
              <span className="text-[#D5B97D]">{config.footer.creditName}</span>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
