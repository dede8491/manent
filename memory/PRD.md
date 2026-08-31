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
- (résolu) Visuels d'identité intégrés depuis https://github.com/dede8491/manent (public).

## Ajouts session 2 ter (juin 2026) — Identité, Premium, Clubs, Flashcards (itération 4: backend 26/26, frontend OK)
- **Identité visuelle officielle**: SVG du repo utilisateur embarqués dans `src/brand.ts` (monogramme, wordmark principal avec baseline latine, lockup horizontal, wordmark crème). `Wordmark`/`Monogram` (react-native-svg) utilisés sur welcome + header accueil + écran Premium. `assets/images/icon.png`, `adaptive-icon.png` (fond espresso plein), `splash-image.png`, `favicon.png` remplacés par l'icône 1024 officielle.
- **Premium (activation simulée, choix utilisateur)**: écran `/premium` fond Espresso, plans 3,99 €/mois et 34,99 €/an (−27%). `POST /api/premium/activate|deactivate`, `GET /api/premium/status`. Limites gratuites: **10 captures IA (transcription)/mois** (compteur mensuel `captures_month`/`captures_used` sur users, 402 `capture_limit_reached` au-delà, bannière + CTA dans Capture), **enregistrement galerie** et **export PDF** redirigent vers /premium si non premium. Carte Premium du profil dynamique (compteur, statut) + vraies stats (livres/citations/tableaux).
- **Clubs de lecture**: segments Tableaux|Clubs dans Communauté. `clubs` (code d'invitation 6 chars, membres, owner) + `club_messages`. Détail `/club/[id]`: code partageable, lecture commune (owner choisit parmi ses livres), passage de la semaine (carte Bisque, set_by), discussion (messages, bulles), quitter (transfert owner / suppression si vide). Endpoints: POST/GET /clubs, /clubs/join, GET/PATCH /clubs/{id}, /leave, /messages.
- **Flashcards répétition espacée**: `POST /api/books/{id}/flashcards/generate` — Claude génère des Q/R depuis les citations (idempotent, fallback déterministe). SM-2 allégé: grades again/hard/good/easy, ease 1.3+, due date. Écran révision `/flashcards/[bookId]` (carte question → révéler → noter, again remet en fin de file). Section sur la fiche livre études (compteur total/dues, Générer avec l'IA, Réviser (N)).
- Note testing agent: fix FlatList `key` (numColumns) dans community.tsx appliqué par l'agent de test.

## Ajouts session 2 quater (juin 2026) — Ajout de lecture refondu, Défis, Stats, Mode sombre (itérations 5-6: backend 15/15, frontend PASS)
- **BUG corrigé (rapporté par l'utilisateur)**: bouton caméra central de la tab bar inopérant. Cause: route `/capture` ambiguë — `app/(tabs)/capture.tsx` (Redirect home) capturait la navigation. Fix: renommé `capture-tab.tsx` + `Tabs.Screen name="capture-tab"` + bouton re-stylé (zone tactile pleine, cercle translateY -12).
- **Ajouter une lecture refondu** (`app/book/add.tsx` réécrit): onglet Titre = recherche Google Books en direct (debounce 400 ms, langRestrict=fr, 8 résultats avec couverture/année); tap → carte de confirmation Bisque (statut + mode) → ajout. Aucun résultat → ajout manuel (titre/auteur/pages). Onglet ISBN = scanner EAN-13 natif (expo-camera CameraView, cadre Chambray, aide Crème, haptique) filtrant 978/979; replis: Google → **Open Library** (backend `/books/search/isbn`) → recherche par titre → saisie ISBN manuelle; permission refusée → saisie manuelle + Ouvrir les réglages; web → saisie manuelle directe. `books.year` ajouté.
- **Défis de club**: `challenge {title, goal_pages, progress}` sur le club (PATCH owner), `POST /clubs/{id}/challenge/progress {pages}`, leaderboard trié (pct, is_me) renvoyé par GET club. UI: carte défi + classement barres chambray + saisie de ma page.
- **Stats de lecture**: collection `reading_events` (jour, pages) alimentée à chaque citation créée et chaque delta de progress_page. `GET /stats/reading` → streak (tolérance hier), 7 jours, pages semaine, jours actifs du mois. Carte sur le profil (série + barres) + vraies stats livres/citations/tableaux.
- **Mode sombre**: `src/themeCtx.tsx` (ThemeProvider, useColors/useStyles/useScheme/useToggleScheme, persisté AsyncStorage). ~20 fichiers convertis en `makeStyles(colors)` + hooks. Palette sombre: fond #2D1913, cartes #4A2E23/#5A3A2B, texte #F5EDE4, clay #C6AB93, chambray inchangé. Wordmark bascule en version crème. `premium.tsx` et `ShareQuoteCard` restent statiques volontairement (déjà sombres / export marque). Toggle sur le profil (row-darkmode). ATTENTION pour futurs composants module-scope: tout composant utilisant `styles` doit appeler `useStyles(makeStyles)` (bug BookCard corrigé en itération 6).
- Connu/minor: Google Books peut renvoyer 429 (rate limit) depuis ce conteneur → repli Open Library ajouté sur la recherche PAR TITRE (`/books/search`, itération 7 — bug utilisateur « je ne trouve pas de livres » corrigé et validé e2e) comme sur l'ISBN. Validation checksum EAN-13 ajoutée (`_valid_ean13`) → ISBN invalide = 404.

## Ajouts session 2 quinquies (juin 2026) — Liens librairies, Badges, Récap hebdo (itération 7: pytest 8/8, e2e PASS)
- **Liens librairies** (fiche livre, non-Wattpad): section « Où trouver ce livre » cliquable — leslibraires.fr, Fnac, Amazon (recherche par ISBN sinon titre+auteur), mention LIEN AFFILIÉ + note commission. testIDs `store-{domaine}`.
- **Badges lecteur**: `GET /api/badges` → 10 badges calculés (citations 1/10/50, streak 3/7/30, livres terminés 1/5, défi de club atteint, fiche d'études 100 %). Profil: rangée horizontale (gagnés en Chambray d'abord, verrouillés grisés), compteur X/10.
- **Récap hebdo club**: message système « Manent · Récap » (passage de la semaine + top 3 du défi avec pseudos) — posté automatiquement 1×/semaine à l'ouverture des messages (garde atomique `last_recap_week`, semaine ISO) + bouton owner « Envoyer le récap » (`POST /clubs/{id}/recap`). Rendu carte Bisque distincte (`recap-message`).
- Renommage testID: bouton d'ajout de la Bibliothèque = `btn-library-add` (l'ancien `btn-add-book` dupliquait le CTA de l'écran d'ajout).
- Reste à faire (mineur, non bloquant): warning `pointerEvents` (émis par une lib, notre code utilise déjà style.pointerEvents), quirk Open Library sur certains ISBN d'éditions FR.

## Ajouts session 2 sexies (juin 2026) — Objectif annuel, Citation du matin, Suggestions thème, Thème « Autre », Paramètres (itération 8: pytest 11/11, e2e ALL GREEN)
- **Objectif annuel**: `PATCH /api/me/goal`, `/stats/reading` renvoie year/yearly_goal/books_year (`finished_at` posé au passage en `termine`). Profil: carte « Objectif {année} » avec jauge Chambray + modal d'édition (KeyboardAvoidingView).
- **Citation du matin**: `GET /api/quotes/daily` (déterministe par jour, déclaré AVANT `/quotes/{quote_id}` — piège d'ordre des routes). Carte en haut de l'accueil. NOTE: le vrai widget d'écran d'accueil OS demandé nécessite un build natif + modules natifs (react-native-android-widget / WidgetKit iOS) — non faisable en Expo Go; l'utilisateur a reçu la version in-app, à reproposer en widget natif plus tard.
- **Suggestions de livres par thème**: `suggested_books` (dédupliqués, is_mine) sur `/themes/{theme}/page`; rangée horizontale sur la page thème; tap non possédé → `/book/add` prérempli via params (title/author/cover → confirm-card).
- **Thème « Autre »**: chip Autre… dans la capture (saisie libre, minuscules), `GET /api/themes/mine` = 12 thèmes + customs distincts de l'utilisateur (utilisé par capture; search utilise encore /themes statique).
- **Paramètres** (`/settings`, depuis le profil): compte, langue (fr actif / en « bientôt »), mode sombre, « Citations publiques par défaut » (`PATCH /api/me/settings`, pré-coche le toggle de la capture), export RGPD (`GET /api/me/export`, JSON sans password_hash, download web / partage natif), politique de confidentialité + conditions (modals), **suppression de compte** (`DELETE /api/me` — purge complète, transfert/suppression des clubs, déconnexion).
- Recherche Google Books toujours en quota 429 côté conteneur; repli Open Library + BnF (SRU dublincore) opérationnels. Babelio: pas d'API publique (scraping refusé, CGU).

## Ajouts session 2 septies (juin 2026) — Recos entre amis (itération 9: pytest 9/9, e2e PASS)
- **Recos entre amis**: `POST /api/clubs/{id}/reco` {title, author?, note} → message `is_reco` avec `book`. UI club: lien « Recommander un livre » (entête Discussion) → modal sélection parmi MES livres + petit mot → carte distincte bord Chambray « Reco de {pseudo} » (titre Cormorant, note en italique). testIDs: club-reco-btn, reco-book-{id}, reco-note, reco-send, reco-message.

## NON FAIT (reporté, demandes utilisateur explicites — priorité prochaine session)
1. **Interface anglaise (i18n)**: traduire toute l'app (≈25 écrans, centaines de chaînes) pour activer le sélecteur de langue des réglages (`lang-en` actuellement désactivé « bientôt »; préférence déjà persistée via PATCH /me/settings). Approche suggérée: dictionnaire fr/en dans src/i18n.ts + hook useT() branché sur la préférence.
2. **RevenueCat (paiement réel)**: remplacer l'activation Premium simulée (`/premium/activate`) par Emergent-managed RevenueCat — OBLIGATOIRE: passer par integration_expert, ne se teste que sur build natif après déploiement.
3. **Widget écran d'accueil** (citation du matin en widget OS): nécessite build natif + react-native-android-widget / WidgetKit.






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

## Itération 10 — Refonte base de recherche livres (juin 2026)
- **Recherche par titre** (`GET /api/books/search`): interrogation en PARALLÈLE de Google Books + Open Library + BnF (SRU, `bib.doctype any "a"` = livres imprimés uniquement), fusion avec priorité aux éditions françaises (Google fr > BnF > OL fr > reste), déduplication titre+auteur normalisés (`_norm_key`), max 10 résultats. Titres BnF nettoyés (« / auteur », « : roman », « ([Éd. en gros caractères]) »).
- **Recherche ISBN** (`GET /api/books/search/isbn`): 3e repli BnF ajouté (Google 429 fréquent + Open Library pauvre en ISBN français récents). Ex.: 9782290398487 introuvable avant, trouvé via BnF maintenant. Pages extraites de dc:format, auteur nettoyé des mentions de rôle.
- Validé e2e (curl + Playwright connecté) : « veiller sur elle », « la femme de ménage », « changer l'eau des fleurs » renvoient les bons livres FR en premier avec ISBN + couverture.

## Itération 10 (suite) — i18n EN + RevenueCat + couvertures
- **Interface anglaise (i18n)** : système gettext-like maison — `src/i18n.tsx` (I18nProvider, useT/useI18n, persistance AsyncStorage `manent_lang` + sync backend /me/settings) + `src/translations.ts` (dictionnaire FR→EN ~310 clés, clé = chaîne française, interpolation {var}). Tous les écrans traduits (tabs, onboarding, login, capture, add, book, quote, club, flashcards, search, settings, premium, theme, reader, board, StudySheet). Sélecteur de langue actif dans Réglages (chips Français/English). RGPD/CGU en anglais via constantes dédiées dans settings.tsx.
- **RevenueCat (paiement réel)** : Emergent-managed, projet provisionné (voir /app/memory/revenuecat.md — rc_project_id projfb23fe8b, entitlement `pro`, offering `default`, $rc_monthly €3.99/$rc_annual €39.99). `src/revenuecat.tsx` (SubscriptionProvider + useSubscription, react-query), init module-scope dans app/_layout.tsx, identité Purchases.logIn(user_id) dans src/auth.tsx (getAppUserID pour identityReady, invalidation react-query après logIn). Paywall codé dans app/premium.tsx : packages/prix depuis offerings, modal de confirmation custom, Restore, note "achat simulé" en preview, erreurs gérées (userCancelled silencieux). Miroir backend : entitlement actif → POST /premium/activate (quota captures serveur), inactif → deactivate. Testé e2e sur web preview (Test Store) : achat valide → "Tu es Premium". NB : prix affichés en Test Store peuvent rester en USD ($9.99) — les vrais prix (€3,99) s'appliquent via App Store/Play une fois les produits store créés par l'utilisateur (voir FAQ payments panel).
- **Couvertures manquantes** : composant `Cover` dans book/add.tsx (repli initiale du titre sur onError), URLs covers.openlibrary avec `?default=false` côté backend pour forcer une 404 propre.

## Itération 11 — Push notifications + refactoring routes (juin 2026)
- **Refactoring backend** : package /app/backend/routes/ créé. `routes/book_search.py` (recherche titre+ISBN Google/OL/BnF, autonome), `routes/push.py` (relais Emergent push : POST /api/register-push + helper send_push). Routers inclus AVANT `api` dans server.py pour préserver l'ordre /books/search vs /books/{book_id}. server.py réduit d'~215 lignes.
- **Push (Emergent managed / SuprSend)** : EMERGENT_PUSH_KEY=placeholder dans backend/.env (remplacé au déploiement — NE JAMAIS l'éditer). Hooks non-bloquants (try/except) : message club, reco livre, nouveau défi, passage de la semaine → push aux autres membres (action_url /club/{id}). Veilleur `_watch_wattpad` (tâche asyncio au startup, toutes les 12 h) : re-scrape les histoires Wattpad, si chapitres ↑ → push au lecteur (action_url /book/{id}) + mise à jour db.
- **Frontend** : expo-notifications + expo-device installés, plugin expo-notifications + permission POST_NOTIFICATIONS dans app.json. app/_layout.tsx : setNotificationHandler + canal Android 'default' à portée module (guards web), tap handlers (warm + cold start, navigation via action_url), relance hebdo si permission refusée (AsyncStorage pushNudgeAt + Linking.openSettings, textes i18n). src/push.ts : registerForPush (permission d'abord, getDevicePushTokenAsync, POST /api/register-push), appelé dans src/auth.tsx à chaque connexion/ouverture. No-op sur web/Expo Go.
- **En attente utilisateur** : google-services.json Firebase (package com.emergent.lecturecapture.xjqcj0) à placer dans frontend/ + câbler expo.android.googleServicesFile. Test réel uniquement après Publish + builds natifs.
- Testé : 15/15 backend (test_iteration11.py), smoke frontend OK.

## Itération 12 — Suivi des lecteurs (juin 2026)
- Collection `follows` {follower_id, followed_id, created_at} + index unique (follower,followed) + index followed_id.
- POST /api/readers/{handle}/follow (toggle, 400 self_follow, 404 inconnu, push "X suit maintenant tes lectures" au suivi — non-bloquant).
- GET /api/readers/{handle} → is_following + stats.followers. GET /api/feed → is_followed_author:true + tri stable citations suivies en tête. POST /api/quotes is_public → push aux abonnés (« texte », action_url /quote/{id}).
- Frontend : bouton Suivre/Suivi (btn-follow) sur /reader/[handle] (masqué si is_me), compteur abonnés dans les stats, tag « SUIVI » chambray sur les cartes du fil (home.tsx), i18n Follow/Following/followers.
- Testé : 7/7 backend (test_iteration12.py) + e2e frontend FR/EN. Toujours en attente : google-services.json Firebase (non fourni — l'image jointe était une capture GitHub).

## Itération 13 — Suppression de livre + pont recherche locale→catalogue (juin 2026)
- **Diagnostic « je ne trouve pas de livres »** : la recherche de l'accueil (/search) ne fouille QUE la bibliothèque/citations de l'utilisateur. Ajout d'un pont : état vide → CTA « Chercher « {q} » dans le catalogue en ligne » (testID search-catalog-cta) + lien discret au-dessus des résultats livres (search-catalog-link) → navigue vers /book/add?q={q} (add.tsx accepte le param q et préremplit la recherche internet).
- **Babelio** : impossible (aucune API publique, le site bloque les IP serveurs — timeout). Base = Google Books + Open Library + BnF.
- **Nettoyage BnF** : helper _clean_bnf_title (retire « (Éd. collector) », « ([Éd. en gros caractères]) », « : roman … »), appliqué titre + ISBN → meilleure déduplication.
- **Suppression de livre** : icône corbeille (book-delete) dans l'en-tête de la fiche livre → modal de confirmation custom (compatible web, Alert.alert ne marche pas sur web) → DELETE /api/books/{id} → retour bibliothèque. Les citations sont conservées. i18n FR/EN.
- Testé e2e : recherche « jacaranda » vide → CTA → ajout depuis le catalogue → suppression → disparu de la bibliothèque.

## Itération 14 — Fiche de lecture interactive + Carnet premium + recherche accueil→internet (juin 2026)
- **Fiche de lecture** (/fiche/[bookId], bouton btn-fiche sur toute fiche livre) : 9 sections éditoriales (Le livre + genre/éditeur, L'auteur, En 5 minutes, Les 5 idées à retenir (max 5), Les passages marquants pré-remplis depuis les citations, Ce que j'en retiens, On en parle ?, Mon avis (étoiles Ionicons pleines + texte), À qui je le recommande ?). Auto-save débounce 1,2 s (PUT /api/books/{id}/fiche), rating synchronisé sur book.rating. IMPORTANT : Section/ListEditor hoistés au niveau module (sinon perte de focus TextInput à chaque frappe).
- **Backend** : book.fiche dict (FICHE_FIELDS), GET/PUT /api/books/{id}/fiche (pré-remplissage passages via quotes), GET /api/fiches (tri updated_at desc).
- **Carnet** (/carnet, row-carnet dans profil avec tag PREMIUM) : liste des fiches (étoiles, date). Non-premium → verrou carnet-locked + CTA /premium. Export/partage PDF (src/fichePdf.ts, buildFicheHtml) réservé premium (redirect /premium sinon).
- **Recherche accueil** : /search interroge AUSSI /api/books/search (débounce 450 ms, 6 résultats max, section « Catalogue en ligne », testID search-catalog-{i}) → tap → /book/add prérempli (params title/author/cover/isbn/pages/year, prefill étendu dans add.tsx). Section locale renommée « Dans ta bibliothèque ({n}) ».
- Testé : 9/9 backend (test_iteration13.py) + e2e frontend complet (focus test 100 chars OK, premium/non-premium).

## Itération 15 — Autofill IA fiche + Découverte par ISBN + Fiche→Club (juin 2026)
- **Autofill IA** : POST /api/books/{id}/fiche/autofill (Claude Sonnet 4.6, JSON genre/publisher/author_bio/summary). Frontend bouton fiche-autofill dans « Le livre » — ne remplit QUE les champs vides (préserve les saisies).
- **Fiche → Club** : bouton fiche-send-club dans « On en parle ? » → modal des clubs → POST /clubs/{id}/messages avec texte multi-lignes (titre + questions numérotées).
- **Découverte code-barres** : bouton home-scan dans l'accueil → /discover/scan (CameraView ean13 mobile / saisie ISBN web+repli) → /discover/[isbn] : GET /api/discover/isbn/{isbn} (métadonnées via routes.book_search.search_isbn + communauté : lecteurs, note moyenne des books partageant l'ISBN, citations publiques via book_ids, in_library) → CTA « Ajouter à ma bibliothèque » (prérempli).
- Testé : 5/5 backend (test_iteration14.py) + 4 flows e2e frontend. Toujours en attente : google-services.json Firebase.

## Itération 16 — Lecteurs à découvrir (juin 2026)
- GET /api/readers/suggestions : candidats hors soi/déjà-suivis, score = 3×thèmes partagés + min(citations publiques,10), top 10. Enregistré AVANT /readers/{handle} (ordre FastAPI).
- Communauté : section horizontale « Lecteurs à découvrir » (suggest-reader-{handle}) sous les onglets — avatar initiale, pseudo, thèmes partagés (ou nb citations publiques), bouton Suivre/Suivi inline (suggest-follow-{handle}), tap carte → profil public. i18n FR/EN.
- Testé : curl backend + e2e Playwright (section visible, toggle Suivre→Suivi→Suivre).
- Info donnée au user : package Android = com.emergent.lecturecapture.xjqcj0.
