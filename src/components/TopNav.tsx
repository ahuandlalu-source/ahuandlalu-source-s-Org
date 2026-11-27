import {useEffect, useState} from 'react';
import {Menu, X} from 'lucide-react';
import type {Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {LanguageSwitcher} from './LanguageSwitcher';

interface TopNavProps {
  coupleShortTitle: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  strings: UIStrings['nav'];
  showLanguageSwitcher?: boolean;
}

export function TopNav({
  coupleShortTitle,
  language,
  onLanguageChange,
  strings,
  showLanguageSwitcher = true,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {href: '#couple', label: strings.couple},
    {href: '#details', label: strings.schedule},
    {href: '#gallery', label: strings.gallery},
    {href: '#rsvp', label: strings.rsvp},
    {href: '#wishes', label: strings.wishes},
  ];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen]);

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF7F0]/92 backdrop-blur-md border-b border-[#2C221E]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#hero"
          className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[#2C221E] whitespace-nowrap shrink-0"
        >
          {coupleShortTitle}
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E4C45]"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-[#2C221E] hover:underline underline-offset-4 decoration-[#B68D40] transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary control (Language switcher on desktop, menu + language on mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          {showLanguageSwitcher && (
            <LanguageSwitcher language={language} onChange={onLanguageChange} />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#2C221E]/12 bg-[#F4EFE6] text-[#2C221E] hover:bg-[#EAE1D3] transition-colors cursor-pointer shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label="Mobile navigation"
          className="md:hidden border-t border-[#2C221E]/10 bg-[#FAF7F0] px-4 py-3 flex flex-col gap-1"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className="px-3 py-3 min-h-[44px] flex items-center text-base font-medium text-[#2C221E] rounded-lg hover:bg-[#F4EFE6] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
