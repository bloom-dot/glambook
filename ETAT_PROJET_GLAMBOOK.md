# GlamBook — État du projet (passation)

> Fichier de reprise pour continuer le projet dans un nouveau chat.
> Dernière mise à jour : 7 octobre 2026 — analyse complète et corrections (§16). **Lire le §16 en premier.**

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
- `sw.js` — service worker (`CACHE_NAME` actuel **`glambook-v16`**, network-first pour `.js` et `.css`).
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

**Plan de migration** :
1. ~~Trancher la question du thème clair~~ ✅ thème unique sombre
2. ~~Poser les jetons `--gb-*` en tête de `css/main.css`~~ ✅ faits, avec alias de compatibilité pour les anciens noms (`--rose`, `--or`, `--gris-cl`…) qui pointent désormais vers les jetons ; à retirer après l'étape 5
3. ~~Libérer `index.html` de son `:root` local et fusionner ses blocs `<style>`~~ ✅ **zéro couleur en dur** dans l'accueil, un seul bloc `<style>` au lieu de 4, le second noir `#080408` a disparu
4. ~~Hiérarchie des boutons à 4 niveaux + icônes SVG au trait~~ ✅ `.btn-primary`/`.btn-gold` unifiés en aplat doré, `.btn-secondary` en contour rose, `.btn-ghost` neutre, `.btn-quiet` ajouté pour les actions rares ; nav connectée revue (**Mon espace** en CTA doré, **Déconnexion** en lien discret) ; 11 icônes SVG au trait remplacent les emojis dans `index.html`, `artists.html` et `artist.html` (y compris le cadenas des photos verrouillées, en data-URI)
5. Éliminer les couleurs en dur des autres pages, en commençant par `dashboard/artist.html` (72 occurrences)

**Vérification de l'étape 3** : rendu local des deux versions de l'accueil comparé pixel à pixel — hauteur identique (4272 px), différence sensible mesurée à 0,0 %. Tous les jetons résolvent (`--gris-cl` → `#0E0E10`, `--blanc` → `#17171A`, `--noir` → `#F4F2F5`), aucune `var()` non résolue dans le rendu.

---

## 15. Contenu de l'accueil — corrections validées (10 septembre 2026)

Trois changements de contenu validés par Fernand, indépendants de la charte :

- **Barre de réassurance** — les compteurs (« 1+ artistes vérifiées », « 0+ réservations », « 4.9★ » sur zéro avis) sont remplacés par trois engagements vrais dès le premier jour : *Sans frais de réservation* / *Devis personnalisé* / *Échange direct*, avec icônes SVG dorées. `loadStats()` est vidée mais conservée : la vue `public_stats` existe toujours, les compteurs pourront revenir quand les chiffres parleront.
- **Badge du hero** — « LA PLATEFORME N°1 DES MAKEUP ARTISTS » devient « MAQUILLEUSES PROFESSIONNELLES PRÈS DE CHEZ VOUS ». L'ancienne formulation était une allégation invérifiable avec une seule inscrite.
- **Profils sans avis** — plus de cinq étoiles pleines suivies de « (0) », plus de « À partir de –€ ». Un badge « Nouvelle sur GlamBook » et la mention « Sur devis » les remplacent, sur les trois surfaces concernées : cartes de l'accueil, cartes de `artists.html`, en-tête de `artist.html`.

---

## 16. Analyse complète et corrections (7 octobre 2026)

Tout le code a été relu, confronté à la base réelle, puis **rendu page par page** (36 écrans, ordinateur et mobile, visiteuse / cliente / maquilleuse) avant et après correction.

