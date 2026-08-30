# Système de design — Manent

Toute décision visuelle vit dans `src/theme`. Un écran qui écrit une couleur ou
une police en dur est un bug.

## Palette

| Jeton | Valeur | Usage |
| ----- | ------ | ----- |
| `paper` | `#F5F4EF` | fond général, papier froid |
| `card` | `#FFFFFF` | surfaces de cartes |
| `ink` | `#1F2430` | texte principal, fond de la quote card « Encre » |
| `inkSoft` | `#5A6072` | texte secondaire |
| `rule` | `#E3E1D8` | filets, séparateurs, contours |
| `green` | `#275C4B` | accent principal : boutons, filet de la fiche-citation |
| `greenPale` | `#E4EDE7` | fonds verts, badges |
| `amber` | `#C9973B` | numéros de page, étoiles, surlignages |
| `amberPale` | `#F6EBD6` | fonds ambre |
| `brick` | `#A8422F` | actions destructives |
| `wattpad` | `#E96C10` | tout ce qui vient de Wattpad |
| `study` | `#3E5C76` | mode études |

Les trois fonds de quote card — Encre, Papier, Forêt — sont définis une seule fois
dans `quoteCardStyles`, et servent à la fois l'aperçu et l'image exportée.

## Typographie

**Fraunces** pour ce qui se lit lentement : titres, citations, grands chiffres
(SemiBold, Black, Italic). **Public Sans** pour l'interface (Regular, Medium, Bold).
Les variantes sont nommées dans `type` : `display`, `title`, `sectionTitle`,
`quote`, `body`, `label`, `overline`, `pageNumber`. Le composant `Text` n'accepte
que ces variantes — c'est ce qui garantit la cohérence.

## Formes

Rayons 12–14 px sur les cartes et boutons, 20 px sur les feuilles modales,
pleine pilule sur les chips. Boutons pleins verts pour l'action principale,
contour vert pour l'action secondaire, **pointillés verts pour tout ce qui ajoute**
(nouveau tableau, capturer une citation, ajouter un livre).

## La fiche-citation

`QuoteSheet` est la brique identitaire, réutilisée dans le fil, la recherche, la
page thème, les fiches livre, les tableaux et les clubs :

- filet vertical de 4 px, vert — orange si la citation vient de Wattpad ;
- citation en Fraunces SemiBold ;
- titre et auteur en petit, gris encre ;
- à droite, le repère : `PAGE` en ambre, ou `CHAP.` en orange, surmontant le
  numéro en Fraunces Black.

Le même repère se retrouve, agrandi, sur l'écran de détail et sur la quote card
exportée. C'est ce qui rend une image Manent reconnaissable dans un fil Instagram.

## Accessibilité

Chaque élément interactif porte un `accessibilityRole` et, quand le libellé visible
ne suffit pas, un `accessibilityLabel` explicite. Les barres de progression
exposent `accessibilityValue`. Les cibles tactiles font au moins 44 px de haut.
