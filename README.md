# Manent

> Ce que tes lectures laissent derrière elles.

Application mobile iOS + Android (Expo / React Native) pour lecteurs et étudiants
francophones. Manent ne gère pas des livres : il capture ce que les lectures
laissent — citations photographiées et transcrites par IA, fiches de lecture,
enseignements — les organise en tableaux thématiques, les partage en quote cards,
et fait découvrir des livres **par ce qu'ils contiennent**, pas par leur couverture.

Trois types de lectures : **livres papier** (scan ISBN), **histoires Wattpad**
(lien collé, suivi par chapitre), **livres d'études** (fiche structurée + flashcards).

## Démarrer

```bash
npm install
cp .env.example .env        # facultatif : l'app tourne en local sans backend
npx expo start
```

L'app fonctionne **sans backend** : le store local (AsyncStorage) est amorcé avec
un jeu de données de démonstration. Renseigner `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` active l'authentification, la synchronisation, la
transcription IA et l'import Wattpad.

La synchronisation est **hors ligne d'abord** : les mutations s'empilent dans une
outbox persistée et repartent au retour du réseau, les conflits se tranchent à la
dernière écriture. Le détail est dans [`docs/ROADMAP.md`](docs/ROADMAP.md).

| Commande            | Effet                                    |
| ------------------- | ---------------------------------------- |
| `npm start`         | serveur de développement Expo            |
| `npm run ios`       | build de développement iOS               |
| `npm run android`   | build de développement Android           |
| `npm run typecheck` | TypeScript en mode strict                |
| `npm run lint`      | ESLint (config Expo)                     |
| `npm test`          | Jest — 148 cas                           |

Les fonctionnalités natives — appareil photo, scan de code-barres, partage
d'image, PDF, notifications — nécessitent un *development build*
(`npx expo run:ios` / `run:android`), pas Expo Go.

## Architecture

```
app/                       routes expo-router (file-based)
  _layout.tsx              polices, hydratation du store, pile racine
  index.tsx                redirige vers l'onboarding ou les onglets
  onboarding/              bienvenue · personnalisation · compte
  (tabs)/                  accueil · bibliothèque · [capture] · communauté · profil
  capture.tsx              modale de capture (cœur de l'app)
  ajouter.tsx              ISBN / titre / Wattpad
  livre/[id].tsx           aiguille vers la fiche perso, Wattpad ou études
  citation/[id].tsx        détail citation
  partager.tsx             quote card + partage natif
  tableau/                 nouveau · [id]
  club/                    nouveau · [id]
  theme/[slug].tsx         page thème
  profil/                  challenges · public
  premium.tsx · parametres.tsx · notifications.tsx · recherche.tsx

src/
  theme/                   palette, typographies, espacements — source unique du style
  components/              design system (fiche-citation, quote card, boutons…)
  features/                écrans composés : book/, capture/, community/
  store/                   zustand + persistance AsyncStorage, sélecteurs dérivés
  sync/                    moteur hors ligne : outbox, fusion, passerelle Supabase
  services/                Google Books, Wattpad, OCR, affiliation, partage, auth
  lib/                     formatage français, identifiants
  i18n/                    dictionnaires et `t()` — le français est la référence
  data/                    thèmes et jeu de données de démarrage
  types/                   modèle de données partagé avec le schéma Postgres

supabase/
  migrations/              schéma, RLS, recherche plein texte française
  functions/ocr/           transcription IA (clé API côté serveur uniquement)
  functions/wattpad-import/ récupération des métadonnées d'une histoire
  functions/public-page/   pages web publiques /q/:id, /b/:slug, /@pseudo
```

Règle de style : **aucune couleur ni police en dur dans un écran**. Tout passe par
`src/theme`. Les composants du design system sont dans `src/components`, les
écrans les assemblent.

## Identité visuelle

Palette « bibliothèque à l'encre verte » : papier froid `#F5F4EF`, encre `#1F2430`,
vert bibliothèque `#275C4B` (accent), ambre marque-page `#C9973B` (pages, étoiles),
orange Wattpad `#E96C10`, bleu ardoise études `#3E5C76`.
Typographies : **Fraunces** (titres, citations, grands chiffres) et **Public Sans**
(interface).

L'élément signature est la **fiche-citation** (`src/components/QuoteSheet.tsx`) :
carte blanche à filet vertical vert, citation en serif, numéro de page en Fraunces
Black ambre sous la mention `PAGE` — ou `CHAP.` en orange pour Wattpad.
La **quote card de partage** (`src/components/ShareQuoteCard.tsx`) se décline en
trois fonds — Encre, Papier, Forêt — et porte le filigrane « capturé avec Manent »,
retiré en Premium.

## Backend

Supabase : Postgres avec RLS, Auth (e-mail, Google, Apple), Storage, fonctions edge.

```bash
supabase start
supabase db reset                 # applique les migrations
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy ocr wattpad-import flashcards public-page
```

- **`ocr`** — une seule brique de vision, deux consignes : transcrire une citation,
  ou lire le numéro de page imprimé (mise à jour de progression par photo). Le
  quota du plan gratuit (15 transcriptions/mois) est appliqué **côté serveur**.
- **`wattpad-import`** — Wattpad n'a pas d'API publique : la fonction lit les
  métadonnées Open Graph de la page. Elle renvoie toujours un objet exploitable,
  quitte à laisser des champs à compléter à la main.
- **`flashcards`** — fabrique les cartes de révision à partir de la fiche de
  lecture et des citations de l'élève, et de rien d'autre : la consigne interdit
  toute connaissance extérieure, pour que l'élève révise son propre travail.
- **`public-page`** — rend les pages publiques (citation, tableau, profil) en HTML
  avec balises Open Graph : porte d'entrée virale et SEO. Elle n'expose **que** ce
  qui est explicitement public.

Aucune clé d'API vision, aucune clé de service ne vit dans l'application.

## Monétisation

1. **Affiliation** — trois liens d'achat par fiche livre (librairies indépendantes,
   Fnac via Awin, Amazon), badge « lien affilié » non masquable et mention de la
   commission au clic.
2. **Premium** — 3,99 €/mois ou 34,99 €/an (−27 %), essai 7 jours, achats intégrés
   App Store / Play Store. Débloque transcriptions illimitées, export PDF, tableaux
   collaboratifs et clubs illimités, flashcards illimitées, statistiques avancées,
   quote cards sans filigrane.
3. **Épingles sponsorisées** d'éditeurs dans le fil, marquées « Sponsorisé ».

## Contraintes légales

- **RGPD** — consentement, export complet des données en JSON depuis les
  paramètres, suppression de compte définitive.
- **Droit de courte citation** — seules les citations transcrites courtes, avec
  mention de l'auteur et de l'œuvre, sont partageables publiquement. Les **photos
  de pages restent privées** : bucket Storage privé, jamais exposées par les pages
  publiques, jamais dans une quote card.
- **Liens affiliés et contenu sponsorisé** clairement identifiés.
- **Prix unique du livre (loi Lang)** — le même prix est affiché chez tous les
  marchands ; seul le marchand et la livraison diffèrent.

## État et suites

Voir [`docs/ROADMAP.md`](docs/ROADMAP.md) pour le détail de ce qui est en place,
de ce qui nécessite le backend, et de ce qui reste à faire.
