# Audit GlamBook — Sécurité, Juridique & Utilisateur

_Plateforme de mise en relation Makeup Artists ↔ clientes — HTML/JS vanilla (PWA), Supabase, Stripe, Vercel._
_Date : 22 juillet 2026 · Périmètre : code du dépôt `bloom-dot/glambook` + projet Supabase `lcrrdwlnxmneqfzqediu`._

---

## 0. Synthèse express

| Domaine | État | Priorité |
|---|---|---|
| Sécurité base de données (RLS, grants) | Bon, corrigé | ✅ corrigés ce jour |
| Sécurité applicative (API, CSP, Stripe) | Bon | ⚠️ 2 points à traiter |
| Juridique / RGPD | **Insuffisant** (scan visage + IA + chat non couverts) | 🔴 prioritaire |
| Parcours utilisateur | Fonctionnel | ⚠️ frictions à lisser |

**Corrigé pendant l'audit :** bug d'envoi du chat (privilèges de table manquants), affichage optimiste des messages, durcissement de fonctions Supabase, index de clés étrangères.

---

## 1. Audit de sécurité

### 1.1 Corrigé pendant cet audit
- **Chat cassé (bug critique)** : le rôle `authenticated` n'avait pas les `GRANT` de base sur `messages`/`conversations` → toute insertion refusée (`permission denied for table messages`). Grants ajoutés sur `conversations`, `messages`, `client_diagnostics`, `availability_templates` (+ re-confirmés sur `quotes`, `booking_requests`).
- **Fonctions techniques exposées** : `bump_conversation()` et `touch_updated_at()` (fonctions de trigger) étaient appelables comme RPC public. `EXECUTE` révoqué.
- **`search_path` mutable** figé sur `touch_updated_at()`.
- **`is_conv_participant()`** retirée du rôle `anon` (conservée pour `authenticated`, requise par les policies).
- **Index manquants** sur clés étrangères (`booking_requests.quote_id`, `messages.sender_id`, `quotes.created_by`).

### 1.2 Points forts existants
- **RLS activée** sur toutes les tables sensibles ; les données privées (devis, demandes, diagnostics, messages) ne sont accessibles qu'aux parties concernées.
- **Prix Stripe côté serveur** : le montant vient toujours de la base, jamais du client (`api/create-checkout.js`) → pas de manipulation de prix.
- **Signature du webhook Stripe** vérifiée.
- **Clé service-role** utilisée uniquement côté serverless ; la clé exposée au front est bien la clé `anon` (comportement normal).
- **CSP stricte** présente, avec `frame-ancestors`/`X-Frame-Options DENY`, HSTS, `nosniff`.
- **Photo du scan visage non stockée** : traitée à la volée, seul le texte du diagnostic est conservé.
- **Signature de devis** : la cliente non authentifiée passe par des RPC `security definer` qui n'exposent que la ligne du token — jamais toute la table.

### 1.3 À traiter (recommandations)
1. **🔴 Rate limiting sur les API coûteuses.** `api/face-diagnostic.js` (OpenAI) et `api/send-quote.js` (Resend) sont protégées par JWT mais un utilisateur connecté peut les appeler en boucle → coûts / abus. Ajouter une limite par utilisateur (ex. table `rate_limits` ou KV Vercel : X scans / heure).
2. **🟠 Vues `SECURITY DEFINER`** (`artists_public`, `reviews_public`, `public_stats`) signalées en ERROR par l'analyseur. Elles n'exposent en principe que des colonnes publiques, mais il faut le **confirmer colonne par colonne** et idéalement les recréer en `security_invoker = on` (Postgres 15+).
3. **🟠 Protection mots de passe compromis désactivée.** À activer dans Supabase → Authentication → Policies (vérification HaveIBeenPwned).
4. **🟡 Modération du chat** : aucun signalement/blocage. Ajouter « Signaler » + blocage d'un interlocuteur, et un filtre anti-partage de coordonnées (l'objectif « pas de coordonnées échangées » n'est pas techniquement forcé — une cliente peut taper son numéro dans un message).
5. **🟡 Performance RLS à l'échelle** : remplacer `auth.uid()` par `(select auth.uid())` dans les policies (17 policies concernées) — non bloquant mais recommandé avant montée en charge.

---

## 2. Audit juridique / RGPD