### À faire par Fernand
1. **Publier** : double-clic sur `publier.bat`.
2. **Appliquer `supabase-securite-2026-10.sql`** (Supabase → SQL Editor → coller → Run). Tant que ce n'est pas fait, les failles de droits ci-dessous restent ouvertes.
3. Dans Supabase → Authentication → URL Configuration, ajouter `https://glambook-pi.vercel.app/auth/reset.html` aux « Redirect URLs » (sans cela le lien « mot de passe oublié » arrive sur l'accueil, qui redirige quand même vers la bonne page).

### Bloquant, corrigé
| Problème | Où |
|---|---|
| **Le lot non publié cassait toutes les fiches artistes** : `reviews` déclaré deux fois → le script de la page ne démarrait plus. | `artist.html` |
| **CSS affiché en clair + icônes géantes** en production depuis `35af525` : deux règles étaient tombées hors de la balise `<style>`. | `artists.html`, `artist.html` |
| **Signature invisible** : encre `#111` sur zone de signature sombre. La cliente signait sans voir son trait. | `signature.html` |
| **« Mot de passe oublié » → page 404** (la page n'avait jamais été créée). Ajout de `auth/forgot.html` et `auth/reset.html`. | `auth/` |
| **Calendrier décalé d'un jour** (heure de Paris) : cliquer sur le 31 ouvrait le 30 ; la « semaine type » posait les créneaux du lundi sur le dimanche. | `dashboard/artist.html` |
| **Devis à 0 € envoyé à la cliente** quand la demande ne contenait aucune prestation tarifée (le cas de toutes les demandes aujourd'hui). Le bouton ouvre désormais l'éditeur de devis prérempli. | `dashboard/artist.html`, `dashboard/devis.html` |
| **Demandes, devis, messages et déconnexion inaccessibles sur mobile** côté maquilleuse. Barre du bas refaite + feuille « Plus ». | `dashboard/artist.html` |
| **Choisir une date à l'accueil donnait toujours zéro résultat** (le filtre exigeait un agenda en ligne ; personne n'en a). La date devient une information : « Disponible / Complète / Date à confirmer ». | `artists.html` |
| **Images de couverture cassées** : `<img src="">` quand l'artiste n'a pas de photo. Remplacé par une surface neutre. | `index.html`, `artists.html`, `artist.html` |
| **« Autour de moi » effaçait le filtre de prestation** et lançait deux recherches (classe CSS partagée avec les pastilles). | `artists.html` |
| **Masquer une section de son profil faisait planter la fiche** (l'élément était supprimé, puis le script écrivait dedans). | `artist.html` |
| **Palette choisie par l'artiste illisible** (teintes claires héritées du thème clair sur fond sombre). | `artist.html`, `dashboard/artist.html` |
| Inscription : message d'erreur affiché avec ses balises HTML ; cas « confirmez votre email » non géré ; `?redirect=` ignoré. | `auth/register.html` |
| Étape « Diagnostic visage » imposée alors que le service n'est pas branché ; récapitulatif « Sous-total 0,00 € ». | `reservation.html`, `api/config.js` |
| Webhook Stripe : la config `bodyParser:false` était écrasée (signature invérifiable). Fonctions Stripe en 500 sans clé. | `api/` |
| Prix d'une prestation non arrondi (49,99 € refusé en silence), « à partir de » jamais recalculé, photos impossibles à retirer, échecs d'envoi silencieux. | `dashboard/artist.html` |

### Sécurité
- **Failles de droits en base** (une personne connectée pouvait se donner le rôle admin, se déclarer « vérifiée », fixer sa note, confirmer sa réservation sans payer, réécrire les messages de l'autre). Vérifié sur la base réelle dans une transaction annulée. Correctif prêt : `supabase-securite-2026-10.sql` — **à appliquer**.
- Injection possible via le nom d'artiste, le prénom et le paramètre `time` (insérés sans échappement) : corrigé.
- Contrôle d'origine des fonctions serveur : `startsWith` acceptait `glambook-pi.vercel.app.autre-site.com`. Comparaison stricte dans `api/_shared.js`.
- `.vercelignore` : les notes internes (`*.md`) et schémas (`*.sql`) étaient servis publiquement par le site.

### Fond
- **Mise en veille Supabase** : `api/keepalive.js` + tâche planifiée quotidienne dans `vercel.json` (gratuit). À vérifier dans Vercel → Cron Jobs après publication.
- **Charte, étape 5 terminée** : plus aucune couleur en dur hors `:root` de `css/main.css` (restent, volontairement : `theme-color`, le logo Google, les palettes d'artiste, le PDF). Jetons d'état ajoutés (`--gb-ok-tint`, `--gb-warn-tint`, `--gb-bad-tint`…), classes `.is-ok/.is-warn/.is-bad/.is-info`, `.danger-zone`, `.cover-ph`, styles des pages de compte.
- **Plus d'emoji** : icônes au trait centralisées dans `js/utils.js` (`ICON`).
- `js/nav.js` : la barre reflète la session sur `artists.html` et `artist.html`.
- `js/utils.js` : `localISODate()` / `parseLocalDate()` — ne plus jamais utiliser `toISOString()` pour une date de calendrier.
- Un seul point d'entrée cliente : `/mes-devis.html` (devis, demandes, rendez-vous). `dashboard/client.html` garde l'historique, l'annulation et les avis.
- Le générateur de PDF n'est chargé qu'à la demande (signature, éditeur de devis).

### Reste ouvert
- **Avis impossibles dans le parcours « sur devis »** : un avis exige une réservation par créneau (`bookings`). Aucune maquilleuse sans agenda ne pourra en recevoir. À traiter avec la refonte (avis après devis signé + date passée).
- **Deux modèles de réservation** (`bookings` et `booking_requests`) : à unifier.
- Textes à valider : « Annulation gratuite jusqu'à 48h » (accueil), « Artistes vérifiées — chaque profil est validé » (aucune vérification n'a lieu), « Support réactif », « Devis & paiements intégrés ».
- Le logo de la maquilleuse dans l'email de devis (stocké en `data:`), `package.json` (dépendance `framer-motion` inutilisée), dossier `ui-kit-nextjs/` inutilisé.
- Captcha : aucun widget hCaptcha dans les formulaires. S'il est réellement exigé côté Supabase, connexion et inscription échouent — à tester en vrai.

## 17. Charte v3 « Noir éditorial » appliquée (8 octobre 2026)

Direction E choisie par Fernand (mélange de A « Sombre Luxe » et C « Éditorial »). Elle remplace la §14 pour la typographie et les accents ; le fond sombre unique est conservé.

- **Typographie** : titres en Archivo condensé (font-stretch 62 %), capitales, graisse 800 ; un mot d'accent en Cormorant Garamond italique doré (`<em>` dans un `h1`/`h2`, ou `.gb-accent`). Sous-titres et citations en Cormorant italique.
- **Couleurs** : fond #0E0E10, surface #17171A, filets #2A2A2F / #3B3B42, texte #F4F2F5 / #A8A2AC / #75707A, or #D4AF37 (une seule action dorée par écran), champagne #E7C766. Le rose n'est plus un accent : les alias `--rose`, `--rose-cl`, `--gb-rose-tint` pointent sur le champagne ; `--gb-rose` reste défini mais n'est plus utilisé dans les pages.
- **Composants** : `.eyebrow` (surtitre), `.rule-head` (titre de section souligné d'un filet, `.lbl` / `.aside` / lien), carte maquilleuse sans cadre (photo, nom en capitales, ville en italique, prix champagne), étiquettes au contour neutre, boutons en capitales espacées, `.btn-secondary` au contour champagne.
- **Accueil** : photo plein cadre et titre « Votre visage. Leur *métier*. », bandeau de recherche, index numéroté des cinq occasions, trois maquilleuses, « Comment ça marche » en quatre temps, bandeau pro, pied de page. Retirés : le double appel à l'action et le bloc « Pourquoi GlamBook » (promesses non vérifiables : annulation 48 h, artistes vérifiées, support).
- **Recherche** : grand titre, occasions en onglets, filtres en ligne, même carte que l'accueil.
- **Fiche maquilleuse** : la couverture (ou, à défaut, la première photo du portfolio) en plein cadre avec le nom en capitales ; présentation en italique ; portfolio en mosaïque ; avis en citations. Sur mobile, barre fixe « Écrire | Demander un devis / Réserver ». La couleur choisie par la maquilleuse ne teinte plus que le surtitre et la sélection (`--artist-accent`).
- Tableau de bord, messages, inscription, signature : rose remplacé par l'or / le champagne, logos alignés.
- Cache du service worker : `glambook-v21`.
- Mon espace (`mes-devis.html`) refait : grand « Bonjour *Prénom* », trois compteurs (devis à signer, demandes en cours, rendez-vous) qui mènent aux sections, lignes sans cadre séparées par des filets, montant en champagne. Compte vide : index des occasions « Par où commencer ». Section « Mon compte » avec déconnexion ; la suppression du compte est repliée derrière un lien discret.
- Menus déroulants : `js/select.js` remplace l'apparence du menu natif (illisible sous Windows) pour tout `<select class="gb-select">` ; le select d'origine reste caché et garde la valeur. Utilisé sur l'accueil (occasion) et la recherche (rayon, tri).
- Photos (8 octobre) : cadre gris retiré de `cat-mariage.jpg` et `cat-soiree.jpg` (restes du découpage d'une planche) ; l'accueil se partage avec `hero.jpg` en grand format. `portrait.jpg` et `cat-toutes.jpg` ne sont plus utilisées.
- Nouvelles photos générées par Fernand (8 octobre, soir) : `hero.jpg` (maquilleuse de face, cliente de profil, moitié gauche noire pour le titre, 1376 × 768), `bandeau-pro.jpg` (maquilleuse qui prépare son matériel), `cat-shooting.jpg` (eye-liner graphique sans paillettes, recadrée sur les yeux). Les anciennes sont gardées hors du site. À terme : une photo d'accueil d'au moins 2 400 px de large pour les grands écrans.
