import type {Language} from '../types/wedding';

interface LanguageSwitcherProps {
  language: Language;
  onChange: (lang: Language) => void;
  variant?: 'light' | 'dark';
}

export function LanguageSwitcher({
  language,
  onChange,
  variant = 'light',
}: LanguageSwitcherProps) {
  const containerClass =
    variant === 'dark'
      ? 'bg-[#2C221E]/55 border-[#FAF7F0]/25 text-[#FAF7F0]/80'
      : 'bg-[#F4EFE6] border-[#2C221E]/12 text-[#5E4C45]';

  const activeClass =
    variant === 'dark'
      ? 'bg-[#FAF7F0] text-[#2C221E]'
      : 'bg-[#2C221E] text-[#FAF7F0]';

  const inactiveClass =
    variant === 'dark'
      ? 'hover:text-[#FAF7F0]'
      : 'hover:text-[#2C221E]';

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={`inline-flex items-center p-0.5 rounded-lg border text-xs font-medium shrink-0 ${containerClass}`}
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={language === 'en'}
        className={`px-3 py-1.5 rounded-md transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
          language === 'en' ? activeClass : inactiveClass
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => onChange('ml')}
        aria-pressed={language === 'ml'}
        lang="ml"
        className={`px-3 py-1.5 rounded-md transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
          language === 'ml' ? activeClass : inactiveClass
        }`}
      >
        മലയാളം
      </button>
    </div>
  );
}
