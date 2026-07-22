'use client';

// GlamBook — Bouton bascule Sombre / Clair, transition animée (Framer Motion + lucide-react).
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      className={
        'relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ' +
        'border border-border bg-surface text-champagne transition-colors duration-300 ' +
        'hover:shadow-glow-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne/60 ' +
        className
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ y: -10, opacity: 0, rotate: -35 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 10, opacity: 0, rotate: 35 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center"
        >
          {isDark ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
        </motion.span>
      </AnimatePresence>

      {/* Lueur douce au survol */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{ boxShadow: 'inset 0 0 18px rgba(212,175,55,.25)' }}
      />
    </button>
  );
}
