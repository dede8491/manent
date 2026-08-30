# Manent — PRD (Phase 1 MVP)

**Tagline**: verba volant, scripta manent — le Pinterest des livres pour lecteurs francophones.

## Phase 1 (MVP) — built
- **Onboarding**: écran de bienvenue (wordmark Manent + monogramme + baseline latine), création de compte email/mot de passe, sélection du mode de lecture (Plaisir / Études / Les deux) et de ≥3 thèmes parmi 12.
- **Auth**: JWT-session via `session_token` (bcrypt côté serveur), + endpoint Emergent Google Auth (`/api/auth/session`).
- **Bibliothèque**: liste des livres avec filtres (Tous/En cours/Terminés/À lire), badges Wattpad/Études, barre de progression, compteur de citations.
- **Ajouter une lecture**: 3 méthodes — recherche par titre (Google Books), scan/saisie ISBN (Google Books), lien Wattpad (scrape des métadonnées open graph).
- **Fiche livre**: notation étoiles, récapitulatif, enseignements tirés, section « Où trouver ce livre » (Librairies indépendantes / Fnac / Amazon avec mention affilié), citations du livre.
- **Capture** (bouton central surélevé Chambray dans la tab bar): appareil photo + galerie, **transcription IA via Claude Sonnet 4.6 vision** (endpoint `/api/vision` mode `transcribe`), champs éditables (texte, livre, page, note, thèmes, visibilité), mise à jour auto de la progression du livre à la nouvelle page.
- **Détail citation**: quote card (Bisque / Encre / Glacier), épinglage sur un tableau, suppression.
- **Communauté — Tableaux**: liste des tableaux 2 colonnes, création (nom, description, visibilité privé/public/collaboratif), détail avec liste des épingles.
- **Profil**: avatar, pseudo/handle, 4 stat-cards, encart Premium, déconnexion.
- **Fil d'accueil**: masonry 2 colonnes de quote cards publiques, filtre par thème + recherche, seed automatique de citations démo (L'Alchimiste, Une si longue lettre, Wattpad).

## Marque
- Palette: Espresso `#3A2119`, Glacier `#D2E2EC` (fond), Bisque `#EBCDB7` (quote cards), Chambray `#79A3C3` (accent UNIQUE), Clay `#957662`, Crème `#F5EDE4`.
- Polices: **Cormorant Garamond Italic** (titres, citations, wordmark) + **Inter** (UI). Chargées via `expo-font` depuis assets locaux.
- Tab bar 5 entrées, capture surélevée. Icônes Feather (outline).

## Modèle de données (MongoDB)
`users`, `user_sessions`, `books` (papier / wattpad / etude), `quotes`, `boards`, `board_quotes`.

## Intégrations
- **IA vision**: Claude Sonnet 4.6 via `emergentintegrations` (Emergent Universal LLM Key). Modes: `transcribe`, `page_number`.
- **Google Books API** (public, sans clé): recherche ISBN + titre.
- **Wattpad**: scrape open graph (pas d'API officielle).
- **Supabase Storage**: uploads photos privées (fallback data URL si non configuré). Bucket `manent-photos`.
- **Auth**: JWT session + Emergent Google (`/api/auth/session`).

## Phases suivantes
- **Phase 2** : citations publiques ouvertes, profils publics, pages thèmes dédiées, liens affiliés dynamiques, Premium (paiement in-app), export PDF fiche.
- **Phase 3** : clubs de lecture complets (lectures communes, passages de la semaine, visios, challenges), flashcards répétition espacée, groupes de classe, notifications push, badges/gamification.

## Ajouts session 2 (juin 2026) — construits et testés
- **Partage image**: quote card 1080×1350 exportée (react-native-view-shot en natif, html2canvas direct sur web car `findNodeHandle` non supporté). Boutons « Galerie » (expo-media-library, permissions gérées avec canAskAgain + Ouvrir les réglages) et « Partager l'image » (expo-sharing natif / Web Share API ou téléchargement PNG sur web). 3 styles: Papier/Encre/Glacier. Rendu offscreen `ShareQuoteCard.tsx`.
- **Progression par photo**: bouton « Photographier ma dernière page lue » sur la fiche livre (non-Wattpad) → caméra (natif) ou galerie (web) → `POST /api/vision` mode `page_number` (Claude Vision) → confirmation « Page détectée : N » → PATCH progress_page (+ statut en_cours/termine auto).
- **Fiche scolaire** (livres type `etude`): composant `StudySheet.tsx` — sections L'auteur, Personnages (nom+rôle), Résumé, Thèmes de l'œuvre + % de complétion (25%/section). Persisté dans `books.sheet` (PATCH /api/books/{id}).
- **Recherche fine**: écran `/search` (barre de recherche de l'accueil = bouton) — plein texte sur MES citations (text, note) et MES livres (titre, auteur, récap), segments Tout/Citations/Livres, filtres par thème et par livre. Backend `GET /api/search?q=&theme=&book_id=&scope=`.

## En attente utilisateur
- Visuels d'identité: repo GitHub fourni **https://github.com/dede8491/manent** mais PRIVÉ (404 via API publique). Demander à l'utilisateur de le passer en public temporairement OU d'uploader les fichiers (logo-manent-principal.svg, icone-manent-1024.png, logo-manent-horizontal.svg, logo-manent-fond-sombre.svg, icone-manent-*.svg, identite-de-marque-manent.md, loader_manent_ecriture_epure.html) directement dans le chat. À intégrer ensuite: icône d'app (app.json), splash, wordmark/monogramme dans l'app.

## Ajouts session 2 bis (juin 2026) — Pages Thèmes, Profils Publics, Export PDF (testés, itération 3: backend 16/16, frontend 6/6)
- **Pages Thèmes** (`/theme/[name]`): chips thème de l'accueil naviguent vers une page dédiée — titre Cormorant, 3 stat-cards (citations/lecteurs/livres), fil masonry des citations publiques. Backend `GET /api/themes/{theme}/page`.
- **Profils Publics** (`/reader/[handle]`): avatar, pseudo, @handle, bouton « Partager le profil » (Share natif / clipboard web, lien manent.app/@handle), 3 stats, grille des citations publiques. Backend `GET /api/readers/{handle}`. Accès via la ligne « Manent · @handle » des quote cards (prop `onPressAuthor`) et via le détail d'une citation d'autrui.
- **Citations publiques ouvertes**: `GET /api/quotes/{id}` renvoie désormais les citations publiques d'autres lecteurs (`is_owner=false`, vrai auteur attaché). Le détail masque poubelle + épinglage pour les non-propriétaires et affiche « Voir le profil de @handle ». DELETE/PATCH restent owner-scoped.
- **Export PDF fiche scolaire**: bouton « Exporter la fiche en PDF » sous la fiche (livres `etude`) — HTML brandé généré par `src/sheetPdf.ts` (auteur, personnages, résumé, thèmes, % complétion, citations relevées). Web: nouvel onglet + window.print(); natif: expo-print `printToFileAsync` + expo-sharing.
- Changement voulu: les chips thème de l'accueil ne filtrent plus le fil inline, ils ouvrent la page thème.



## Comment tester (aperçu web)
1. Ouvrir l'aperçu → écran de bienvenue.
2. « Commencer » → créer un compte.
3. Choisir mode + ≥3 thèmes → home feed avec citations démo.
4. Ajouter un livre via titre (ex: « Coelho »).
5. Onglet Capture → choisir une image de la galerie → transcription IA se lance.
6. Ouvrir une citation → épingler sur un tableau créé depuis l'onglet Communauté.
