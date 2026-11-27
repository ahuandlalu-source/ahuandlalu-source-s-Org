import {useEffect, useRef, useState} from 'react';
import {Expand, Film, Play} from 'lucide-react';
import type {GalleryPhoto, GalleryVideo, Language} from '../types/wedding';
import type {UIStrings} from '../config/translations';
import {ImageLightbox} from './ImageLightbox';
import {ResilientImage} from './KeralaMotifs';
import {ScrollReveal} from './ScrollReveal';
import {VideoPlayerModal} from './VideoPlayerModal';

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  videos: GalleryVideo[];
  language: Language;
  strings: UIStrings['gallery'];
  videoStrings: UIStrings['videos'];
  headingOverride?: string;
  subtitleOverride?: string;
}

function VideoGalleryCard({
  video,
  onClick,
}: {
  video: GalleryVideo;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current || !video.videoUrl) return;
    if (isHovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, video.videoUrl]);

  return (
    <ScrollReveal className="col-span-1">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Play wedding film"
        className="group relative w-full h-full min-h-[280px] rounded-xl overflow-hidden bg-[#2C221E] border border-[#2C221E]/10 text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B68D40]"
      >
        {video.videoUrl ? (
          <video
            ref={videoRef}
            src={`${video.videoUrl}#t=0.001`}
            preload="metadata"
            muted
            loop
            playsInline
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-[#2C221E] flex items-center justify-center">
            <Film className="w-8 h-8 text-[#FAF7F0]/40" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#2C221E]/75 via-[#2C221E]/10 to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-4 sm:p-5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#FAF7F0]/18 text-[#FAF7F0] shrink-0">
            <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />
          </span>
        </div>

        <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-[#2C221E]/85 text-[#FAF7F0] text-[10px] uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
          <Film className="w-3 h-3" /> Film
        </span>
      </button>
    </ScrollReveal>
  );
}

export function PhotoGallery({
  photos,
  videos,
  language,
  strings,
  videoStrings,
  headingOverride,
  subtitleOverride,
}: PhotoGalleryProps) {
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<GalleryVideo | null>(null);

  const approvedPhotos = [...photos]
    .filter((photo) => photo.status === 'approved' && photo.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const approvedVideos = [...videos]
    .filter((video) => video.status === 'approved' && video.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (approvedPhotos.length === 0 && approvedVideos.length === 0) return null;

  const handlePrevPhoto = () => {
    setSelectedPhotoIndex((prev) =>
      prev === null ? null : (prev - 1 + approvedPhotos.length) % approvedPhotos.length
    );
  };

  const handleNextPhoto = () => {
    setSelectedPhotoIndex((prev) =>
      prev === null ? null : (prev + 1) % approvedPhotos.length
    );
  };

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
    >
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
          {strings.sectionKicker}
        </p>
        <h2
          id="gallery-heading"
          className="font-display text-3xl sm:text-5xl font-normal text-[#2C221E] text-balance"
        >
          {headingOverride || strings.sectionTitle}
        </h2>
        <p className="mt-4 text-sm sm:text-base text-[#5E4C45]">
          {subtitleOverride || strings.sectionSubtitle}
        </p>
      </ScrollReveal>

      {/* Filter Tabs (All / Photos / Films) */}
      {approvedPhotos.length > 0 && approvedVideos.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-12">
          {(
            [
              {id: 'all', label: language === 'ml' ? 'എല്ലാം' : 'All Media'},
              {id: 'photos', label: language === 'ml' ? 'ചിത്രങ്ങൾ' : 'Photos'},
              {id: 'videos', label: language === 'ml' ? 'വീഡിയോകൾ' : 'Films'},
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#2C221E] text-[#FAF7F0]'
                  : 'bg-[#F4EFE6] text-[#5E4C45] hover:bg-[#EAE1D3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Unified Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 auto-rows-[260px] sm:auto-rows-[280px]">
        {/* Photos */}
        {(filter === 'all' || filter === 'photos') &&
          approvedPhotos.map((photo, index) => {
            const spanClass =
              photo.featured && index === 0
                ? 'sm:col-span-2 lg:row-span-2'
                : photo.aspect === 'portrait'
                  ? 'lg:row-span-2'
                  : 'col-span-1';

            return (
              <ScrollReveal
                key={photo.id}
                delay={Math.min(index * 0.04, 0.25)}
                className={spanClass}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex(index)}
                  aria-label={`View ${photo.caption[language]}`}
                  className="group relative w-full h-full rounded-xl overflow-hidden bg-[#EAE1D3] border border-[#2C221E]/10 text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B68D40]"
                >
                  <ResilientImage
                    src={photo.src}
                    alt={photo.alt[language]}
                    loading="lazy"
                    fallbackLabel={photo.caption[language]}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#2C221E]/75 via-[#2C221E]/10 to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4 sm:p-5">
                    <div>
                      <p className="font-display text-lg text-[#FAF7F0] leading-snug">
                        {photo.caption[language]}
                      </p>
                    </div>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#FAF7F0]/18 text-[#FAF7F0] shrink-0 ml-3">
                      <Expand className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </div>
                </button>
              </ScrollReveal>
            );
          })}

        {/* Videos (With hover video preview loop) */}
        {(filter === 'all' || filter === 'videos') &&
          approvedVideos.map((video) => (
            <VideoGalleryCard
              key={video.id}
              video={video}
              onClick={() => setActiveVideo(video)}
            />
          ))}
      </div>

      <ImageLightbox
        photos={approvedPhotos}
        currentIndex={selectedPhotoIndex}
        language={language}
        strings={strings}
        onClose={() => setSelectedPhotoIndex(null)}
        onPrev={handlePrevPhoto}
        onNext={handleNextPhoto}
      />

      <VideoPlayerModal
        video={activeVideo}
        language={language}
        strings={videoStrings}
        onClose={() => setActiveVideo(null)}
      />
    </section>
  );
}
