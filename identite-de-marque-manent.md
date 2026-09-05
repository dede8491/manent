# Manent — Identité de marque

*verba volant, scripta manent* — les paroles s'envolent, les écrits restent.

---

## 1. Essence de la marque

**Mission.** Permettre à chaque lecteur de garder ce que ses lectures lui laissent : citations, fiches, enseignements — et de les partager.

**Positionnement.** Le Pinterest des livres, en francophonie. Là où Babelio catalogue des couvertures, Manent capture la substance.

**Promesse.** « Ce que vos lectures vous laissent. »

**Baseline latine.** *verba volant, scripta manent* — utilisée sous le logo, sur l'écran de démarrage et dans les quote cards premium.

**Valeurs.** Mémoire, transmission, élégance lettrée, chaleur. Une app calme dans un monde de feeds bruyants.

**Personnalité.** Si Manent était une personne : une libraire cultivée et bienveillante, qui tutoie ses habitués, se souvient de ce qu'ils ont aimé, et glisse toujours le bon conseil.

---

## 2. Palette de couleurs

| Nom | Hex | Rôle |
|---|---|---|
| **Espresso** | `#3A2119` | Encre : texte principal, icônes, fonds sombres. Remplace le noir partout — jamais de #000. |
| **Glacier** | `#D2E2EC` | Fond par défaut des écrans, surfaces claires. |
| **Bisque** | `#EBCDB7` | Cartes, quote cards, effet papier. |
| **Chambray** | `#79A3C3` | Accent unique : bouton principal, liens, éléments actifs, le point du logo. |
| **Clay** | `#957662` | Secondaire : tags, texte atténué, boutons tertiaires. |
| Crème | `#F5EDE4` | Texte et logo sur fonds Espresso. |

**Règles d'usage.**
- Un seul accent par écran (Chambray). Tout le reste reste neutre.
- Ratio approximatif : 60 % Glacier/Crème, 25 % Bisque, 10 % Espresso, 5 % Chambray.
- Mode sombre : fond Espresso, texte Crème, cartes en Espresso éclairci (`#4A2E23`), accent Chambray inchangé.

---

## 3. Typographie

| Usage | Police | Style |
|---|---|---|
| Wordmark, titres, citations | **Cormorant Garamond** | Italique, graisse 500 |
| Interface, corps, boutons | **Inter** | 400 régulier / 500 medium |
| Chiffres, hex, métadonnées | Inter | 400, lettrage espacé (+1 à +3 px) |

