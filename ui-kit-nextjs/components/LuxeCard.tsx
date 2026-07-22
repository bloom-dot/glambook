'use client';

// GlamBook — Carte de profil « luxe » : élévation au survol + lueur dorée/rosée subtile.
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

type LuxeCardProps = {
  children: ReactNode;
  /** Couleur de la lueur au survol. */
  glow?: 'gold' | 'rose';
  className?: string;
};

export default function LuxeCard({ children, glow = 'gold', className = '' }: LuxeCardProps) {
  const hoverShadow =
    glow === 'rose'
      ? '0 18px 50px rgba(232,84,122,.28)'
      : '0 18px 50px rgba(212,175,55,.24)';
  const ringColor = glow === 'rose' ? 'rgba(232,84,122,.45)' : 'rgba(212,175,55,.5)';

  return (
    <motion.div
      className={`group relative rounded-2xl border border-border bg-surface p-5 ${className}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      whileHover={{ y: -6, boxShadow: hoverShadow }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {/* Liseré lumineux qui s'illumine au survol */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
      />
      {children}
    </motion.div>
  );
}
