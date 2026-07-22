'use client';

// GlamBook — Landing « Sombre Luxe » : hero à halo tamisé, titre serif éditorial
// (mot-clé en italique), CTA champagne/or/rose, cartes artistes en glassmorphism.
// Tailwind + Framer Motion. Nécessite tailwind.config.js et globals.css du kit.
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Star } from 'lucide-react';
import FadeIn, { FadeInStagger, FadeInItem } from './FadeIn';

type Artist = {
  id: string;
  name: string;
  city: string;
  rating: number;
  priceFrom: number;
  tags: string[];
  cover?: string;
  avatarUrl?: string;
};

export default function HeroLuxe({ artists = [] }: { artists?: Artist[] }) {
  return (
    <main className="min-h-screen bg-bg text-text">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden px-6 pb-16 pt-28 text-center">
        {/* Halo lumineux tamisé doré/rosé */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/3 -z-0 h-[380px] w-[min(720px,92%)] -translate-x-1/2 -translate-y-1/2 bg-hero-halo blur-[52px]"
        />
        <div className="relative z-10 mx-auto max-w-3xl">
          <FadeIn>
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-champagne/25 bg-champagne/10 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-champagne">
              <Sparkles size={13} /> La plateforme n°1 des makeup artists
            </span>
          </FadeIn>

          <FadeIn delay={0.08}>
            <h1 className="font-heading text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              Trouvez votre<br />
              <span className="bg-cta-lux bg-clip-text text-transparent">
                maquilleuse <em className="italic">idéale</em>
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.16}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted">
              Parcourez les profils, consultez les réalisations et réservez directement en ligne.
              Simple, rapide, sécurisé.
            </p>
          </FadeIn>

          <FadeIn delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="/artists" className="btn-lux">Explorer les artistes</a>
              <a
                href="/register?role=artist"
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-6 py-3 font-sans font-semibold text-white/80 transition-colors hover:border-rose/40 hover:bg-rose/[.06] hover:text-white"
              >
                Vous êtes maquilleuse ?
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── ARTISTES EN VEDETTE ─── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <FadeIn>
          <h2 className="font-heading text-3xl font-semibold md:text-4xl">Artistes en vedette</h2>
          <p className="mt-1 text-muted">Les maquilleuses les plus appréciées</p>
        </FadeIn>

        <FadeInStagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <FadeInItem key={a.id}>
              <motion.a
                href={`/artiste/${a.id}`}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="glass-card group block overflow-hidden"
              >
                <div
                  className="h-44 w-full bg-[linear-gradient(135deg,rgba(232,216,206,.10),rgba(212,175,55,.08))]"
                  style={a.cover ? { backgroundImage: `url(${a.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                />
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose to-rose-deep font-bold text-white">
                      {a.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <MapPin size={12} /> {a.city}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-champagne/25 bg-[linear-gradient(135deg,rgba(232,216,206,.10),rgba(212,175,55,.08))] px-3 py-1 text-xs text-poudre transition-colors group-hover:border-champagne/50"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <span className="flex items-center gap-1 text-sm">
                      <Star size={14} className="fill-champagne text-champagne" /> {a.rating.toFixed(1)}
                    </span>
                    <span className="text-sm font-bold text-rose">Dès {a.priceFrom} €</span>
                  </div>
                </div>
              </motion.a>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </section>
    </main>
  );
}
