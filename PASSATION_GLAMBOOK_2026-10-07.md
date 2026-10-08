# GlamBook — Passation de session

> Récapitulatif de la session du **26 août au 7 octobre 2026**, écrit pour qu'un nouvel assistant
> (ou Fernand seul) reprenne le projet sans rien relire d'autre.
> Le détail technique permanent reste dans `ETAT_PROJET_GLAMBOOK.md`.

---

## 0. À FAIRE EN PREMIER — deux points bloquants

### ⚠️ A. Du travail terminé n'est pas publié
Cinq fichiers sont modifiés en local et **n'ont jamais été poussés** :
`index.html`, `artists.html`, `artist.html`, `sw.js` (v15), `ETAT_PROJET_GLAMBOOK.md`.

Ils contiennent les trois corrections de contenu validées par Fernand (§5.6). Rien n'est cassé,
mais la production est en retard d'un lot. **Double-clic sur `publier.bat`** à la racine du projet.

Dernier commit en production : `35af525`.

### ⚠️ B. La base Supabase est de nouveau en pause
Statut vérifié le 7 octobre 2026 : **`INACTIVE`**.

Le plan FREE suspend le projet après ~7 jours sans activité. Tant qu'elle est en pause, le site
en ligne n'a **ni connexion, ni liste d'artistes, ni devis, ni messagerie** — seule la page
d'accueil statique répond. C'est la deuxième fois pendant cette session.

Pour la relancer : outil MCP Supabase `restore_project` sur le projet `lcrrdwlnxmneqfzqediu`,
ou le bouton « Restore » dans le dashboard Supabase. Compter 1 à 2 minutes.

**Ce n'est pas une solution durable.** Deux options à trancher avec Fernand :
- un ping automatique (cron Vercel quotidien qui fait une requête SQL triviale) — gratuit ;
- le passage en Supabase Pro (~25 $/mois) — règle aussi la protection « mots de passe compromis ».

---

## 1. Le projet en deux lignes

Marketplace mettant en relation **maquilleuses professionnelles (MUA)** et **clientes**
(mariage, soirée, shooting). PWA en HTML/CSS/JS vanilla, Supabase, Vercel. Direction
artistique « Sombre Luxe ». Site en pré-lancement, une seule maquilleuse inscrite (profil de test « BG »).

| | |
|---|---|
| Production | https://glambook-pi.vercel.app |
| Dépôt | `bloom-dot/glambook`, branche `main` |
| Supabase | ref `lcrrdwlnxmneqfzqediu` (eu-west-1, plan FREE) |
| Dossier local | `C:\Users\ferna\OneDrive\Bureau\GlamBook` |

---

## 2. Comment travailler sur ce projet

**Claude ne pousse jamais.** Les identifiants GitHub n'existent que sur le PC de Fernand, et
OneDrive laisse traîner des fichiers `.lock` dans `.git/` que l'environnement distant ne peut pas
supprimer. Claude édite les fichiers, Fernand publie.

**La publication se fait par `publier.bat`** (créé pendant cette session, à la racine). Un
double-clic : il se place dans le bon dossier, supprime les verrous `.lock`, demande un message de
commit, puis `add` + `commit` + `push`. Vercel redéploie seul en ~1 minute.

Ne plus proposer de lignes PowerShell à copier-coller : deux tentatives ont échoué en début de
session (collage concaténé avec le texte précédent, et exécution depuis `C:\WINDOWS\System32`).

**Après chaque modification de CSS ou de JS**, incrémenter `CACHE_NAME` dans `sw.js`
(actuellement `glambook-v15`).

---

## 3. Vérifier son travail — ce qui marche bien ici

L'extension Chrome est capricieuse sur la page d'accueil (captures qui échouent par
intermittence). Trois méthodes plus fiables ont été utilisées pendant la session :

