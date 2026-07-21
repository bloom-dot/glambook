# GlamBook — Récap complet pour audit et suggestions d'amélioration

> **Contexte** : Tu es un expert full-stack, UX, sécurité, SEO et stratégie produit. Analyse ce document et produis des suggestions d'amélioration structurées par niveau : code, architecture, UX/UI, sécurité, SEO, performance, stratégie produit. Sois exhaustif et priorise par impact.

---

## 1. Présentation du projet

**GlamBook** est une marketplace de mise en relation entre clients et maquilleuses professionnelles.

- **Type** : PWA (Progressive Web App), no-framework, vanilla JS + ES modules
- **Stack** :
  - Frontend : HTML/CSS/JS vanilla, Three.js (hero), GSAP (animations scroll)
  - Backend : Supabase (PostgreSQL + Auth + RLS + Storage)
  - Déploiement : Vercel (static hosting + serverless functions)
  - Paiement : Stripe (intégré mais partiellement implémenté)
- **Repo** : `github.com/bloom-dot/glambook` (branche `main`)
- **URL de prod** : déployé sur Vercel
- **Langue** : Français (marché FR)
- **Supabase project ID** : `lcrrdwlnxmneqfzqediu`

---

## 2. Structure des fichiers

```
glambook/
├── index.html              # Landing page principale
├── artists.html            # Listing des maquilleuses avec filtres
├── artist.html             # Profil individuel d'une maquilleuse
├── booking.html            # Tunnel de réservation (3 étapes + Stripe)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache glambook-v6)
├── vercel.json             # Headers sécurité + CSP + rewrites
├── supabase-schema.sql     # Schéma BDD complet
├── auth/
│   ├── login.html          # Connexion
│   └── register.html       # Inscription (client ou artiste)
├── dashboard/
│   ├── client.html         # Espace client
│   └── artist.html         # Espace artiste
├── legal/
│   ├── mentions-legales.html
│   ├── cgu.html
│   ├── cgv.html
│   └── confidentialite.html
├── css/
│   └── main.css            # Styles globaux (CSS vars, composants)
├── js/
│   ├── supabase.js         # Client Supabase + helpers esc(), safeUrl()
│   ├── pwa-install.js      # Bannière d'installation PWA
│   └── utils.js            # esc(), dateFR(), showToast()
├── api/
│   └── create-checkout.js  # Serverless function Stripe (Vercel)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 3. Schéma base de données (Supabase/PostgreSQL)

### Tables principales

```sql
-- profiles (complète auth.users)
profiles {
  id uuid PK, user_id uuid FK→auth.users,
  full_name text, role text CHECK('client','artist','admin'),
  city text, phone text, region text, avatar_url text, created_at timestamptz
}

-- artists (profil pro)
artists {
  id uuid PK, user_id uuid FK→auth.users,
  bio text, is_active bool, is_verified bool,
  rating_avg numeric(3,2), review_count int, price_from numeric(8,2),
  instagram text, tiktok text, youtube text, website text,
  specialties text[], created_at timestamptz
  -- NOTE: PAS de FK directe vers profiles → join manuel côté client
}

-- services (prestations par artiste)
services {
  id uuid PK, artist_id uuid FK→artists,
  name text, description text, price_cents int, duration_min int, category text
}

-- availabilities (créneaux)
availabilities {
  id uuid PK, artist_id uuid FK→artists,
  date date, time_slot text, is_available bool, is_booked bool
  UNIQUE(artist_id, date, time_slot)
}

-- bookings (réservations)
bookings {
  id uuid PK, client_id uuid FK→auth.users, artist_id uuid FK→artists,
  service_id uuid FK→services, slot_id uuid FK→availabilities,
  date date, time_slot text,
  status text CHECK('pending','confirmed','cancelled','done'),
  note text, client_name text, client_email text, client_phone text,
  reviewed bool, stripe_pi_id text, created_at timestamptz
}

-- reviews (avis)
reviews {
  id uuid PK, booking_id uuid UNIQUE FK→bookings,
  artist_id uuid FK→artists, client_id uuid FK→auth.users,
  rating int CHECK(1..5), comment text
}

