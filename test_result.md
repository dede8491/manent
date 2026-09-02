#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Itération 10 — À tester (juin 2026)
user_problem_statement: 1) Interface anglaise (i18n FR/EN, sélecteur dans Réglages), 2) Couvertures manquantes (repli initiale dans résultats de recherche livre), 3) Paiement réel RevenueCat (€3,99/mois, €39,99/an, Test Store en preview), 4) (déjà validé manuellement) Refonte recherche livres multi-sources (Google+OpenLibrary+BnF en parallèle, repli BnF pour ISBN).

Notes pour le testing agent:
- Compte test test.manent@example.com / Test1234! est DÉJÀ PREMIUM (achat Test Store fait). Pour tester le paywall non-premium, créer un compte neuf.
- RevenueCat marche en web preview via Test Store (purchases-js). Flux: /premium → choisir plan → S'abonner → modal custom → "Test valid purchase" (dialog RevenueCat) → écran "Tu es Premium".
- i18n: Réglages → chip English → toute l'app passe en anglais (persisté AsyncStorage + PATCH /me/settings).
- Backend: GET /api/books/search?q=... renvoie {results:[...]} FR en premier; GET /api/books/search/isbn?isbn=9782290398487 doit renvoyer un livre (source bnf).
- Prix affichés en Test Store peuvent être $9.99/$79.99 (USD) — connu, pas un bug bloquant.

## Refonte — Chantiers 1 à 7 (sept 2026)
### Chantier 1 — Catalogue (catalog_books)
- [x] Un même livre = même couverture/résumé partout (source unique catalog_books)
- [x] Aucun appel HTTP externe pendant une requête (exception voulue : /catalog/search si <5 résultats)
- [x] Recherche titre < 300 ms (mesuré : 248 ms sur 1 393 livres, index texte french + language_override)
- Scripts relançables : seed_catalog.py (sujet × aire, OL+BnF+Google, upsert norm_key/ISBN), migrate_catalog.py
### Chantier 3 — Couvertures
- [x] Fil d'accueil < 500 ms (mesuré 343 ms) — plus de _find_cover pendant la requête
- [x] Échecs mémorisés 7 j (cover_status=failed + cover_checked_at)
- [x] zoom=2 partout, edge=curl retiré, https forcé (clean_cover_url)
### Chantier 2 — Résumés partout
- [x] Résumés dans recherche (/catalog/search), pages sujets, aires — depuis le cache uniquement
- [x] File catalog_tasks (worker 6 tâches/20 s) : Google→OL→IA ; plafond IA≠récupération gratuite
### Chantier 4 — Sujets
- [x] Renommage thème→sujet dans l'UI ; routes /themes conservées en interne
- [x] Saisie libre (onboarding « Autre… », recherche « Ouvrir le sujet », chip + sur l'accueil)
- [x] subject_mapping 12 sujets → catégories Google/subjects OL ; requêtes par subject: (plus de Louis L'Amour)
- [x] Pagination serveur ?page=&size= + « Voir plus » (sujets, aires, recherche)
- [x] Sujets du moment (compteur subject_views 7 j)
### Chantier 5 — Aires littéraires
- [x] catalog_books.areas[] + référentiel 8 aires ; admin : collections (ajout/retrait en un tap) + suggestions « à valider » (jamais visibles sans validation)
- [x] Filtre Aire sur les pages sujets (croisable) ; page /area/[key] ; section Littératures (accueil, seulement si collection non vide)
### Chantier 6 — Clubs unifiés
- [x] « cercle » → « club » partout ; paywall UNIQUEMENT sur Créer (non-premium voit tout, rejoint par code — testé 402 création / accès libre)
- [x] Club « Communauté Manent » public, adhésion automatique ; posts globaux migrés en messages
- [x] Sondages + événements PAR club (/clubs/{id}/polls|events, owner-only création — testé 403)
- [x] Livres proposés + avis → « Ce que la communauté lit » visible de tous
### Chantier 7 — Partage universel
- [x] PUBLIC_BASE_URL unique (backend .env + EXPO_PUBLIC_PUBLIC_BASE_URL) — aucun domaine en dur
- [x] Liens /@handle, /q/, /b/, /c/ → routes app (app/[slug], q/[id], b/[id], c/[code]) ; partage profil corrigé (https)
- [x] Pages OG backend /api/s/{q|b|u|c} (contenu public uniquement, bouton Rejoindre Manent + manent://)
- [x] .well-known AASA + assetlinks servis à la racine (via frontend/public) ; app.config.js pilote associatedDomains/intentFilters par variable
- Note : liens universels testables uniquement sur build store/TestFlight, pas Expo Go
### Pytest
- 120 passed ; échecs restants = rate-limit login (5/15 min) déclenché par le volume de la suite + anciens tests obsolètes (premium sans reçu RC → bloqué volontairement depuis l'audit sécurité). Pas de régression fonctionnelle identifiée via curl e2e.