**Règles.** Le serif italique est réservé à la « voix du livre » (citations, titres d'œuvres, wordmark). Tout ce qui est interface reste en Inter. Jamais de gras au-delà de 500. Casse de phrase partout, jamais de Title Case.

---

## 4. Logo

**Wordmark principal.** « Manent » en Cormorant Garamond italique Espresso, souligné d'un trait Chambray, baseline *verba volant, scripta manent* en Clay.

**Monogramme.** « M » italique dans un carré arrondi (rayon ≈ 22 % du côté), suivi d'un point Chambray — le point final de la phrase qu'on retient. Trois déclinaisons : fond Espresso (icône app par défaut), fond Chambray, fond Glacier.

**Lockup horizontal.** Monogramme + wordmark, pour en-têtes web et partenariats.

**Zone de protection.** Espace libre minimal autour du logo = hauteur du « M ». Taille minimale du monogramme : 24 px.

**Interdits.** Ne pas incliner, étirer, ombrer, dégrader, recolorer hors palette, ni poser sur photo chargée sans aplat.

---

## 5. Iconographie et imagerie

- Icônes en trait fin (1,5 px), coins arrondis, style outline — jamais de remplissage plein sauf état actif (Chambray).
- Photographie : lumière naturelle, papier, mains, bibliothèques, tons chauds désaturés cohérents avec Bisque/Clay. Jamais de stock photo criard.
- Illustrations éventuelles : formes organiques simples aux couleurs de la palette, texture papier subtile.

## 6. Composants signature

**Quote card.** Fond Bisque, guillemet ouvrant Chambray oversize, citation en Cormorant italique Espresso, source en capitales espacées Clay, filet séparateur, signature « Manent » + handle du lecteur. Filigrane retiré en Premium. Formats : 1080×1350 (feed), 1080×1920 (story).

**Tableau (board).** Grille 2 colonnes de cartes à coins arrondis 16 px, mélange de quote cards, couvertures et fiches.

**Fiche de lecture.** Carte Crème structurée : œuvre / auteur / thèmes (tags Clay) / résumé / citations liées / flashcards.

## 7. Ton de voix

- Tutoiement chaleureux, sans jargon tech ni anglicismes inutiles.
- Phrases courtes. Une pointe de littéraire, jamais pédant.
- Notifications : « Ta citation de Baldwin a été épinglée 12 fois » plutôt que « Vous avez de nouvelles interactions ».
- États vides = invitations : « Ton premier tableau t'attend » plutôt que « Aucun contenu ».

---

## 8. Prompt complet — application mobile Manent

À coller tel quel dans un outil de design ou de génération d'app (v0, Lovable, Figma AI, Claude…) :

```
Conçois une application mobile iOS/Android moderne nommée « Manent » — le
Pinterest des livres pour lecteurs francophones. Les utilisateurs
photographient des passages de livres papier (transcrits par IA), créent
des fiches de lecture et des flashcards, organisent le tout en tableaux
thématiques, partagent des quote cards élégantes et découvrent des livres
par leurs citations.

DIRECTION ARTISTIQUE
Ambiance : bibliothèque calme et lettrée, papier et encre, chaleur
éditoriale. Design épuré, généreux en espace blanc, zéro surcharge.
Inspiration : Pinterest pour la grille, Readwise pour la capture,
esthétique éditoriale à la Kinfolk.

COULEURS (strictes)
- Espresso #3A2119 : texte, icônes, mode sombre (jamais de noir pur)
- Glacier #D2E2EC : fond des écrans
- Bisque #EBCDB7 : cartes et quote cards (effet papier)
- Chambray #79A3C3 : accent UNIQUE — bouton principal, liens, états actifs
- Clay #957662 : tags, texte secondaire
- Crème #F5EDE4 : texte sur fonds Espresso
Un seul accent par écran. Coins arrondis 16 px sur les cartes, 12 px sur
les boutons.

TYPOGRAPHIE
- Cormorant Garamond italique (500) : titres, citations, noms d'œuvres
- Inter (400/500) : interface, corps, boutons
Casse de phrase partout. Métadonnées en capitales espacées 11-12 px.

ÉCRANS À CONCEVOIR
1. Onboarding (3 slides) : capture photo → tableaux → quote cards, avec
   la baseline « verba volant, scripta manent »
2. Accueil / fil de découverte : grille masonry 2 colonnes mêlant quote
   cards Bisque, couvertures et fiches ; barre de recherche « Cherche une
   idée, un thème, une citation… »
3. Capture : viseur photo plein écran, cadre de recadrage du passage,
   puis écran de transcription IA éditable avec champs livre/page/tags
4. Quote card : éditeur de carte partageable (fond Bisque, guillemet
   Chambray, citation en serif italique, signature Manent + @handle),
   boutons partage WhatsApp/Instagram
5. Tableau : vue d'un board thématique avec en-tête, compteur d'épingles,
   contributeurs (clubs de lecture)
6. Fiche de lecture : structure œuvre/auteur/thèmes/résumé/citations/
   flashcards, bouton « Réviser » lançant les flashcards (mode bac)
7. Profil lecteur : avatar, stats de lecture, tableaux publics, badge
   créateur
8. Paywall Premium 3,99 €/mois : captures illimitées, export PDF, cartes
   sans filigrane — présenté sobrement sur carte Bisque

COMPOSANTS
Tab bar 5 entrées (Accueil, Recherche, bouton central Capture surélevé en
cercle Chambray, Tableaux, Profil), icônes outline 1,5 px. Boutons
principaux pleins Chambray texte Crème ; secondaires contour Clay. États
vides illustrés et chaleureux, ton tutoiement (« Ton premier tableau
t'attend »).

MODE SOMBRE
Fond Espresso, cartes #4A2E23, texte Crème, accent Chambray inchangé.

À ÉVITER
Dégradés criards, néons, ombres lourdes, Title Case, emojis dans l'UI,
plus d'un accent coloré par écran.
```

---

## 9. Checklist de lancement

- [ ] Domaine : manent.app (prioritaire), manent.io, négociation manent.fr via Dovendi
- [ ] Handles : @manent.app (Instagram, TikTok), Manent (App Store / Play Store)
- [ ] Marque : recherche d'antériorité puis dépôt INPI + EUIPO, classes 9, 41, 42
- [ ] Licences typo : Cormorant Garamond et Inter (SIL Open Font License — gratuites, usage commercial autorisé)
