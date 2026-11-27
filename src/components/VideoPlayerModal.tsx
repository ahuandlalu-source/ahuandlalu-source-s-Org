import {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {AlertCircle, Loader2, Pause, Play, RotateCcw, X} from 'lucide-react';
import type {GalleryVideo, Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';

interface VideoPlayerModalProps {
  video: GalleryVideo | null;
  language: Language;
  strings: UIStrings['videos'];
  onClose: () => void;
}

export function VideoPlayerModal({
  video,
  language,
  strings,
  onClose,
}: VideoPlayerModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [previewProgress, setPreviewProgress] = useState(0);

  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!video) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setHasError(false);
    setIsLoading(Boolean(video.videoUrl));
    setPreviewPlaying(true);
    setPreviewProgress(0);
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [video, onClose]);

  // Smooth progress timer for sample placeholder preview mode
  useEffect(() => {
    if (!video || video.videoUrl || hasError || !previewPlaying) return;
    const interval = window.setInterval(() => {
      setPreviewProgress((prev) => (prev >= 100 ? 0 : prev + 1.2));
    }, 250);
    return () => window.clearInterval(interval);
  }, [video, hasError, previewPlaying]);

  const handleRetry = () => {
    setHasError(false);
    if (video?.videoUrl && videoRef.current) {
      setIsLoading(true);
      videoRef.current.load();
    } else {
      setPreviewPlaying(true);
      setPreviewProgress(0);
    }
  };

  return (
    <AnimatePresence>
      {video && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={video.title[language]}
          initial={shouldReduceMotion ? {opacity: 1} : {opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.22}}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-[#1B1411]/92 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={shouldReduceMotion ? false : {opacity: 0, y: 12, scale: 0.98}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.25, ease: [0.22, 1, 0.36, 1]}}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#2C221E] border border-[#B68D40]/35 rounded-xl overflow-hidden shadow-2xl text-[#FAF7F0]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#FAF7F0]/12">
              <div className="min-w-0">
                <h3 className="font-display text-xl sm:text-2xl text-[#FAF7F0] truncate">
                  {video.title[language]}
                </h3>
                <p className="text-xs text-[#EAE1D3]/75 truncate">
                  {video.caption[language]}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={strings.closeVideo}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/20 text-[#FAF7F0] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Video Stage */}
            <div className="relative aspect-video w-full bg-[#191310] overflow-hidden flex items-center justify-center">
              {hasError ? (
                <div className="p-8 text-center max-w-md space-y-4">
                  <AlertCircle
                    className="w-10 h-10 text-[#D5B97D] mx-auto"
                    aria-hidden="true"
                  />
                  <h4 className="font-display text-2xl text-[#FAF7F0]">
                    {strings.errorTitle}
                  </h4>
                  <p className="text-sm text-[#EAE1D3]/80 leading-relaxed">
                    {strings.errorBody}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FAF7F0] text-[#2C221E] text-xs font-medium hover:bg-[#EAE1D3] transition-colors cursor-pointer min-h-[40px]"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>{strings.retryPlayback}</span>
                  </button>
                </div>
              ) : video.videoUrl ? (
                <>
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#191310]/80">
                      <Loader2
                        className="w-7 h-7 text-[#D5B97D] animate-spin"
                        aria-hidden="true"
                      />
                      <span className="text-xs text-[#EAE1D3]">
                        {strings.loadingVideo}
                      </span>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={video.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    onCanPlay={() => setIsLoading(false)}
                    onWaiting={() => setIsLoading(true)}
                    onPlaying={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      setHasError(true);
                    }}
                    className="w-full h-full object-contain"
                  />
                </>
              ) : (
                /* Interactive Sample Preview Player when no production MP4 is attached yet */
                <div className="relative w-full h-full flex flex-col justify-between">
                  <img
                    src={video.posterUrl}
                    alt={video.title[language]}
                    referrerPolicy="no-referrer"
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ${
                      previewPlaying && !shouldReduceMotion ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#191310]/92 via-[#191310]/45 to-[#191310]/55"
                    aria-hidden="true"
                  />

                  <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between gap-4">
                    <span className="text-xs font-medium tracking-wider uppercase text-[#D5B97D]">
                      {strings.placeholderPreviewTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHasError(true)}
                      className="text-xs text-[#EAE1D3]/80 hover:text-[#FAF7F0] underline underline-offset-4 cursor-pointer"
                    >
                      {strings.simulateErrorLabel}
                    </button>
                  </div>

                  <div className="relative z-10 px-6 text-center max-w-lg mx-auto">
                    <button
                      type="button"
                      onClick={() => setPreviewPlaying((prev) => !prev)}
                      aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FAF7F0]/18 hover:bg-[#FAF7F0]/28 border border-[#D5B97D]/60 text-[#FAF7F0] backdrop-blur-sm transition-colors cursor-pointer mb-4"
                    >
                      {previewPlaying ? (
                        <Pause className="w-6 h-6" aria-hidden="true" />
                      ) : (
                        <Play className="w-6 h-6 ml-0.5" aria-hidden="true" />
                      )}
                    </button>
                    <p className="text-xs sm:text-sm text-[#EAE1D3]/90 leading-relaxed">
                      {strings.placeholderPreviewBody}
                    </p>
                  </div>

                  {/* Interactive Scrub Bar */}
                  <div className="relative z-10 px-5 py-4 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPreviewPlaying((prev) => !prev)}
                      aria-label={previewPlaying ? 'Pause' : 'Play'}
                      className="text-[#FAF7F0] hover:text-[#D5B97D] cursor-pointer"
                    >
                      {previewPlaying ? (
                        <Pause className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Play className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={previewProgress}
                      onChange={(e) => setPreviewProgress(Number(e.target.value))}
                      aria-label="Video preview timeline"
                      className="flex-1 accent-[#D5B97D] cursor-pointer h-1.5"
                    />
                    <span className="text-xs tabular-nums text-[#EAE1D3]">
                      {video.duration}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
