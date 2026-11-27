import {useState} from 'react';
import {ImageOff} from 'lucide-react';

export function NilavilakkuCrest({className = 'w-10 h-10'}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Sacred flame */}
      <path
        d="M32 7C34.2 11.4 35.6 15.1 32 19.2C28.4 15.1 29.8 11.4 32 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="14.5" r="1.2" fill="currentColor" />
      {/* Lamp crown */}
      <path
        d="M32 22V25M28 25H36"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Oil bowl (Thattu) */}
      <path
        d="M19 29C22.5 34.5 27 36.2 32 36.2C37 36.2 41.5 34.5 45 29H19Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      {/* Stem & stepped pedestal */}
      <path
        d="M32 36.2V49M26 42.5H38M22 49H42M18 53H46"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KasavuDivider({className = ''}: {className?: string}) {
  return (
    <div
      className={`flex items-center justify-center gap-4 w-full max-w-md mx-auto ${className}`}
      aria-hidden="true"
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#B68D40]/45 to-[#B68D40]/70" />
      <svg viewBox="0 0 28 16" className="w-7 h-4 text-[#B68D40]" fill="none">
        <path
          d="M14 2C16.2 5.2 19.5 7.2 23.5 8C19.5 8.8 16.2 10.8 14 14C11.8 10.8 8.5 8.8 4.5 8C8.5 7.2 11.8 5.2 14 2Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="14" cy="8" r="1.5" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#B68D40]/45 to-[#B68D40]/70" />
    </div>
  );
}

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fallbackLabel?: string;
}

export function ResilientImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  loading = 'lazy',
  fallbackLabel,
}: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F4EFE6] to-[#EAE1D3] text-[#7A675F] p-6 text-center"
      >
        <ImageOff className="w-6 h-6 text-[#B68D40]" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
