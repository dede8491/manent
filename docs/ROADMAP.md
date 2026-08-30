# État du chantier

Ce document dit franchement ce qui tourne, ce qui attend le backend, et ce qui
reste à écrire. Il est à jour du dernier commit.

## Les 19 écrans

| # | Écran | Route | État |
| - | ----- | ----- | ---- |
| 1 | Bienvenue | `onboarding/bienvenue` | ✅ |
| 2 | Personnalisation (mode de lecture + ≥ 3 thèmes) | `onboarding/personnalisation` | ✅ |
| 3 | Création de compte | `onboarding/compte` | ✅ formulaire ; Google/Apple ⚠️ |
| 4 | Accueil — le fil | `(tabs)/index` | ✅ |
| 5 | Recherche | `recherche` | ✅ |
| 6 | Page thème | `theme/[slug]` | ✅ |
| 7 | Capture | `capture` | ✅ ; transcription IA ⚠️ |
| 8 | Bibliothèque | `(tabs)/bibliotheque` | ✅ ; lecture du n° de page ⚠️ |
| 9 | Ajouter une lecture | `ajouter` | ✅ ; Wattpad ⚠️ |
| 10 | Fiche livre (perso) | `livre/[id]` | ✅ |
| 11 | Fiche Wattpad | `livre/[id]` | ✅ |
| 12 | Fiche études | `livre/[id]` | ✅ |
| 13 | Détail citation | `citation/[id]` | ✅ |
| 14 | Partager la citation | `partager` | ✅ |
| 15 | Communauté — Tableaux | `(tabs)/communaute` | ✅ |
| 16 | Créer un tableau | `tableau/nouveau` | ✅ |
| 17 | Détail tableau | `tableau/[id]` | ✅ |
| 18 | Communauté — Clubs | `(tabs)/communaute` | ✅ |
| 19 | Créer un club | `club/nouveau` | ✅ |
| 20 | Détail club | `club/[id]` | ✅ |
| 21 | Profil | `(tabs)/profil` | ✅ |
| 22 | Challenges & badges | `profil/challenges` | ✅ |
| 23 | Profil public (aperçu) | `profil/public` | ✅ |
| 24 | Premium | `premium` | ✅ écran ; paiement ⚠️ |
| 25 | Paramètres | `parametres` | ✅ |
| 26 | Notifications | `notifications` | ✅ liste ; push ⚠️ |

✅ = écran complet, navigable, branché sur le store.
⚠️ = nécessite une configuration externe, détaillée ci-dessous.

## Ce qui demande une configuration externe

Chacun de ces points est **codé de bout en bout côté app** ; il ne manque que les
identifiants ou le déploiement.

| Fonctionnalité | Ce qui manque | Où |
| -------------- | ------------- | -- |
| Transcription IA et lecture du n° de page | `ANTHROPIC_API_KEY` + `supabase functions deploy ocr` | `supabase/functions/ocr` |
| Import Wattpad | `supabase functions deploy wattpad-import` | `supabase/functions/wattpad-import` |
| Pages web publiques | déployer `public-page` et router `manent.app/q`, `/b`, `/@` dessus | `supabase/functions/public-page` |
| Auth Google / Apple | `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`… dans Supabase Auth | `supabase/config.toml` |
| Achats intégrés | intégration RevenueCat + produits App Store / Play Store | `app/premium.tsx` |
| Notifications push | jetons Expo Notifications, envoi côté serveur | `app/notifications.tsx` |
| Affiliation | identifiants Amazon Partenaires, Awin, leslibraires.fr | `.env`, `src/services/affiliate.ts` |

Sans ces éléments l'app reste utilisable : la transcription retombe sur la saisie
manuelle, l'import Wattpad pré-remplit depuis l'URL, Premium s'active localement.

## Ce qui reste à faire

**Synchronisation.** Le store zustand est aujourd'hui purement local. Le schéma
Postgres (`supabase/migrations`) reflète exactement `src/types`, mais la couche de
synchronisation (lecture/écriture Supabase, résolution de conflits, mode hors
ligne) n'est pas écrite. C'est le principal chantier avant une mise en production.

**Fil communautaire réel.** Le fil, les lecteurs suggérés et les épingles
sponsorisées viennent de `src/data/seed.ts`. Les citations publiques de
l'utilisateur y sont bien intercalées, mais l'algorithme de recommandation et la
régie publicitaire restent à construire.

**i18n.** L'infrastructure existe (`src/i18n` : dictionnaires, interpolation,
pluriel) et porte le vocabulaire partagé — statuts, visibilités, unités,
décomptes. Les libellés propres à chaque écran sont encore écrits en français
dans le JSX ; les migrer clé par clé est mécanique.

**Génération des flashcards.** Les cartes sont aujourd'hui fournies par le jeu de
données. Leur génération depuis la fiche de lecture et les citations de l'élève
passera par la même fonction edge que l'OCR, avec une troisième consigne.

**Tests.** Aucun test automatisé. Les priorités : le store (progression, quotas,
répétition espacée), les services (parsing Google Books, détection d'URL Wattpad)
et le formatage français.

## Priorités d'origine

- **V1 (MVP)** — onboarding, bibliothèque, ajout, capture + transcription, fiche
  livre + progression par photo, citation + quote card + partage, tableaux privés,
  stockage local et comptes. ✅
- **V2** — fil d'accueil, citations publiques, thèmes suivis, profils publics,
  liens affiliés, Premium. ✅ côté app ; recommandation et régie à construire.
- **V3** — clubs complets (lectures communes, commentaires, visios, challenges,
  badges) et mode études (fiche structurée, flashcards, groupes de classe). ✅
  côté app ; génération des flashcards par IA à brancher.
