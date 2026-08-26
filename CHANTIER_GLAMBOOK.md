# GlamBook — État du chantier (août 2026)

## C'est quoi
Marketplace maquilleuses professionnelles. Clients trouvent + réservent. Artistes créent profil + gèrent dispos + reçoivent paiements.

## Stack
- **Frontend** : HTML/CSS/JS vanilla, ES modules, Three.js (hero), GSAP (scroll)
- **Backend** : Supabase (PostgreSQL + Auth + RLS + Storage)
- **Déploiement** : Vercel (static + serverless functions)
- **Paiement** : Stripe (intégré, incomplet)
- **Repo** : `github.com/bloom-dot/glambook` branche `main`
- **Supabase project** : `lcrrdwlnxmneqfzqediu`

## Pages existantes
| Fichier | État |
|---|---|
| `index.html` | ✅ Landing complète |
| `artists.html` | ✅ Listing + filtres + pagination |
| `artist.html` | ⚠️ Existe, contenu à vérifier |
| `booking.html` | ⚠️ Tunnel 3 étapes, Stripe incomplet |
| `auth/login.html` | ✅ |
| `auth/register.html` | ✅ (client ou artiste) |
| `dashboard/client.html` | ⚠️ Existe, à vérifier |
| `dashboard/artist.html` | ⚠️ Existe, à vérifier |
| `legal/*.html` | ⚠️ Contient `[À compléter]` (SIRET, adresse) |

## BDD (Supabase)
Tables : `profiles`, `artists`, `services`, `availabilities`, `bookings`, `reviews`, `artist_photos`

**Problème connu** : pas de FK directe `artists→profiles` (les deux référencent `auth.users` via `user_id`). Résolu côté client par deux requêtes + `profMap`.

**Trigger manquant** : pas de mise à jour auto de `rating_avg` quand INSERT dans `reviews`.

## Sécurité (ce qui est fait)
- `esc()` + `safeUrl()` sur tout le HTML dynamique Supabase
- CSP dans `vercel.json` (complète mais contient `unsafe-inline`)
- RLS activée sur toutes les tables
- HSTS, X-Frame-Options, Permissions-Policy en place
- SW cache v6 avec bypass supabase/stripe/pusher/googleapis

## UI / Hero actuel
- Hero compact **50vh** — particules Three.js (250) derrière titre + CTA
- CTA gold "Maquilleuse ? Créez votre profil →" visible sans scroll
- Search form dans section dédiée sous le hero (fond `#0E080E`)
- Palette : fond `#080408`, rose `#E8547A`, or `#D4AF37`
- Borders entre sections : supprimées
- PWA banner : padding body dynamique pour éviter overlap

## Ce qui reste à faire (priorité)

### 🔴 Critique (bloque la mise en prod)
1. **Stripe** — compléter `booking.html` (payment intent, confirmation)
2. **Trigger `rating_avg`** — SQL à ajouter dans Supabase
3. **UI disponibilités artiste** — dashboard artiste doit permettre de remplir `availabilities`
4. **UI avis clients** — après booking `done`, permettre de déposer un review
5. **Mentions légales** — remplir SIRET / adresse / nom responsable

### 🟠 Important (qualité produit)
6. **Notifications** — email artiste à chaque nouvelle réservation (Supabase Edge Functions ou webhooks)
7. **Upload photos portfolio** — UI dans dashboard artiste + bucket Supabase Storage `portfolio`
8. **Admin panel** — valider artistes (`is_verified`), modérer avis
9. **Skeleton loaders** — cards artistes et stats trust strip
10. **SEO** — OG tags, JSON-LD (LocalBusiness, Service, Review), sitemap.xml, robots.txt

### 🟡 Utile (nice-to-have)
11. **URLs propres** — `/artiste/prenom-ville` au lieu de `/artist.html?id=UUID`
12. **Messagerie** — client ↔ artiste avant réservation
13. **Annulation/remboursement** — logique Stripe + UI
14. **WebP images** — srcset responsive
15. **Dead CSS** — nettoyer `.artist-cta-band`, `.scroll-hint` etc.

## Derniers commits
```
b421ec7 Refactor hero to compact 50vh with search section below
49a23bf Remove scroll hint — artist CTA replaces it in hero
dc45fe0 Remove all section border-bottom dividers
80e84b0 Move artist CTA into hero (gold button, visible without scroll)
c351f48 Fix PWA banner overlapping artist CTA — add body padding when visible
```

## Fichiers clés à connaître
- `js/supabase.js` — client Supabase + `esc()`, `safeUrl()`, `getCurrentUser()`, `getProfile()`
- `js/pwa-install.js` — bannière PWA Android/iOS
- `js/utils.js` — `esc()`, `dateFR()`, `showToast()`
- `vercel.json` — CSP + headers sécurité
- `sw.js` — Service Worker cache-first/network-first
- `supabase-schema.sql` — schéma BDD complet
- `css/main.css` — styles globaux (CSS vars, composants)

## Pattern requête artistes (toutes les pages qui listent des artistes)
```javascript
// Deux requêtes séparées car pas de FK artists→profiles
const { data: artists } = await supabase
  .from('artists').select('*, artist_photos(url)')
  .eq('is_active', true).order('rating_avg', {ascending:false}).limit(6);

const userIds = artists.map(a => a.user_id).filter(Boolean);
const { data: profs } = userIds.length
  ? await supabase.from('profiles').select('user_id, full_name, avatar_url, city').in('user_id', userIds)
  : { data: [] };
const profMap = {};
(profs||[]).forEach(p => { profMap[p.user_id] = p; });
artists.forEach(a => { a._profile = profMap[a.user_id] || {}; });
```

## Infra Vercel
- Toutes les `.html` et `/js/*.js` : `Cache-Control: no-cache, no-store, must-revalidate`
- `sw.js` : même + `Service-Worker-Allowed: /`
- Rewrite `/api/:path*` → serverless functions dans `/api/`
