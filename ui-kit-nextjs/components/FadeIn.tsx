'use client';

// GlamBook — Apparition organique au scroll/chargement (fade-in + slide-up + effet de matière).
import { motion, type Variants } from 'framer-motion';
import { ReactNode } from 'react';

type FadeInProps = {
  children: ReactNode;
  /** Décalage vertical initial (px). */
  y?: number;
  /** Délai avant l'animation (s). */
  delay?: number;
  /** Durée (s). */
  duration?: number;
  /** Rejoue à chaque entrée dans le viewport si false. */
  once?: boolean;
  className?: string;
};

export default function FadeIn({
  children,
  y = 24,
  delay = 0,
  duration = 0.7,
  once = true,
  className = '',
}: FadeInProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y, filter: 'blur(6px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-80px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Conteneur pour animer une liste en cascade (stagger).
 * Enveloppez chaque enfant dans <FadeInItem/>.
 */
export function FadeInStagger({
  children,
  className = '',
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function FadeInItem({ children, y = 20, className = '' }: { children: ReactNode; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y, filter: 'blur(5px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
