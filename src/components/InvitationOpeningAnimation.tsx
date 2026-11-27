import {useEffect} from 'react';
import {motion, useReducedMotion} from 'motion/react';
import {NilavilakkuCrest} from './KeralaMotifs';

interface InvitationOpeningAnimationProps {
  brideNickname: string;
  groomNickname: string;
  isOpening: boolean;
  onComplete: () => void;
}

export function InvitationOpeningAnimation({
  brideNickname,
  groomNickname,
  isOpening,
  onComplete,
}: InvitationOpeningAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpening) return;
    const duration = shouldReduceMotion ? 380 : 1250;
    const timer = window.setTimeout(onComplete, duration);
    return () => window.clearTimeout(timer);
  }, [isOpening, shouldReduceMotion, onComplete]);

  if (!isOpening) return null;

  if (shouldReduceMotion) {
    return (
      <motion.div
        initial={{opacity: 1}}
        animate={{opacity: 0}}
        transition={{duration: 0.35, ease: 'easeOut'}}
        className="fixed inset-0 z-50 bg-[#FAF7F0] flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 perspective-1600 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Left physical invitation door swinging outward */}
      <motion.div
        initial={{rotateY: 0, x: '0%', opacity: 1}}
        animate={{rotateY: -105, x: '-58%', opacity: 0.15}}
        transition={{duration: 1.2, ease: [0.22, 1, 0.36, 1]}}
        style={{transformOrigin: 'left center', willChange: 'transform, opacity'}}
        className="absolute inset-y-0 left-0 w-1/2 bg-[#F4EFE6] paper-grain border-r border-[#B68D40]/55 shadow-[12px_0_48px_rgba(44,34,30,0.35)] flex items-center justify-end pr-4 sm:pr-10 preserve-3d"
      >
        <div className="h-[88%] w-full ml-3 sm:ml-8 border-y border-l border-[#B68D40]/35 flex flex-col items-end justify-center pr-4 sm:pr-8">
          <span className="h-0.5 w-12 kasavu-border-x mb-3" />
          <p className="font-display text-3xl sm:text-5xl text-[#2C221E]/85">
            {brideNickname}
          </p>
        </div>
      </motion.div>

      {/* Right physical invitation door swinging outward */}
      <motion.div
        initial={{rotateY: 0, x: '0%', opacity: 1}}
        animate={{rotateY: 105, x: '58%', opacity: 0.15}}
        transition={{duration: 1.2, ease: [0.22, 1, 0.36, 1]}}
        style={{transformOrigin: 'right center', willChange: 'transform, opacity'}}
        className="absolute inset-y-0 right-0 w-1/2 bg-[#F4EFE6] paper-grain border-l border-[#B68D40]/55 shadow-[-12px_0_48px_rgba(44,34,30,0.35)] flex items-center justify-start pl-4 sm:pl-10 preserve-3d"
      >
        <div className="h-[88%] w-full mr-3 sm:mr-8 border-y border-r border-[#B68D40]/35 flex flex-col items-start justify-center pl-4 sm:pl-8">
          <span className="h-0.5 w-12 kasavu-border-x mb-3" />
          <p className="font-display text-3xl sm:text-5xl text-[#2C221E]/85">
            {groomNickname}
          </p>
        </div>
      </motion.div>

      {/* Central parting nilavilakku seal */}
      <motion.div
        initial={{opacity: 1, scale: 1}}
        animate={{opacity: 0, scale: 0.78}}
        transition={{duration: 0.45, ease: 'easeOut'}}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="w-14 h-14 rounded-full bg-[#FAF7F0] border border-[#B68D40]/60 flex items-center justify-center shadow-lg text-[#B68D40]">
          <NilavilakkuCrest className="w-8 h-8" />
        </div>
      </motion.div>
    </div>
  );
}
