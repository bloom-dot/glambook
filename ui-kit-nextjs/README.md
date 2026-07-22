# GlamBook — Kit UI « Sombre Luxe » (Next.js)

Direction artistique et composants UI/UX pour l'app MUA, en **Next.js (App Router) + Tailwind CSS + Framer Motion + lucide-react**, typés en TypeScript.

> ⚠️ Ce kit est autonome et cible un projet **Next.js**. L'app GlamBook actuellement déployée est en HTML/JS vanilla ; ces fichiers ne s'y exécutent pas tels quels. Utilisez-les pour un nouveau projet Next.js ou comme référence de design.

## Contenu
- `tailwind.config.js` — thème sombre luxe (dark par défaut), palette, polices, ombres, animations.
- `globals.css` — polices Google, variables de thème clair/sombre, transitions.
- `components/ThemeProvider.tsx` — contexte de thème (persistance + anti-flash).
- `components/ThemeToggle.tsx` — bouton Sombre/Clair animé.
- `components/GlossProgressBar.tsx` — barre de progression « gloss / eyeliner ».
- `components/FadeIn.tsx` — apparitions organiques au scroll (+ variantes stagger).
- `components/LuxeCard.tsx` — carte avec élévation + lueur au survol.

## Installation
```bash
npm i framer-motion lucide-react
npm i -D tailwindcss postcss autoprefixer
```
Placez `tailwind.config.js` à la racine et `globals.css` dans `app/`. Copiez `components/` dans votre projet.

## Polices (recommandé : next/font, sans FOUC)
```tsx
// app/layout.tsx
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider, themeNoFlashScript } from '@/components/ThemeProvider';
import './globals.css';

const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-heading' });
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-sans' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${heading.variable} ${sans.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} /></head>
      <body>
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  );
}
```
Si vous préférez ne pas utiliser next/font, gardez simplement le `@import` en tête de `globals.css`.

## Exemples

### Bouton de thème
```tsx
import ThemeToggle from '@/components/ThemeToggle';
<ThemeToggle />
```

### Formulaire de réservation étape par étape
```tsx
'use client';
import { useState } from 'react';
import GlossProgressBar from '@/components/GlossProgressBar';

export default function Booking() {
  const [step, setStep] = useState(1);
  const total = 3;
  return (
    <div className="mx-auto max-w-lg p-6">
      <GlossProgressBar currentStep={step} totalSteps={total} labels={['Prestation','Diagnostic','Confirmation']} />
      {/* … contenu de l'étape … */}
      <button className="btn-champagne mt-6" onClick={() => setStep(s => Math.min(s + 1, total))}>
        Continuer
      </button>
    </div>
  );
}
```

### Apparitions au scroll + cartes de profil
```tsx
import FadeIn, { FadeInStagger, FadeInItem } from '@/components/FadeIn';
import LuxeCard from '@/components/LuxeCard';

<FadeIn>
  <h1 className="font-heading text-4xl">Trouvez votre maquilleuse idéale</h1>
</FadeIn>

<FadeInStagger className="grid gap-4 sm:grid-cols-3">
  {artists.map(a => (
    <FadeInItem key={a.id}>
      <LuxeCard glow="gold">
        <h3 className="font-heading text-xl text-text">{a.name}</h3>
        <p className="text-sm text-muted">{a.city}</p>
      </LuxeCard>
    </FadeInItem>
  ))}
</FadeInStagger>
```

## Jetons de couleur (auto-thème)
`bg-bg`, `bg-surface`, `bg-surface-2`, `text-text`, `text-muted`, `border-border` basculent automatiquement entre clair et sombre. Palette de marque fixe : `text-champagne`, `bg-noir-800`, `text-rose`, `text-fuchsia`, `text-poudre`.
