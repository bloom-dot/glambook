'use client';

// GlamBook — Barre de progression « Gloss / Eyeliner »
// Simule un trait de gloss/rouge à lèvres satiné qui se trace, avec reflet
// lumineux mobile et embout brillant champagne. Framer Motion pour la fluidité.
import { motion } from 'framer-motion';

export type GlossProgressBarProps = {
  currentStep: number;
  totalSteps: number;
  /** Affiche « Étape x / n » et le pourcentage sous la barre. */
  showSteps?: boolean;
  /** Étiquettes personnalisées par étape (optionnel). */
  labels?: string[];
  className?: string;
};

export default function GlossProgressBar({
  currentStep,
  totalSteps,
  showSteps = true,
  labels,
  className = '',
}: GlossProgressBarProps) {
  const clamped = Math.max(1, Math.min(currentStep, totalSteps));
  const pct = (clamped / totalSteps) * 100;

  return (
    <div className={`w-full ${className}`}>
      {/* Piste */}
      <div className="relative h-[6px] w-full rounded-full bg-surface-2">
        {/* Trait de gloss animé */}
        <motion.div
          className="relative h-full rounded-full bg-gloss-trail"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.6 }}
          style={{ boxShadow: '0 0 12px rgba(232,67,147,.45)' }}
        >
          {/* Reflet « glossy » qui balaie le trait */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-16 rounded-full bg-champagne-sheen mix-blend-screen"
            animate={{ x: ['-20%', '120%'] }}
            transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
          />
          {/* Embout brillant (goutte de gloss) */}
          <span
            aria-hidden
            className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #fff, #D4AF37 55%, #B8962E)',
              boxShadow: '0 0 10px 2px rgba(212,175,55,.7)',
            }}
          />
        </motion.div>
      </div>

      {/* Points d'étape */}
      {labels && labels.length === totalSteps && (
        <div className="mt-3 flex justify-between">
          {labels.map((label, i) => {
            const done = i < clamped;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <motion.span
                  className="h-2 w-2 rounded-full"
                  animate={{
                    backgroundColor: done ? '#D4AF37' : 'var(--surface-2)',
                    scale: i === clamped - 1 ? 1.4 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                />
                <span className={`text-[11px] font-sans ${done ? 'text-text' : 'text-muted'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {showSteps && (
        <div className="mt-2 flex justify-between font-sans text-xs text-muted">
          <span>Étape {clamped} / {totalSteps}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
    </div>
  );
}