-- artist_photos (portfolio)
artist_photos {
  id uuid PK, artist_id uuid FK→artists,
  url text, caption text
}
```

### RLS activée sur toutes les tables. Trigger auto-création profile à l'inscription.

### Problème de schéma connu
`artists` et `profiles` référencent tous les deux `auth.users` via `user_id` mais **il n'y a pas de FK directe entre `artists` et `profiles`**. Cela oblige à faire deux requêtes séparées côté client + mapping manuel :

```javascript
const { data: artists } = await supabase.from('artists').select('*, artist_photos(url)').eq('is_active', true);
const userIds = artists.map(a => a.user_id).filter(Boolean);
const { data: profs } = await supabase.from('profiles').select('user_id, full_name, avatar_url, city').in('user_id', userIds);
const profMap = {};
(profs||[]).forEach(p => { profMap[p.user_id] = p; });
artists.forEach(a => { a._profile = profMap[a.user_id] || {}; });
```

---

## 4. Sécurité

### Mesures en place
- **XSS** : fonction `esc()` exportée depuis `supabase.js`, appliquée sur toutes les données Supabase rendues en `innerHTML`
- **URL validation** : `safeUrl()` valide `https://` avant injection dans `src`
- **Paramètres numériques** : `parseInt()` forcé sur `price_from`, `review_count`
- **Encodage URLs** : `encodeURIComponent()` pour les paramètres de navigation
- **CSP** (dans `vercel.json`) :
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://vercel.live;
  frame-src https://js.stripe.com https://vercel.live;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com ...;
  img-src 'self' data: https: blob:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  ```
- **Headers** : HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **RLS Supabase** : activée sur toutes les tables

### Failles / problèmes restants
- `'unsafe-inline'` dans `script-src` — empêche la protection XSS complète via CSP
- Clé anon Supabase exposée dans `supabase.js` côté client (normal pour anon, mais à documenter)
- Pas de rate limiting sur les endpoints API Vercel
- `booking.html` charge Stripe JS (`https://js.stripe.com/v3/`) mais l'intégration paiement semble incomplète
- `auth/register.html` : erreurs affichées via `textContent` (corrigé), mais vérifier login.html
- Aucun CSRF token (pas nécessaire avec JWT Supabase, mais à vérifier pour les API serverless)

---

## 5. Performance

### Service Worker (`sw.js`)
- Cache version : `glambook-v6`
- Stratégie :
  - HTML pages : **network-first** (toujours frais)
  - JS files : **network-first** avec fallback cache
  - Reste : **cache-first**
- Bypass pour : supabase, stripe, vercel.live, pusher, googleapis, gstatic, `/api/*`
- Problème passé : SW servait pages avec anciens headers CSP → résolu par bump de version

### CDN externes (chargés en `<script>` synchrone dans `<body>`)
- Three.js r128 — `cdnjs.cloudflare.com`
- GSAP 3.12.5 + ScrollTrigger — `cdnjs.cloudflare.com`
- Supabase SDK — `cdn.jsdelivr.net` (ES module import)

### Hero WebGL
- 250 particules Three.js + 2 orbes lumineux
- Canvas plein écran (50vh), animation `requestAnimationFrame`
- IntersectionObserver : arrête le rendu quand hors écran
- Pas de détection GPU/mobile → même charge sur mobile bas de gamme

### Images
- Cards artistes : `loading="lazy"` sur les `<img>`
- Pas de format WebP/AVIF
- Pas de `srcset` / responsive images
- `onerror` sur les covers artistes (fallback gradient CSS)

---

## 6. UX / UI

### Palette
- Fond : `#080408` (deep dark)
- Rose/fuchsia : `#E8547A` (CTA principal)
- Or : `#D4AF37` (CTA artiste / accents)
- Texte : blanc, `rgba(255,255,255,.7)`, `rgba(255,255,255,.45)`

### Structure landing page (`index.html`)
1. **Nav** — dark glass, logo + liens + bouton Rejoindre
2. **Hero** (50vh) — titre, sous-titre, CTA gold "Maquilleuse ? Créez votre profil →"
   - Canvas Three.js particules rose/or/blanc en fond
3. **Search section** — formulaire 3 champs (ville, date, prestation) + bouton recherche
4. **Trust strip** — 4 stats (artistes vérifiées, réservations, note 4.9★, paiement sécurisé)
5. **How it works** — 4 étapes en cards
6. **Featured artists** — grid 3 colonnes, chargées depuis Supabase
7. **Dual CTA** — 2 cards (client vs artiste)
8. **Reassurance** — 3 arguments (paiement, vérification, support)
9. **Footer** — liens légaux, contact

### Problèmes UX identifiés
- **Stats trust strip** vides au premier chargement (placeholders `–` pas de skeleton)
- **Artists grid** : avatar toujours initiale (pas de vrai avatar photo)
- **Scroll hint** supprimé → pas d'indication que le contenu continue sous le hero
- **PWA banner** : ne s'affiche que si `beforeinstallprompt` → jamais en production iOS Safari sauf détection manuelle (en place)
- **Booking flow** : 3 étapes mais pas de progress indicator visible cross-page
- **Search section** : bouton "Rechercher" redirige vers `/artists.html` mais pas de feedback visuel de chargement
- Pas de **dark/light mode toggle** (full dark seulement)
- **Mobile** : formulaire search à 3 colonnes → `flex-direction: column` sur mobile, OK
- Pas de **skeleton loaders** sur les cards artistes

### Accessibilité
- Skip-to-content link présent
- Bouton search : `type="button"` ajouté (évite submit accidentel)
- Toast : `role="alert" aria-live="polite"`
- Manque : `aria-label` sur certains boutons icône, focus order à vérifier, contraste texte muted (`.45` opacity peut passer sous 3:1 sur certains écrans)

---

## 7. SEO

### En place
- `<title>` et `<meta name="description">` sur index.html
- `lang="fr"` sur `<html>`
- Structure sémantique : `<nav>`, `<section>`, `<footer>`, `<h1>`