1. **Rendu local avec Playwright.** Stager `index.html`, `css/main.css` et `img/*.jpg` dans le
   conteneur, remplacer les imports Supabase par des stubs, et rendre avec le Chromium
   pré-installé (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Permet de comparer deux
   versions **pixel à pixel** — c'est comme ça que la migration des jetons a été validée
   (0,0 % de différence sensible).
2. **Requêtes SQL directes** via le MCP Supabase, pour confronter le code à la base réelle.
3. **Injection JS dans la page en production** (`javascript_tool`) pour lire les valeurs
   calculées : jetons CSS résolus, contrastes, classes appliquées.

---

## 4. La charte graphique « Sombre Luxe »

Étude complète, avec nuancier, contrastes mesurés et plan de migration :
**https://claude.ai/code/artifact/9bbda50d-09a5-4532-bfb3-f81086a74e9b**

### Le principe
**L'or agit, le rose qualifie, le poudré habille.** Une seule action dorée par écran.

Ce n'est pas qu'un choix esthétique : le texte blanc sur le rose `#E8547A` donne un contraste de
**3,51** (en dessous du seuil WCAG de 4,5), là où du texte sombre sur l'or donne **8,81**. La
couleur qui doit être la plus visible est aussi celle qui se lit le mieux.

### Les jetons
Tous dans le `:root` de `css/main.css`, préfixés `--gb-*`. **Aucune couleur ne doit être écrite
ailleurs.** Les anciens noms (`--rose`, `--or`, `--gris-cl`, `--blanc`…) sont conservés comme
alias pointant vers les nouveaux, le temps de finir la migration.

| Rôle | Jeton | Valeur |
|---|---|---|
| Fond de page | `--gb-ground` | `#0E0E10` |
| Surface (cartes) | `--gb-surface` | `#17171A` |
| Surface élevée | `--gb-surface-2` | `#1F1F23` |
| Bordures | `--gb-line` | `#2A2A2F` |
| Or (actions) | `--gb-gold` | `#D4AF37` |
| Champagne (liens, icônes) | `--gb-champagne` | `#E7C766` |
| Poudré | `--gb-powder` | `#E8D8CE` |
| Rose (contours, tags) | `--gb-rose` | `#E8547A` |
| Rose profond (seul aplat sous du blanc) | `--gb-rose-deep` | `#C43A60` |
| Texte | `--gb-ink` / `--gb-ink-2` / `--gb-ink-3` | `#F4F2F5` / `#A8A2AC` / `#75707A` |

### Les règles
- Quatre niveaux d'action : `.btn-primary` (aplat doré) → `.btn-secondary` (contour rose) →
  `.btn-ghost` (contour neutre) → `.btn-quiet` (lien souligné).
- Icônes : **SVG au trait de 1,5 px**, jamais de remplissage, jamais d'emoji.
- Trois rayons seulement : 6 px, 12 px, 999 px.
- Le relief vient d'un halo doré, pas d'une ombre noire (invisible sur fond anthracite).
- L'italique doré du Cormorant : **un mot par écran**, pas davantage.
- Thème unique sombre — la bascule clair/sombre a été retirée.

### Plan de migration — où on en est
1. ✅ Trancher le thème clair → sélecteur supprimé, sombre assumé
2. ✅ Poser les jetons `--gb-*` dans `css/main.css`
3. ✅ Libérer `index.html` de son `:root` local et fusionner ses blocs `<style>`
4. ✅ Hiérarchie des boutons + icônes SVG
5. ⬜ **Reste à faire** : éliminer les couleurs en dur des autres pages, en commençant par
   `dashboard/artist.html` (72 occurrences). Puis retirer les alias de compatibilité.

---

## 5. Ce qui a été fait pendant la session

### 5.1 Images des catégories (commit `06be25e`)
Les six tuiles « Explorez par prestation » ont leur photo. Les quatre manquantes ont été générées
par Fernand avec Nano Banana (Gemini), recadrées au format des tuiles existantes (538×310, JPEG
qualité 82). Aucun filigrane n'était présent sur ces images — pas de rognage nécessaire.
Le dossier `images/` (originaux IA) est gitignoré.

### 5.2 Audit du parcours réel (commit `8e1d5ba`)
Le code a été confronté à la base de production. Cinq défauts bloquants trouvés et corrigés :

- **Le filtre par prestation ne renvoyait jamais rien.** Les liens envoyaient des slugs
  (`?service=mariage`) alors que la base stockait des libellés (`"Mariage"`). Base migrée vers les
  slugs, formulaire du dashboard corrigé, fonction `specialtyLabel()` ajoutée pour l'affichage.
- **La géolocalisation et la caméra étaient interdites par le site lui-même.** `vercel.json`
  envoyait `Permissions-Policy: camera=(), geolocation=()` — une liste vide bloque l'API pour
  toutes les origines, y compris la sienne. Le bouton « Autour de moi » ne pouvait pas fonctionner.
  Passé en `camera=(self), geolocation=(self)`.
- **`showToast` n'était pas importé** dans `artists.html` : l'échec de géolocalisation était
  totalement silencieux.
- **L'onglet Portfolio vidait l'écran sur mobile** : la nav appelait `showTab('portfolio')` alors
  que l'onglet s'appelle `photos`, ce qui masquait tous les onglets.
- **Aucune cliente ne pouvait finir une réservation.** `reservation.html` (flux demande → devis →
  signature) n'était lié depuis aucune page, et `artist.html` pointait vers `booking.html` qui
  exige des `services` et `availabilities` — tables vides.

**Décision de Fernand sur le tunnel : les deux modes, selon l'artiste.** Une MUA avec des
prestations tarifées garde la réservation directe par créneau ; sans tarifs, la carte bascule en
« Demander un devis ». `reservation.html` accepte désormais une demande sans prestation au
catalogue (nouveau champ « Votre besoin », obligatoire dans ce cas, transmis en
`booking_requests.note` et affiché dans le dashboard MUA).

### 5.3 Corrections visuelles (commit `47d9d05`)
- Le trait reliant les quatre cartes « Comment ça marche » traversait les cartes par transparence
  (fond à 4 % d'opacité). **Supprimé** à la demande de Fernand.
- Les deux cartes « Rejoignez GlamBook » **n'étaient pas cliquables** : seul le bouton intérieur
  l'était, alors que la carte réagissait au survol. Chaque carte est devenue un `<a>` (le bouton
  intérieur est passé en `<span>`), avec contour doré au focus clavier.
- `.cat-tile` n'avait aucune couleur de texte déclarée et héritait du bleu de lien par défaut.

### 5.4 Suppression du thème clair (commit `4d84403`)
Diagnostic initial erroné de ma part, corrigé ensuite : les pages internes n'étaient pas « en blanc
et rose ». Le navigateur de Fernand avait `gb-theme: light`, et **`index.html` ignorait ce réglage**
parce qu'il redéfinissait ses propres jetons en dur — d'où un accueil noir et un site blanc.

Décision : thème unique sombre. Retirés — le bouton flottant, le bloc `html.theme-light`
(18 variables), les scripts d'init dans 19 pages, la transition de 0,5 s. `js/theme.js` ne gère
plus que les apparitions au scroll.

### 5.5 Migration de la charte, étapes 2 à 4 (commits `640ee44` et `35af525`)
- Jetons `--gb-*` posés, anciens noms conservés comme alias.
- `index.html` ne contient plus **aucune valeur hexadécimale en dur** ; le second noir `#080408`
  et le second rose `#E11D48` ont disparu ; ses 4 blocs `<style>` sont fusionnés en un seul.
  Vérifié par rendu comparé : hauteur identique, 0,0 % de différence sensible.
- Boutons unifiés sur les quatre niveaux, nav connectée revue (**Mon espace** en CTA doré,
  **Déconnexion** en lien discret — c'était le bouton le plus voyant de la page).
- 11 icônes SVG remplacent les emojis sur `index.html`, `artists.html` et `artist.html`.
  Deux cas particuliers : les emojis des `<option>` ont été simplement retirés (une balise
  `option` ne peut pas contenir de SVG), et le cadenas des photos verrouillées est passé en
  data-URI puisqu'il vient d'un pseudo-élément.
  Les `★ ☆ ✓` restants sont des symboles typographiques monochromes, pas des emojis — ils tiennent la charte.

### 5.6 Contenu de l'accueil — validé, **pas encore publié**
- **Barre de réassurance** : les compteurs (« 1+ artistes », « 0+ réservations », « 4.9★ » sur zéro
  avis) sont remplacés par trois engagements vrais dès le premier jour — *Sans frais de
  réservation* / *Devis personnalisé* / *Échange direct*. `loadStats()` est vidée mais conservée,
  avec un commentaire : la vue `public_stats` existe toujours, les compteurs pourront revenir.
- **Badge du hero** : « LA PLATEFORME N°1 DES MAKEUP ARTISTS » → « MAQUILLEUSES PROFESSIONNELLES
  PRÈS DE CHEZ VOUS ». L'ancienne formule était une allégation invérifiable.
- **Profils sans avis** : plus de cinq étoiles suivies de « (0) », plus de « À partir de –€ ».
  Badge « Nouvelle sur GlamBook » et mention « Sur devis », sur les trois surfaces concernées.

---

## 6. Ce qui reste à faire

### Technique
| Priorité | Sujet | Détail |
|---|---|---|
| 🔴 | Mise en veille Supabase | Ping automatique ou passage en Pro (§0.B) |
| 🟠 | Étape 5 de la migration | Couleurs en dur des pages internes, `dashboard/artist.html` en tête |
| 🟠 | Images de couverture cassées | Les cartes artistes affichent leur texte alternatif — cause non élucidée |
| 🟡 | Diagnostic visage IA | `OPENAI_API_KEY` absente → l'endpoint renvoie 501 systématiquement |
| 🟡 | Stripe | `STRIPE_SECRET_KEY` absente. Le code bascule proprement en réservation sans paiement, mais `create-checkout.js` et `stripe-webhook.js` instancient Stripe hors `try/catch` (500 brut si appelés) |
| 🟡 | Logo MUA dans l'email de devis | Stocké en `data:` URL, filtré par `send-quote.js` → jamais visible dans l'email reçu |
| 🟡 | `?redirect=` à l'inscription | `auth/register.html` l'ignore : la cliente perd la fiche artiste consultée |
| 🟡 | Effets de survol trompeurs | Les cartes « Comment ça marche » et « Pourquoi GlamBook » se soulèvent au survol sans être cliquables |
| ⚪ | Stats du dashboard | « ce mois » compare le mois sans l'année |
| ⚪ | Bandeau PWA | Fond blanc permanent en bas d'écran, casse la charte |

### Hors technique
- **Mentions légales** — `legal/mentions-legales.html` et `legal/confidentialite.html` contiennent
  encore des placeholders (`[Raison sociale]`, `[SIRET]`, `[Adresse]`). La société **n'est pas
  encore créée**. Fernand a choisi de se domicilier avant de publier une adresse, et d'acheter un
  domaine avant de fixer l'email de contact (`contact@glambook.app` et `contact@glambook.fr`
  apparaissent tous deux aujourd'hui, et aucun des deux domaines ne lui appartient).
- **Email réel des devis** — Resend n'envoie qu'à l'adresse du compte tant qu'aucun domaine n'est
  vérifié. `MAIL_FROM` n'est pas configurée.
- **Secret hCaptcha** à confirmer dans Supabase (Attack Protection).

### ⚠️ À arbitrer avant tout investissement : le nom
**« Glambook » est déjà pris, sur exactement le même créneau.** Glambook Ltd. exploite
[glambook.com](https://glambook.com/), plateforme de réservation beauté entrée sur le marché
français en janvier 2023, et a [déposé la marque GLAMBOOK](https://trademarks.justia.com/980/80/glambook-98080307.html)
en classe 35 avec le libellé « Operating on-line marketplaces featuring beauty services ».

Même nom, même secteur, même pays, marque déposée. Acheter `glambook.fr` et lancer la
communication dessus reviendrait à investir sur une base fragile — et un changement de nom coûte
beaucoup moins cher aujourd'hui, avec zéro utilisateur, que dans six mois. Un conseil en propriété
industrielle peut trancher ; beaucoup font un premier échange gratuit.

---

## 7. Repères techniques

### Base de données
- `profiles(user_id, full_name, role, …)` — role : `artist` / `admin` / null (cliente)
- `artists` + vue `artists_public` — `specialties` contient désormais des **slugs** :
  `mariage`, `soiree`, `quotidien`, `editorial`, `scene`, `coiffure`, `ongles`, `airbrush`
- `booking_requests(… services_snapshot, diagnostic, note, status[pending/quoted/declined] …)`
- `quotes` + RPC `sign_quote`, `get_quote_by_token`, `my_quotes`
- `conversations` / `messages` + RPC `my_conversations`, `start_conversation`
- `services`, `availabilities`, `api_usage`, vues `public_stats` et `reviews_public`
- **`services`, `availabilities`, `booking_requests` et `quotes` sont vides** — aucune donnée réelle

### Variables d'environnement Vercel
Présentes : `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Absentes : `MAIL_FROM`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`.

### Faux positifs connus
- `get_advisors` de Supabase signale des `SECURITY DEFINER` sur les fonctions `admin_*` et les vues
  publiques : **intentionnel**, les fonctions vérifient `is_admin()` en interne.
- `auth_leaked_password_protection` restera signalé tant que le projet est en FREE.
- `CHANTIER_GLAMBOOK.md`, `AUDIT_GLAMBOOK.md` et `GLAMBOOK_AUDIT_FABLE.md` sont **périmés** et se
  contredisent sur le schéma. Ne pas s'y fier : `ETAT_PROJET_GLAMBOOK.md` et ce fichier font foi.
- Un dossier `Claude outputs/` non versionné traîne à la racine — à supprimer ou à gitignorer.
