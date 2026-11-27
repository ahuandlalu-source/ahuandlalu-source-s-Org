import type {ReactNode} from 'react';
import {motion, useReducedMotion} from 'motion/react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
}

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  yOffset = 20,
}: ScrollRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{opacity: 0, y: yOffset}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: true, amount: 0.14}}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
