# GlamBook — État du projet (passation)

> Fichier de reprise pour continuer le projet dans un nouveau chat.
> Dernière mise à jour : 26 août 2026 — images catégories publiées (commit 06be25e), puis audit du parcours et corrections (§13).

---

## 1. Vue d'ensemble

**GlamBook** est une marketplace qui met en relation des **maquilleuses professionnelles (MUA)** et des **clientes prospects** (mariage, soirée, shooting, etc.), dans l'esprit d'un « Doctolib de la beauté ».

- **Stack** : PWA en **HTML/CSS/JS vanilla** (ES modules, pas de framework) + **Supabase** (Postgres, RLS, RPC, Realtime, Storage) + **Stripe** + **Resend** (emails) + **OpenAI** (diagnostic visage, optionnel) + **Vercel** (hébergement + fonctions serverless).
- **Direction artistique** : « Sombre Luxe » (dark luxe) — voir §5.

---

## 2. Accès, dépôt, déploiement

| Élément | Valeur |
|---|---|
| Dépôt GitHub | `bloom-dot/glambook` (branche `main`, public) |
| Site en production | https://glambook-pi.vercel.app |
| Projet Vercel | `glambook` (compte « Fernand's project », plan **Hobby**) |
| Projet Supabase | `glambook` — ref/id : **`lcrrdwlnxmneqfzqediu`** (région eu-west-1, plan **FREE**) |
| Dossier local | `C:\Users\ferna\OneDrive\Bureau\GlamBook` (synchronisé OneDrive) |
| Email propriétaire | fernandmani61@gmail.com |

**Supabase URL** : `https://lcrrdwlnxmneqfzqediu.supabase.co` (clé anon dans `js/supabase.js`).

---

## 3. Workflow de déploiement (IMPORTANT)

- **Claude ne peut PAS faire `git push`** : le push exige l'identifiant GitHub, qui n'existe que sur le PC de Fernand (barrière de sécurité). Claude édite les fichiers ; **Fernand pousse**.
- **Piège OneDrive + Git** : quand Claude committe depuis son environnement, OneDrive laisse parfois des fichiers `.lock` que Claude ne peut pas supprimer. **Solution adoptée** : Claude n'édite que les fichiers (pas de commit), et Fernand publie avec une seule ligne (PowerShell, `;` et non `&&`) :

```
git add -A; git commit -m "message"; git push
```

- Si un jour un verrou bloque : `Remove-Item .git\HEAD.lock,.git\index.lock -Force -EA 0; git push origin main`
- Vercel **redéploie automatiquement** à chaque push sur `main` (~1 min).

---

## 4. Architecture & fichiers clés

- `index.html` — accueil (hero photo, recherche unifiée, home connectée, catégories, bandeau pro, sections).
- `artists.html` — liste/recherche des maquilleuses (filtres ville/date/prestation + **recherche géolocalisée** rayon 5/10/20/50 km).
- `artist.html` — profil public d'une artiste (route `/artiste/:slug` via `vercel.json`).
- `dashboard/artist.html` — tableau de bord MUA (profil, prestations, demandes, devis, dispos).
- `dashboard/admin.html` — back-office admin (stats, modération, vérif artistes) — protégé par `is_admin()`.
- `mes-devis.html` — espace cliente (devis reçus + demandes + suppression de compte).
- `messages.html` + `js/chat/` — messagerie temps réel (Realtime), modération (signaler/bloquer/filtre coordonnées).
- `reservation.html`, `booking.html` — flux de réservation + diagnostic visage.
- `signature.html` — signature de devis côté cliente (RPC `sign_quote`).
- `js/supabase.js` — client Supabase + `getCurrentUser()`, `getProfile()`.
- `js/theme.js` — bascule thème (dark par défaut), reveal IntersectionObserver.
- `js/booking/`, `js/devis/`, `js/scan/` — modules métier.
- `api/` — fonctions serverless : `face-diagnostic.js` (OpenAI), `send-quote.js` (Resend), `sitemap.js`. Rate limiting via table `api_usage`.
- `legal/` — `mentions-legales.html`, `cgu.html`, `cgv.html`, `confidentialite.html`.
- `img/` — visuels (hero, portrait, bandeau-pro, cat-mariage, cat-soiree…). Filigranes des IA rognés au préalable.
- `sw.js` — service worker (`CACHE_NAME` actuel **`glambook-v12`**, network-first pour `.js` et `.css`).
- `vercel.json` — routes + en-têtes de sécurité (CSP stricte, HSTS…).
- `ui-kit-nextjs/` — kit UI Next.js « Sombre Luxe » (composants de référence, non utilisé par l'app vanilla).

---

## 5. Direction artistique « Sombre Luxe »

Tokens CSS (dans `css/main.css`, `:root` = dark par défaut ; `html.theme-light` pour le clair) :

- Fonds : `#0F0F11` (fond), `#18181B` (cartes), surfaces `#27272A`.
- **Thème unique sombre** depuis le 26 août 2026 : la bascule clair/sombre a été retirée (bouton flottant, bloc `html.theme-light`, scripts d'init `gb-theme` dans les 19 pages). `js/theme.js` ne gère plus que les apparitions au scroll.
- Bordures : `#27272A` / `#3F3F46`.
- Accents : champagne `#E8D8CE`, or `#D4AF37` / `#E7C766`, rose `#E11D48` / `#E8547A`.
- CTA gradient : `linear-gradient(100deg,#E8D8CE,#D4AF37 55%,#E11D48)`.
- Typo : **Cormorant Garamond** (titres, italique sur mots-clés « idéale », « briller »), **Plus Jakarta Sans** (corps).
- Effets : glassmorphism (blur + `rgba(24,24,27,.55)`), halo hero, tuiles à hover doré.

---

## 6. Fonctionnalités livrées (déjà en prod)

- Auth Supabase (email), profils MUA/cliente, rôles (`profiles.role` = `artist`/`admin`, cliente = null).
- Profils artistes, prestations, portfolios (Storage), avis.
- **Devis** : création MUA → email → signature électronique cliente (RPC `sign_quote`, `get_quote_by_token`).
- **Réservation** + **diagnostic visage IA** (scan, recommandations produits, consentement RGPD).
- **Messagerie temps réel** sécurisée + modération.
- **Back-office admin**.
- **Recherche géolocalisée** : « autour de moi » (géoloc navigateur) ou par ville (API Base Adresse Nationale gratuite), rayon 5/10/20/50 km, distance Haversine + pré-filtre boîte englobante SQL. Colonnes `lat`/`lng` + vue `artists_public`.
- RGPD : politique de confidentialité à jour, consentement scan, suppression de compte (`delete_my_account`).
- Sécurité : RLS optimisée, rate limiting API, CSP, en-têtes.

---

## 7. Refonte « architecture Doctolib » (les 4 briques — TERMINÉ ce cycle)

1. **Hero de recherche unifié** — barre proéminente sous le titre : Prestation + Où ? + Date + bouton **📍 Autour de moi** + Rechercher. Le CTA « Vous êtes maquilleuse ? » est passé en lien secondaire.
   - `index.html` : `doSearch()` (→ `.hsb-go`) et `doSearchNear()` (géoloc → redirige vers `artists.html?lat=..&lng=..&radius=10`).
   - `artists.html` : lit désormais `lat`/`lng`/`radius` depuis l'URL et active le mode géo. **Validé en base** (ex. lat=46.36,lng=6.14,r=20 → artiste « BG » à 0,44 km).
2. **Home personnalisée connecté** (`index.html`, fonction `loadMe()`) — si session active : salutation « Bonjour {prénom} », nav bascule (Connexion/Rejoindre → **Mon espace + Déconnexion**), bloc « Vos rendez-vous à venir » + « Vos maquilleuses » (cliente) / « Vos prochaines demandes » + tableau de bord (maquilleuse). Basé sur `booking_requests` (RLS) + `artists_public`.
3. **Sections d'accueil** — tuiles « Explorez par prestation » (liens `?service=mariage|soiree|quotidien|editorial|scene`, alignés sur les slugs réels + pill « Quotidien » ajoutée dans `artists.html`) + **bandeau pro illustré** (`img/bandeau-pro.jpg`, « Vous êtes maquilleuse ? »).
4. **Refonte structure/nav** — hero photo éditoriale (`img/hero.jpg`) en fond, dark luxe, nav dynamique selon session.

**Perf** : WebGL (three.js) et **GSAP retirés** de l'accueil (le ticker rAF permanent alourdissait la page et bloquait l'outil de capture). Aucun impact visuel (animations déjà neutralisées par `opacity:1 !important`). Page nettement plus légère.

---

## 8. Variables d'environnement Vercel (état actuel)

Présentes (Production + Preview) :

- `RESEND_API_KEY` ✅ (ajoutée ce cycle — envoi des devis par email actif après redéploiement).
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

Non configurées (optionnelles) :

- `MAIL_FROM` — par défaut `GlamBook <onboarding@resend.dev>`. **Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte (fernandmani61@gmail.com).** Pour de vrais envois clientes : vérifier un domaine dans Resend (section Domains) puis définir `MAIL_FROM = GlamBook <devis@ton-domaine.fr>`.
- `OPENAI_API_KEY` — nécessaire pour le **diagnostic visage IA** (compte OpenAI payant à l'usage). Non activé pour l'instant.

---

## 9. TÂCHES À FINIR (reprise)

### A. Images des catégories — ✅ TERMINÉ (26 août 2026)
Les 6 tuiles de la section « Explorez par prestation » ont désormais toutes une photo.
- Ajoutés dans `img/` : `cat-quotidien.jpg`, `cat-shooting.jpg`, `cat-scene.jpg`, `cat-toutes.jpg` (538×310, JPEG qualité 82, 17-41 Ko chacun).
- Générés avec Nano Banana (Gemini) — **aucun filigrane visible** sur ces images, aucun rognage n'a été nécessaire, seulement un recadrage au ratio des tuiles existantes.
- `index.html` lignes ~592-595 : les `<span class="ph">emoji</span>` remplacés par des `<img loading="lazy">` avec `alt` descriptif.
- `sw.js` : `CACHE_NAME` passé en `glambook-v10`.
- `.gitignore` : ajout de `images/` (dossier de travail des originaux IA, non versionné).
- Publié dans le commit `06be25e`.

**Prompts de référence** (si une image doit être régénérée) — base commune :
> Editorial beauty photography, cinematic close-up, luminous textured skin, deep charcoal/black background, soft warm lighting with champagne and gold highlights, refined luxury mood, gold/rose/nude palette, landscape 16:9 format, high resolution, photorealistic, no text, no logo, no watermark.

Variantes : **Quotidien** + natural "no-makeup makeup", fresh glowing complexion, glossy nude lips, soft daylight — **Shooting** + high-fashion makeup, bold graphic eyeliner, metallic gold eyelids, sculpted cheekbones, dramatic studio lighting — **Scène** + spectacular stage makeup, glitter, shimmer, theatrical gaze, cabaret look — **Toutes** : elegant flat-lay of pro makeup brushes/products on dark satin, golden reflections, top-down.

### B. Mentions légales (en attente des infos de Fernand)
Placeholders à remplir :
- `legal/mentions-legales.html` (bloc « Éditeur du site », lignes ~26-30) : Raison sociale, Forme juridique, SIRET, Siège social (adresse), Directeur de la publication.
- `legal/confidentialite.html` (ligne ~25) : `[Raison sociale]`, `[Adresse]`.
- **Incohérence email à harmoniser** : mentions légales = `contact@glambook.app`, pied de page = `contact@glambook.fr`. Choisir une seule adresse (ou Gmail en attendant).
- Note : si pas encore immatriculé (pas de SIRET), mettre nom + adresse en personne physique + « immatriculation en cours ». **Faire valider par un juriste** (Claude n'est pas juriste).

### C. Sécurité / comptes (côté Fernand)
- **Protection « mots de passe compromis » (HaveIBeenPwned)** : disponible **uniquement en Supabase Pro** (~25 $/mois). Projet en FREE → **non activable**. Compensation gratuite déjà appliquée : longueur mini de mot de passe portée à **8**, « Require current password when updating » activé. hCaptcha déjà actif.
- Vérifier que le **secret hCaptcha** est bien renseigné dans Supabase (Attack Protection) — à confirmer.
- Emails réels clientes → vérifier un **domaine** (Resend + éventuellement mettre à jour `contact@`).

---

## 10. Notes de vérification (outillage)

- L'extension navigateur de capture (Claude in Chrome) devient **capricieuse sur l'accueil** : l'injection de script n'atteint pas toujours l'état « idle » et les screenshots/scroll échouent par intermittence. Ce n'est **pas** un bug de l'app (un utilisateur normal scrolle sans souci). Vérifs possibles autrement : lecture DOM (`read_page`), requêtes SQL directes via le MCP Supabase, `node --check` sur les scripts extraits.
- L'analyseur de sécurité Supabase (`get_advisors`) remonte des `SECURITY DEFINER` sur les fonctions `admin_*` / vues publiques : **intentionnel** (les fonctions admin vérifient `is_admin()` en interne, les vues n'exposent que du public). `auth_leaked_password_protection` restera signalé tant qu'on est en FREE.

---

## 11. Schéma de données (repères)

- `profiles(user_id, full_name, role, …)` — role : `artist` / `admin` / null (cliente).
- `artists_public` (vue) — id, slug, display_name, avatar_url, city, region, rating_avg, review_count, price_from, specialties (array de slugs), photos, **lat, lng**.
- `booking_requests(id, artist_id, client_id, client_name/email/phone, event_address, event_date, services_snapshot, travel_distance_km, diagnostic, note, status[pending/quoted/declined], quote_id, created_at)`.
- `quotes` + RPC `sign_quote`, `get_quote_by_token`, `my_quotes`.
- `conversations` / `messages` + RPC `my_conversations`, `start_conversation`, modération admin.
- `services`, `availability_templates`, `api_usage`, `public_stats` (vue), `reviews_public` (vue).
- Slugs de prestations : `mariage`, `soiree`, `quotidien`, `editorial` (Shooting), `scene`.

---

## 12. Prochaine action suggérée à la reprise

1. Fournir les infos éditeur (raison sociale, adresse, SIRET ou « immatriculation en cours », directeur de la publication) → Claude remplit les mentions légales + confidentialité et harmonise l'email de contact.
2. Tester l'envoi de devis par email (arrive sur fernandmani61@gmail.com tant qu'il n'y a pas de domaine vérifié chez Resend).
3. Confirmer le secret hCaptcha dans Supabase (Attack Protection).

**Publication** : double-cliquer sur `publier.bat` à la racine du projet (supprime les verrous `.lock`, demande un message de commit, puis `add` + `commit` + `push`). Vercel redéploie automatiquement en ~1 min.

---

## 13. Audit du parcours et corrections (26 août 2026)

Audit du code réel confronté à la base de production. Ce qui a été trouvé et corrigé :

### Corrigé
| Problème | Détail | Fichier |
|---|---|---|
| **Base Supabase en pause** | Projet en statut `INACTIVE` (pause auto du plan FREE après ~7 j d'inactivité) : plus d'auth, plus d'artistes, plus de devis en prod. Relancé. | Supabase |
| **Filtre par prestation cassé** | Les liens et pastilles envoyaient les slugs (`mariage`, `soiree`…) mais la base stockait les libellés (`Mariage`, `Soirée`, `Éditorial / Shooting`…). `contains()` ne matchait jamais → 0 résultat sur toutes les catégories. Base migrée vers les slugs + `specialtyLabel()` pour l'affichage. | `js/utils.js`, `js/supabase.js`, `artists.html`, `artist.html`, `index.html`, `dashboard/artist.html`, base |
| **Géolocalisation et caméra bloquées** | `Permissions-Policy: camera=(), geolocation=()` interdisait ces API **au site lui-même** : le bouton « Autour de moi » et la caméra du diagnostic ne pouvaient pas fonctionner en production. Passé en `camera=(self)`, `geolocation=(self)`. | `vercel.json` |
| **Onglet Portfolio inaccessible sur mobile** | La nav mobile appelait `showTab('portfolio')`, or l'onglet s'appelle `photos` → tous les onglets passaient en `display:none`, écran vide. | `dashboard/artist.html` |
| **`showToast` non importé** | Les messages d'erreur de géolocalisation levaient un `ReferenceError` : échec silencieux côté cliente. | `artists.html` |
| **Tunnel de réservation orphelin** | `reservation.html` (flux demande → devis → signature) n'était lié depuis aucune page ; `artist.html` renvoyait vers `booking.html`, qui exige des `services` et `availabilities` — tables vides. Aucune cliente ne pouvait aboutir. | `artist.html`, `reservation.html` |

### Choix retenu : deux modes de réservation selon l'artiste
- MUA **avec** prestations tarifées → réservation directe par créneau (`booking.html`) + lien secondaire « Ou demander un devis personnalisé ».
- MUA **sans** prestations → la carte bascule en « Demander un devis » (`reservation.html`).
- `reservation.html` accepte désormais une demande sans prestation au catalogue : nouveau champ « Votre besoin » (obligatoire dans ce cas), transmis en `booking_requests.note`.
- Le dashboard MUA affiche ce message et signale « devis à chiffrer librement » quand le catalogue est vide.

### Reste à traiter
- **Mise en veille de la base** : le projet FREE se remettra en pause après ~7 jours sans activité. Prévoir un ping automatique (cron Vercel) ou le passage en Pro.
- **Diagnostic visage IA** : `OPENAI_API_KEY` absente → l'endpoint renvoie 501 systématiquement.
- **Stripe** : `STRIPE_SECRET_KEY` absente. Le code bascule proprement en réservation sans paiement, mais `create-checkout.js` et `stripe-webhook.js` instancient Stripe hors `try/catch` (500 brut si appelés).
- **Logo MUA dans l'email de devis** : stocké en `data:` URL, filtré par `send-quote.js` → jamais visible dans l'email reçu.
- **Redirection après inscription** : `auth/register.html` ignore `?redirect=`, la cliente perd la fiche artiste consultée.
- **Stats dashboard** : « ce mois » compare le mois sans l'année.
- **Nom « GlamBook »** : une plateforme homonyme (glambook.com, Glambook Ltd.) opère sur le même créneau en France depuis 2023 et a déposé la marque en classe 35 pour les places de marché de services de beauté. À arbitrer avant tout achat de domaine ou dépôt.

---

## 14. Charte graphique « Sombre Luxe » (26 août 2026)

Étude complète publiée ici : https://claude.ai/code/artifact/9bbda50d-09a5-4532-bfb3-f81086a74e9b

**Constat de l'audit** : 113 couleurs hexadécimales distinctes sur 22 fichiers, deux systèmes de jetons concurrents (`css/main.css` et un `:root` en dur dans `index.html`), texte blanc sur bouton rose à 3,51 de contraste (seuil WCAG : 4,5).

**Principe** : l'or agit, le rose qualifie, le poudré habille. Une seule action dorée par écran ; le rose ne porte jamais de texte blanc en aplat (utiliser `#C43A60`, contraste 5,10).

**Décidé et appliqué** : suppression du thème clair — la marque assume le sombre.

**Reste à appliquer** (par ordre du plan de migration) :
1. ~~Trancher la question du thème clair~~ ✅ fait
2. Poser les jetons `--gb-*` en tête de `css/main.css`
3. Libérer `index.html` de son `:root` local et fusionner ses 5 blocs `<style>`
4. Hiérarchie des boutons à 4 niveaux + icônes SVG au trait (fin des emojis)
5. Éliminer les couleurs en dur, en commençant par `dashboard/artist.html` (72 occurrences)