> ⚠️ C'est le domaine le plus en retard. Les nouvelles fonctionnalités (scan visage IA, chat, envoi de données à OpenAI) **ne sont pas couvertes** par les pages légales actuelles.

### 2.1 Données personnelles traitées
Noms, emails, téléphones, adresses d'événement, messages privés, **images de visage** (transitoires) et **diagnostics dérivés**, données de paiement (via Stripe).

### 2.2 Points de vigilance majeurs
1. **🔴 Scan du visage = donnée sensible.** Même sans stocker la photo, l'analyse d'un visage à des fins de profilage cosmétique est à haut risque RGPD. Requis :
   - **Consentement explicite** avant le scan (case à cocher dédiée, non pré-cochée), côté cliente **et** côté MUA (quand la MUA scanne une cliente, elle doit avoir recueilli l'accord de la personne).
   - Mention claire que la photo n'est **pas conservée** et que l'analyse est **cosmétique, non médicale** (déjà affichée — à intégrer aussi dans la politique de confidentialité).
2. **🔴 Transfert de données hors UE (OpenAI).** L'image part vers OpenAI (USA). À encadrer : mention dans la politique de confidentialité, base légale (consentement), clauses contractuelles types / DPA OpenAI.
3. **🔴 Mise à jour de la politique de confidentialité** pour couvrir : diagnostic IA, sous-traitant OpenAI, messagerie (stockage des messages, durée de conservation), Resend (emails), et la liste complète des sous-traitants (Supabase eu-west-1 ✅, Vercel, Stripe).
4. **🟠 Droits des personnes** : prévoir l'**export** et la **suppression de compte** (droit à l'effacement) — aujourd'hui aucun mécanisme visible.
5. **🟠 Durées de conservation** : définir et documenter (messages, diagnostics, demandes non converties, devis signés — ces derniers ont valeur contractuelle, conservation plus longue justifiée).
6. **🟠 CGV** : politique d'annulation (« 48h » est mentionnée dans l'UI mais doit figurer aux CGV), acompte, facturation auto-entrepreneur / franchise en base (déjà géré dans le devis ✅).
7. **🟡 Mineurs** : le maquillage peut concerner des mineures (ex. cérémonies). Prévoir une mention / recueil du consentement parental si scan d'une mineure.
8. **🟡 Cookies / analytics** : si Vercel Analytics/Speed Insights est actif, vérifier la base légale et l'éventuel bandeau cookies (les cookies strictement nécessaires n'en requièrent pas).

### 2.3 Existant
Les pages `legal/cgu.html`, `cgv.html`, `confidentialite.html`, `mentions-legales.html` existent — elles doivent être **relues et complétées** avec les points ci-dessus (surtout scan IA + chat).

---

## 3. Audit utilisateur (par type)

### 3.1 Prospect (non connecté)
- ✅ Peut parcourir les artistes et consulter les profils publics.
- ⚠️ **Friction** : « Contacter », « Réserver », scan et messagerie exigent un compte → redirection login (bon), mais barrière à l'entrée. _Piste : autoriser un premier message ou une demande de devis en « invité » avec juste un email, compte créé à la volée._

