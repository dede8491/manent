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
| 12 | Fiche études | `livre/[id]` | ✅ ; génération des cartes ⚠️ |
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
| Génération des flashcards | `ANTHROPIC_API_KEY` + `supabase functions deploy flashcards` | `supabase/functions/flashcards` |
| Pages web publiques | déployer `public-page` et router `manent.app/q`, `/b`, `/@` dessus | `supabase/functions/public-page` |
| Auth Google / Apple | `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`… dans Supabase Auth | `supabase/config.toml` |
| Synchronisation multi-appareils | un projet Supabase et les deux migrations appliquées | `src/sync`, `supabase/migrations` |
| Achats intégrés | intégration RevenueCat + produits App Store / Play Store | `app/premium.tsx` |
| Notifications push | jetons Expo Notifications, envoi côté serveur | `app/notifications.tsx` |
| Affiliation | identifiants Amazon Partenaires, Awin, leslibraires.fr | `.env`, `src/services/affiliate.ts` |

Sans ces éléments l'app reste utilisable : la transcription retombe sur la saisie
manuelle, l'import Wattpad pré-remplit depuis l'URL, Premium s'active localement.

## Ce qui reste à faire

**Synchronisation.** Le moteur (`src/sync`) est écrit et testé
contre une passerelle en mémoire, mais il n'a jamais tourné contre un vrai
Supabase : c'est ce qu'il faut vérifier en premier. Trois manques connus :

- **Clubs, notifications, badges et challenges ne sont pas synchronisés.** Ils
  restent servis par le jeu de données local ; seuls les livres, citations,
  tableaux et épingles font l'aller-retour.
- **Aucune reprise sur conflit d'identifiant.** Deux appareils hors ligne qui
  créent chacun une ligne produisent deux identifiants distincts : c'est le
  comportement voulu, mais il n'y a pas de déduplication si la même citation est
  capturée deux fois.

**Fil communautaire réel.** Le fil, les lecteurs suggérés et les épingles
sponsorisées viennent de `src/data/seed.ts`. Les citations publiques de
l'utilisateur y sont bien intercalées, mais l'algorithme de recommandation et la
régie publicitaire restent à construire.

**i18n.** L'infrastructure existe (`src/i18n` : dictionnaires, interpolation,
pluriel) et porte le vocabulaire partagé — statuts, visibilités, unités,
décomptes. Les libellés propres à chaque écran sont encore écrits en français
dans le JSX ; les migrer clé par clé est mécanique.

**Tests.** 128 cas couvrent le store, les services, le moteur de synchronisation
et le design system. Il manque des tests d'écran (parcours de capture, parcours
d'ajout d'une lecture) et un test d'intégration contre un Supabase local.

## Comment fonctionne la synchronisation

Le store local est la source de vérité pendant l'usage ; le serveur arbitre
entre appareils.

1. **Outbox.** Chaque mutation d'une entité synchronisée (livre, citation,
   tableau, épingle) inscrit une opération dans une file persistée. Une seule
   opération est retenue par ligne : l'envoi transmet l'état courant, pas un
   diff. La file survit à la fermeture de l'app — c'est ce qui rend le travail
   hors ligne sûr.
2. **Envoi.** Au retour du réseau, la file est rejouée par entité, dans l'ordre
   des dépendances (livres, citations, tableaux, puis épingles). Une entité qui
   échoue laisse ses opérations en file sans bloquer les autres.
3. **Réception.** On tire les lignes modifiées depuis la dernière borne, en se
   limitant aux siennes : les politiques RLS autorisent aussi la lecture des
   citations publiques d'autrui, qui n'ont rien à faire dans le miroir local.
   Les épingles passent par la fonction `my_board_quotes`, qui rend aussi celles
   posées par d'autres sur un tableau collaboratif.
4. **Conflits.** Dernière écriture gagnante, sur le `updated_at` écrit par le
   client. À égalité stricte, la version distante l'emporte.
5. **Suppressions.** Douces côté serveur (`deleted_at`), pour qu'un appareil
   resté hors ligne apprenne la disparition au lieu de faire réapparaître la
   ligne à son prochain envoi.

La borne `lastSyncedAt` n'avance que si tout est parti : un envoi partiel doit
repartir du même point. La synchronisation se déclenche au lancement et à chaque
retour au premier plan, au plus une fois par minute, et se pilote à la main
depuis les paramètres.

## Priorités d'origine

- **V1 (MVP)** — onboarding, bibliothèque, ajout, capture + transcription, fiche
  livre + progression par photo, citation + quote card + partage, tableaux privés,
  stockage local et comptes. ✅
- **V2** — fil d'accueil, citations publiques, thèmes suivis, profils publics,
  liens affiliés, Premium. ✅ côté app ; recommandation et régie à construire.
- **V3** — clubs complets (lectures communes, commentaires, visios, challenges,
  badges) et mode études (fiche structurée, flashcards, groupes de classe). ✅
  côté app ; la génération des cartes attend le déploiement de la fonction edge.
