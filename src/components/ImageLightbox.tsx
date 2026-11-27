import {useEffect, useRef} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';
import type {GalleryPhoto, Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {ResilientImage} from './KeralaMotifs';

interface ImageLightboxProps {
  photos: GalleryPhoto[];
  currentIndex: number | null;
  language: Language;
  strings: UIStrings['gallery'];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ImageLightbox({
  photos,
  currentIndex,
  language,
  strings,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxProps) {
  const shouldReduceMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isOpen = currentIndex !== null && photos[currentIndex] !== undefined;
  const activePhoto = isOpen && currentIndex !== null ? photos[currentIndex] : null;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        onPrev();
      } else if (event.key === 'ArrowRight') {
        onNext();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, onPrev, onNext]);

  return (
    <AnimatePresence>
      {isOpen && activePhoto && currentIndex !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.alt[language]}
          initial={shouldReduceMotion ? {opacity: 1} : {opacity: 0}}
          animate={{opacity: 1}}
          exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0}}
          transition={{duration: 0.22}}
          className="fixed inset-0 z-50 bg-[#1B1411]/94 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6"
          onClick={onClose}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between gap-4 text-[#FAF7F0] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs sm:text-sm font-medium tracking-wider tabular-nums text-[#EAE1D3]">
              {currentIndex + 1} / {photos.length}
            </span>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={strings.closeLightbox}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/20 text-[#FAF7F0] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Center Image Viewer with Touch Swipe */}
          <div
            className="relative flex-1 flex items-center justify-center my-3 sm:my-6 select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
              const delta = endX - touchStartX.current;
              if (delta > 45) onPrev();
              else if (delta < -45) onNext();
              touchStartX.current = null;
            }}
          >
            <button
              type="button"
              onClick={onPrev}
              aria-label={strings.previousPhoto}
              className="hidden sm:inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/22 text-[#FAF7F0] transition-colors cursor-pointer mr-4 shrink-0"
            >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </button>

            <motion.div
              key={activePhoto.id}
              initial={shouldReduceMotion ? false : {opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              transition={{duration: 0.25, ease: [0.22, 1, 0.36, 1]}}
              className="max-h-[72dvh] max-w-4xl w-full flex items-center justify-center overflow-hidden rounded-lg"
            >
              <ResilientImage
                src={activePhoto.src}
                alt={activePhoto.alt[language]}
                loading="eager"
                className="max-h-[72dvh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
            </motion.div>

            <button
              type="button"
              onClick={onNext}
              aria-label={strings.nextPhoto}
              className="hidden sm:inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/22 text-[#FAF7F0] transition-colors cursor-pointer ml-4 shrink-0"
            >
              <ChevronRight className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Caption & Mobile Controls */}
          <div
            className="flex flex-col items-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg sm:text-xl text-[#FAF7F0]">
              {activePhoto.caption[language]}
            </p>
            <div className="flex sm:hidden items-center gap-4">
              <button
                type="button"
                onClick={onPrev}
                aria-label={strings.previousPhoto}
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF7F0]/12 text-[#FAF7F0] cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label={strings.nextPhoto}
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF7F0]/12 text-[#FAF7F0] cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p className="hidden sm:block text-xs text-[#EAE1D3]/65">
              {strings.keyboardHint}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
