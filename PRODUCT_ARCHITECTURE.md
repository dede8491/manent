# Manent — architecture produit

Document de référence pour toute évolution. À relire avant d'ajouter, déplacer ou fusionner une fonctionnalité.
Dernière mise à jour : septembre 2026, après l'audit initial et le recentrage sur le journal de lecture.

## 1. Vision

**Manent est le compagnon quotidien de lecture : un journal intime de ce que je lis et ressens.**
Promesse : « garde une trace de tout ce que tu lis et ressens ». Parcours central, en deux taps :
ouvrir l'app → voir mon livre en cours → écrire mon entrée du jour.

Ce qui nourrit le journal : la bibliothèque (mes livres, ma progression), les citations (photographiées et
transcrites, ou écrites), la fiche de fin de livre (souvenir partageable, canal d'acquisition).
Ce qui est secondaire : la découverte (Pour toi, filtres, intention), la couche sociale (profils, abonnements,
tableaux, clubs). Ce qui est reporté (phase 2) : fiches d'études, flashcards, fiche scolaire, Wattpad, journal de club.

Cible : lectrices et lecteurs francophones. Langue de l'interface : français (anglais par dictionnaire).
Monétisation : Premium via RevenueCat (App Store / Google Play). Pas de paiement mobile money dans le code.

## 2. Architecture technique

| Couche | Choix |
|---|---|
| Mobile | Expo 54, React Native, Expo Router (routage par fichiers), TypeScript strict |
| Thème | `src/theme.ts` (jetons) + `src/themeCtx.tsx` (clair / sombre, `useColors`, `useStyles(makeStyles)`) |
| i18n | `src/i18n.tsx` : les clés sont les phrases françaises, `src/translations.ts` porte l'anglais |
| Données mobile | `src/api.ts` (`api()` avec Bearer), pas de cache global ; hors ligne pour le journal dans `src/journal.ts` |
| Backend | FastAPI + Motor sur MongoDB (hébergé par Emergent). `backend/server.py` (historique) + `backend/routes/*` (modules) |
| Helpers partagés | `backend/deps.py` : `db`, `now_utc`, `new_id`, `get_current_user` (les routes modulaires importent d'ici) |
| IA | Clé Emergent (`EMERGENT_LLM_KEY`) via `ai_provider.py` pour la classification ; appels directs ailleurs (vision, résumés) |
| Fichiers | Supabase Storage pour les photos, repli base64 en base si non configuré |
| Tests | `backend/tests_unit` (purs, sans base) ; `backend/tests` (intégration sur base réelle, à ne pas lancer par défaut) |

Commandes de vérification avant tout commit :
`cd frontend && npx tsc --noEmit && npx expo lint` (0 erreur) · `cd backend && python3 -m pytest tests_unit -q`.

## 3. Modules et écrans

```
Accueil            app/(tabs)/home.tsx          livre en cours, écrire, dernière entrée, série douce
Journal            app/(tabs)/journal.tsx       entrées par jour + citations (segments), filtre par livre
  Écrire           app/journal/new.tsx          page, humeur, prompt, texte, citations, publication ; brouillon + file hors ligne
  Entrée           app/journal/[id].tsx
  Fiche de fin     app/journal/wrapup/[bookId].tsx   export image Stories
  Capture          app/capture.tsx              photo / galerie / écriture, transcription IA
  Citation         app/quote/[id].tsx
Bibliothèque       app/(tabs)/library.tsx       grille par statut, ajout, lecture suivante (app/queue.tsx)
  Fiche livre      app/book/[id].tsx            statut, progression, photo de page, journal, avis, citations, partage
  Ajouter          app/book/add.tsx             titre, ISBN (scan), Wattpad
Découvrir          app/(tabs)/discover.tsx      recherche, Pour toi, fil, collections, clubs publics
  Recherche        app/search.tsx → app/browse.tsx (résultats) → app/filters.tsx
  Intention        app/intent.tsx
Communauté         app/(tabs)/community.tsx     tableaux et clubs (écran masqué de la barre)
Profil             app/(tabs)/profile.tsx       stats, abonnements, objectif, badges, Premium, réglages
  Paramètres       app/settings.tsx
  Reçus            invitations + recommandations
Premium            app/premium.tsx
Admin              app/admin.tsx                signalements, classification, prompts du journal, comptes
Liens publics      /@handle, /q, /b, /c, /t     pages OG côté serveur + redirections côté app
```

Backend : `routes/journal.py` (journal), `routes/catalog.py` + `routes/classification.py` (catalogue et moteur de
classification), `routes/club.py` (club global, gelé), `routes/share.py` (pages publiques), `routes/push.py`,
`server.py` (auth, livres, citations, tableaux, clubs privés, social, premium, admin, stats).

## 4. Navigation

Barre à cinq onglets, icônes Feather avec libellé d'accessibilité : **Accueil, Journal, Bibliothèque, Découvrir, Profil**.
Règles :
- La navigation reflète le modèle mental de la lectrice (mon livre, mes traces, mes livres, découvrir, moi), pas
  l'organisation du code.
- Les citations sont une trace de lecture : elles vivent dans l'onglet Journal (segment), jamais dans un onglet à part.
- Tout écran secondaire a un en-tête standard : chevron retour à gauche, libellé en capitales au centre, action à droite.
- Un même geste n'a qu'une porte d'entrée mémorisable (une barre de recherche, un flux d'ajout de livre, une boîte de réception).
- Les liens partagés (`/q`, `/b`, `/c`, `/t`, `/@`) doivent rester valables : toute suppression d'écran garde une redirection.

## 5. Parcours de référence

| Parcours | Chemin | Taps |
|---|---|---|
| Écrire mon entrée du jour | Accueil → bouton → Enregistrer | 2 |
| Garder une citation | Journal → + → Photographier → transcription → Enregistrer → proposition d'entrée | 4 |
| Ajouter le livre que je lis | Bibliothèque → + → recherche → statut → Ajouter | 4 |
| Terminer un livre | Fiche livre → Terminé → noter → fiche de fin → partager | 4 |
| Trouver un livre selon une envie | Découvrir → recherche, mode « envie » → résultats | 3 |

## 6. Règles UX

- **Jamais culpabiliser** : la série de jours se formule en positif ; zéro jour affiche une invitation, pas un reproche.
- **Privé par défaut** : entrées et citations sont privées ; la publication est un geste explicite et réversible.
- **Une erreur réseau n'est jamais un état vide** : utiliser `ErrorState` (avec Réessayer) ; un état vide n'invite à créer que si la requête a réussi.
- **Chaque écran a ses états** : chargement (`ManentLoader`), vide, erreur, succès (toast).
- **Hors ligne** : le journal s'écrit sans réseau (brouillon local, file rejouée) ; ne jamais perdre une saisie.
- **Deux taps maximum** de l'accueil à l'écriture.
- **Progression** : ne recule jamais automatiquement ; une page atteinte fait avancer le livre, un livre « à lire » passe « en cours ».
- **Premium** : le paywall n'annonce que ce qui existe. Gratuit : 3 entrées par semaine, 1 nouveau livre en cours, 10 captures IA par mois.

## 7. Règles UI et design system

Palette (clair) : Espresso `#3A2119` (texte), Glacier `#D2E2EC` (fond), Crème `#F5EDE4` (cartes), Bisque `#EBCDB7`
(mise en avant), Chambray `#79A3C3` (accent unique), Clay `#957662` (secondaire), Danger `#B3552F`, Success `#5C8A6B`,
Overlay `rgba(58,33,25,0.45)`. Le sombre remappe les mêmes jetons (`darkColors`). **Aucune couleur en dur dans les écrans.**

Typographie : Cormorant Garamond italique (titres, citations, chiffres marquants), Inter (interface).
Libellés de section : Inter Medium 11, interlettrage 1.5, capitales, couleur Clay.

Jetons : `spacing` (4 · 8 · 12 · 16 · 24 · 32 · 48), `radius` (sm 4 · md 8 · lg 16 · xl 20 · pill 999).
Boutons : pilule. Primaire Chambray sur Crème, secondaire bordure `borderSoft`, danger `colors.danger`. Hauteurs : 36 (compact), 44 (standard), 52 (principal plein écran).
Cibles tactiles : 44 × 44 minimum pour toute icône seule (`IconButton`), `hitSlop` sur les chips.

Composants partagés (à utiliser avant d'en créer un) : `ScreenHeader`, `IconButton`, `PrimaryButton` / `GhostButton`,
`Chip`, `BottomSheet`, `Toast`, `ErrorState`, `ManentLoader`, `BookCover`, `QuoteCard`, `InfoTooltip`, `MoodTimeline`.

Accessibilité : chaque contrôle sans texte porte un `accessibilityLabel` ; les onglets un `tabBarAccessibilityLabel` ;
les listes longues sont virtualisées (`FlatList` / `SectionList`).

## 8. Décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-09 | Recentrage sur le journal de lecture ; découverte reléguée dans Découvrir | Nouveau positionnement produit |
| 2026-09 | Humeur en cinq mots colorés, pas d'emoji | Cohérence avec les filtres épurés |
| 2026-09 | Un seul nouveau livre en cours en gratuit, les livres déjà en cours ne sont pas bloqués | Ne pas casser l'expérience des testeurs |
| 2026-09 | Citations fusionnées dans l'onglet Journal (segments) | Même objet mental, un doublon de liste en moins |
| 2026-09 | Promesses Premium tenues : export PDF du journal par livre et rétrospective annuelle livrés | Le paywall ne promet que ce qui existe |
| 2026-09 | Backend conservé sur MongoDB ; Supabase limité aux photos | Migration hors de proportion avec le besoin |
| 2026-09 | Club global « livre du mois » retiré du mobile, backend gelé | Écrans injoignables |
| 2026-09 | Origines des auteurs déduites par la classification, plus d'« aires » manuelles | Demande produit |

## 9. Problèmes connus

- `server.py` reste monolithique (106 routes) ; la migration vers `routes/*` est progressive.
- Les tests d'intégration (`backend/tests`) écrivent sur la base réelle ; à remplacer par des tests de routes en mémoire.
- Pas de cache de réponses côté mobile : chaque focus d'onglet recharge.
- Le mode sombre est un choix manuel ; le suivi du réglage système est prévu.

## 10. Feuille de route

1. Solidité du cœur (index, parallélisme, états d'erreur, accessibilité de base, jetons). **Fait.**
2. Navigation et Premium honnêtes (Journal + Citations, export PDF, rétrospective, boîte Reçus).
3. Découvrir et recherche simplifiés (une porte, cinq sections, un écran de détail catalogue, un flux d'ajout).
4. Design system appliqué (ScreenHeader, IconButton, Button pilule, Chip, listes virtualisées, cache image, thème système).
5. Backend consolidé (module `reading`, déduplication, quotas IA par compte, validation, tests de routes).