### Manquant / à améliorer
- Pas de balises Open Graph (`og:title`, `og:image`, `og:description`)
- Pas de Twitter Card
- Pas de `robots.txt`
- Pas de `sitemap.xml`
- Pas de données structurées JSON-LD (LocalBusiness, Service, Review, BreadcrumbList)
- Pages artistes générées côté client → pas indexables par Googlebot
- Aucune stratégie de contenu / blog
- URLs non-SEO-friendly : `/artist.html?id=UUID` au lieu de `/artiste/prenom-ville`
- Pas de canonical URLs
- `artists.html` : titre de page générique, pas de H1 optimisé par ville/spécialité

---

## 8. Fonctionnalités manquantes / incomplètes

### Haute priorité
- [ ] **Profil artiste public** (`artist.html`) — existe mais contenu à vérifier
- [ ] **Paiement Stripe** — `booking.html` charge Stripe JS mais intégration incomplète
- [ ] **Dashboards** — `dashboard/client.html` et `dashboard/artist.html` existent mais à vérifier
- [ ] **Gestion disponibilités** — table `availabilities` existe, pas d'UI artiste pour la remplir
- [ ] **Système d'avis** — table `reviews` existe, trigger `reviewed` sur bookings, pas d'UI
- [ ] **Mise à jour `rating_avg`** — pas de trigger automatique sur INSERT dans reviews
- [ ] **Upload photos portfolio** — bucket Supabase Storage à créer manuellement, pas d'UI

### Moyenne priorité
- [ ] **Notifications** — artiste doit être notifié à chaque réservation (email Supabase?)
- [ ] **Messagerie** — pas de système de communication client↔artiste
- [ ] **Annulation / remboursement** — logique manquante
- [ ] **Recherche full-text** — `city` est sur `profiles`, filtrage artistes par ville fait côté client (N+1 queries)
- [ ] **Pagination** — `artists.html` a un bouton "Voir plus" mais la logique de count peut être incorrecte avec le filtre ville (filtrage post-query)
- [ ] **Mentions légales** — contiennent des `[À compléter]` (SIRET, adresse, etc.)

### Faible priorité
- [ ] **Admin panel** — pas de dashboard admin (validation artistes `is_verified`)
- [ ] **Statistiques artiste** — vues de profil, taux de conversion
- [ ] **Promotions / codes promo** — non prévu
- [ ] **Multi-langue** — FR seulement

---

## 9. Architecture & code quality

### Points forts
- XSS bien géré via `esc()` et `safeUrl()` systématiques
- Service Worker bien structuré avec bypass des services externes
- RLS Supabase complète sur toutes les tables
- Headers sécurité complets dans vercel.json
- Séparation claire `supabase.js` / `utils.js`

### Points faibles
- **Tout dans des balises `<style>` inline** dans chaque HTML — pas de CSS modulaire, duplication
- **Pas de bundler** (Vite, esbuild) → pas de tree-shaking, pas de minification
- **Three.js et GSAP en CDN synchrone** dans le body → bloque le rendu si CDN lent
- **Jointures clients** `artists↔profiles` → N requêtes au lieu d'une vue SQL ou FK
- **`artist.html`** charge probablement l'artiste via `?id=UUID` → pas de SEO, URL laide
- **Pas de TypeScript** → pas de typage des objets Supabase
- **Pas de tests** (unit, e2e)
- **Dead CSS** : classes `.artist-cta-band`, `.artist-cta-inner`, `.artist-cta-text` dans `index.html` mais HTML supprimé
- **`scroll-hint` CSS** encore présent mais HTML supprimé
- **`utils.js` et `supabase.js`** exportent tous les deux `esc()` → duplication

---

## 10. Stratégie produit / monétisation

### Modèle actuel (hypothèse)
- Stripe intégré → commission sur réservation ou abonnement artiste ?
- Pas de pricing page visible
- Pas de freemium/premium défini

### Questions ouvertes
- Commission par réservation (%) ou abonnement mensuel artiste ?
- Vérification artiste : manuelle ou automatique ?
- Géographie cible : France entière ou Paris first ?
- Acquisition : SEO local (maquilleuse + ville), Instagram, bouche à oreille ?

---

## 11. Ce que j'attends de toi

Produis des suggestions structurées sur tous ces axes :

1. **Sécurité** : vulnérabilités prioritaires, hardening CSP sans `unsafe-inline`, protection endpoints
2. **Architecture BDD** : FK manquante artists↔profiles, trigger `rating_avg`, vue SQL, RLS edge cases
3. **Performance** : lazy-load Three.js, WebP, skeleton loaders, bundle strategy
4. **UX/UI** : parcours client et artiste, onboarding, trust signals, mobile-first
5. **SEO** : JSON-LD, OG tags, sitemap, URLs propres, indexabilité pages artistes
6. **Features manquantes** : ordre de priorité pour aller en prod, MVP vs nice-to-have
7. **Code quality** : refactoring, duplication, TypeScript migration, tests
8. **Stratégie produit** : modèle de revenus, go-to-market, différenciation

**Format souhaité** : pour chaque axe, liste priorisée avec impact estimé (🔴 critique / 🟠 important / 🟡 utile) et effort approximatif (XS/S/M/L/XL).
