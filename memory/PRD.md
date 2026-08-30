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

## Comment tester (aperçu web)
1. Ouvrir l'aperçu → écran de bienvenue.
2. « Commencer » → créer un compte.
3. Choisir mode + ≥3 thèmes → home feed avec citations démo.
4. Ajouter un livre via titre (ex: « Coelho »).
5. Onglet Capture → choisir une image de la galerie → transcription IA se lance.
6. Ouvrir une citation → épingler sur un tableau créé depuis l'onglet Communauté.