### 3.2 Cliente (connectée)
- ✅ Parcours réservation + diagnostic + réception/signature de devis + chat : cohérent.
- ⚠️ La cliente ne voit pas ses **devis reçus** ni ses **demandes** dans un espace dédié (elle dépend de l'email). _Piste : un mini-espace « Mes devis / Mes rendez-vous »._
- ⚠️ Le diagnostic IA échoue proprement si `OPENAI_API_KEY` absente — mais aujourd'hui **la clé n'est pas configurée** en production (feature inactive tant qu'elle n'est pas ajoutée).

### 3.3 Makeup Artist (MUA)
- ✅ Dashboard riche : réservations, disponibilités **+ récurrence hebdomadaire** (nouveau), avis, messages, diagnostic, demandes, devis, profil, portfolio, prestations, mon espace.
- ⚠️ Pas de **badge de messages/demandes non lus** dans la navigation → risque de rater une demande.
- ⚠️ Le devis auto-calculé depuis une demande ne gère pas encore la **distance de déplacement automatique** (saisie manuelle du km).
- 🐞 **Self-chat** possible (une MUA peut « se contacter » elle-même via sa propre fiche) — sans gravité mais à bloquer.

### 3.4 Admin
- ⚠️ Le rôle `admin` existe en base mais **il n'y a aucun back-office** : pas de vérification des artistes, pas de modération, pas de tableau de bord global. À créer (voir §5).

---

## 4. Bugs identifiés

| # | Bug | Gravité | État |
|---|---|---|---|
| 1 | Envoi de message chat refusé (GRANT table manquant) | Critique | ✅ Corrigé (DB) |
| 2 | Message envoyé non affiché si le temps réel tarde | Moyen | ✅ Corrigé (affichage optimiste + dédup) |
| 3 | Aperçu PDF bloqué par le bloqueur de pop-up | Moyen | ✅ Corrigé (aperçu HTML intégré) |
| 4 | Fonctions trigger exposées en RPC public | Faible | ✅ Corrigé |
| 5 | Self-chat autorisé | Faible | ⏳ À corriger (guard côté `start_conversation`) |
| 6 | Diagnostic IA / email inactifs faute de clés d'env. | — | ⏳ Config Vercel requise |

---

## 5. Améliorations & outils qui rendraient GlamBook unique

### 5.1 L'axe différenciant : la beauté augmentée par l'IA
1. **Essayage virtuel (AR try-on)** : superposer teintes de fond de teint / rouge à lèvres sur le visage en direct — prolongement naturel du scan déjà en place. C'est LE facteur « waouh » qui distingue des plateformes de booking classiques.
2. **Shade-matching → SKU produits** : relier le diagnostic à des **références produits réelles** (avec liens d'achat / affiliation) — la MUA sait exactement quoi acheter/apporter, et la plateforme touche une commission.
3. **Fiche peau évolutive** : historiser les diagnostics d'une même cliente pour suivre l'évolution (peau, allergies, préférences) rendez-vous après rendez-vous.
4. **Générateur de « look book »** : à partir du diagnostic + l'événement (mariage, soirée…), proposer 2-3 propositions de maquillage avec image générée.

### 5.2 Productivité MUA (fidélisation des pros)
5. **Synchronisation Google/Apple Calendar** des disponibilités et rendez-vous.
6. **Optimisation de tournée** : quand une MUA a plusieurs RDV le même jour, calcul d'itinéraire + frais de déplacement automatiques (relié au champ km du devis).
7. **Rappels automatiques** (email/SMS/push) : RDV J-1, devis non signé, avis à demander après prestation.
8. **Tableau de bord analytique** : CA, taux de conversion devis, clientes récurrentes, saisonnalité.
9. **Liste d'attente & remplissage auto** des créneaux annulés.

### 5.3 Confiance & croissance
10. **Back-office admin** : vérification/badge « vérifié » des artistes, modération des messages/avis, statistiques globales.
11. **Programme de fidélité / parrainage** côté clientes.
12. **Avis avec photos avant/après** (avec consentement) — preuve sociale forte.
13. **Acompte sécurisé + politique d'annulation** intégrés au devis (réduction des lapins).
14. **Notifications temps réel** de nouveaux messages (badge non-lus déjà préparé côté données via `my_conversations().unread`).
15. **Multilingue** (FR/EN) pour viser au-delà de la France.

### 5.4 Quick wins (peu d'effort, fort impact)
- Badge de **messages/demandes non lus** dans la navigation du dashboard.
- Espace **« Mes devis »** côté cliente.
- Bloquer le **self-chat**.
- **Consentement scan** (checkbox) — aussi une obligation RGPD.
- Configurer `OPENAI_API_KEY` et `RESEND_API_KEY` pour activer diagnostic + emails.

---

## 6. Prochaines étapes recommandées (ordre suggéré)
1. **RGPD** : consentement scan + mise à jour politique de confidentialité (obligation légale). 🔴
2. **Rate limiting** sur les API IA/email. 🔴
3. **Quick wins UX** (badges non-lus, espace devis cliente, guard self-chat). 🟠
4. **Back-office admin** minimal (vérification artistes, modération). 🟠
5. **Différenciation** : essayage virtuel AR + shade-matching produits. 🟢 (roadmap)

_Les corrections de sécurité base de données de cet audit sont déjà appliquées sur le projet Supabase. Les correctifs de code (chat, aperçu PDF) sont commités — pensez à `git push origin main` pour les déployer._
