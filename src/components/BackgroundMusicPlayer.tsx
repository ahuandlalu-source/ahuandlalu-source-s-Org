import {Pause, Play, Volume2, VolumeX} from 'lucide-react';
import type {UIStrings} from '../config/translations';

interface BackgroundMusicPlayerProps {
  visible: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  hasError: boolean;
  trackTitle: string;
  strings: UIStrings['music'];
  onTogglePlay: () => void;
  onToggleMute: () => void;
}

export function BackgroundMusicPlayer({
  visible,
  isPlaying,
  isMuted,
  hasError,
  trackTitle,
  strings,
  onTogglePlay,
  onToggleMute,
}: BackgroundMusicPlayerProps) {
  if (!visible) return null;

  return (
    <aside
      aria-label="Wedding background music controls"
      className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-1 rounded-xl bg-[#2C221E]/92 backdrop-blur-md text-[#FAF7F0] border border-[#B68D40]/35 px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-lg max-w-[calc(100vw-1.5rem)]"
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={hasError}
        aria-label={isPlaying ? strings.pause : strings.play}
        title={isPlaying ? strings.pause : strings.play}
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#FAF7F0]/10 hover:bg-[#FAF7F0]/20 disabled:opacity-45 transition-colors cursor-pointer shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-[#D5B97D]" aria-hidden="true" />
        ) : (
          <Play className="w-4 h-4 text-[#D5B97D] ml-0.5" aria-hidden="true" />
        )}
      </button>

      <div className="px-1.5 min-w-0 hidden sm:block">
        <p className="text-xs font-medium text-[#FAF7F0] truncate max-w-[160px]">
          {hasError ? strings.unavailable : trackTitle}
        </p>
        <p className="text-[11px] text-[#EAE1D3]/75 truncate">
          {hasError ? strings.unavailable : isPlaying ? strings.playingLabel : strings.pausedLabel}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        disabled={hasError}
        aria-label={isMuted ? strings.unmute : strings.mute}
        title={isMuted ? strings.unmute : strings.mute}
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[#FAF7F0]/15 disabled:opacity-45 transition-colors cursor-pointer shrink-0"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-[#EAE1D3]/80" aria-hidden="true" />
        ) : (
          <Volume2 className="w-4 h-4 text-[#FAF7F0]" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
