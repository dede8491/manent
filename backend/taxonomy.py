"""Référentiel de classification Manent — données uniquement, extensible sans toucher au code.

Un livre appartient à plusieurs univers à la fois : origine (continent → région → pays),
type (famille → sous-type), domaines, thèmes, émotions, ambiances, public, langue.
Chaque dimension est une liste de {key, label, …}. Ajouter une entrée ici suffit :
les filtres, la recherche, l'IA et l'admin lisent ce module.
"""
from __future__ import annotations
import re
import unicodedata

# ---------------------------------------------------------------- Utilitaires
def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- Géographie
# continent → régions → pays (ISO 3166-1 alpha-2, plus MQ/GP/GF/RE/YT/NC/PF traités comme pays d'origine)
GEO: list[dict] = [
    {"key": "afrique", "label": "Afrique", "emoji": "🌍", "regions": [
        {"key": "afrique-ouest", "label": "Afrique de l'Ouest", "countries": "SN CI GH NG ML GN BF BJ TG NE MR CV GM SL LR GW"},
        {"key": "afrique-centrale", "label": "Afrique centrale", "countries": "GA CM CG CD TD CF GQ ST AO"},
        {"key": "afrique-est", "label": "Afrique de l'Est", "countries": "KE TZ UG RW BI ET ER DJ SO SS SD MG MU KM SC"},
        {"key": "afrique-nord", "label": "Afrique du Nord", "countries": "MA DZ TN LY EG EH"},
        {"key": "afrique-australe", "label": "Afrique australe", "countries": "ZA NA BW ZW ZM MZ MW LS SZ RE YT"},
    ]},
    {"key": "ameriques", "label": "Amériques", "emoji": "🌎", "regions": [
        {"key": "amerique-nord", "label": "Amérique du Nord", "countries": "US CA MX GL PM BM"},
        {"key": "amerique-centrale", "label": "Amérique centrale", "countries": "GT BZ HN SV NI CR PA"},
        {"key": "caraibes", "label": "Caraïbes", "countries": "HT MQ GP GF CU DO JM TT BB BS LC VC GD DM AG KN PR AW CW SX BL MF KY VG VI TC AI MS"},
        {"key": "amerique-sud", "label": "Amérique du Sud", "countries": "BR AR CL CO PE VE EC BO PY UY GY SR FK"},
    ]},
    {"key": "europe", "label": "Europe", "emoji": "🌍", "regions": [
        {"key": "europe-ouest", "label": "Europe de l'Ouest", "countries": "FR BE CH LU NL DE AT MC LI IE GB IM JE GG"},
        {"key": "europe-nord", "label": "Europe du Nord", "countries": "SE NO DK FI IS EE LV LT FO AX"},
        {"key": "europe-sud", "label": "Europe du Sud", "countries": "IT ES PT GR MT CY SM VA AD GI HR SI BA ME MK AL RS XK"},
        {"key": "europe-est", "label": "Europe de l'Est", "countries": "PL CZ SK HU RO BG UA BY MD RU"},
    ]},
    {"key": "asie", "label": "Asie", "emoji": "🌏", "regions": [
        {"key": "asie-est", "label": "Asie de l'Est", "countries": "CN JP KR KP TW MN HK MO"},
        {"key": "asie-sud", "label": "Asie du Sud", "countries": "IN PK BD LK NP BT MV AF"},
        {"key": "asie-sud-est", "label": "Asie du Sud-Est", "countries": "VN TH ID MY SG PH KH LA MM BN TL"},
        {"key": "moyen-orient", "label": "Moyen-Orient", "countries": "LB SY IQ IR IL PS JO SA AE QA KW BH OM YE TR"},
        {"key": "asie-centrale", "label": "Asie centrale", "countries": "KZ UZ KG TJ TM AM AZ GE"},
    ]},
    {"key": "oceanie", "label": "Océanie", "emoji": "🌏", "regions": [
        {"key": "oceanie", "label": "Océanie", "countries": "AU NZ PG FJ NC PF WS TO VU SB KI FM MH NR PW TV WF CK NU TK"},
    ]},
    {"key": "international", "label": "International", "emoji": "🌐", "regions": [
        {"key": "international", "label": "International / transcontinental", "countries": ""},
    ]},
]

COUNTRY_FR: dict[str, str] = {
    "SN": "Sénégal", "CI": "Côte d'Ivoire", "GH": "Ghana", "NG": "Nigeria", "ML": "Mali", "GN": "Guinée", "BF": "Burkina Faso",
    "BJ": "Bénin", "TG": "Togo", "NE": "Niger", "MR": "Mauritanie", "CV": "Cap-Vert", "GM": "Gambie", "SL": "Sierra Leone",
    "LR": "Liberia", "GW": "Guinée-Bissau", "GA": "Gabon", "CM": "Cameroun", "CG": "Congo", "CD": "RD Congo", "TD": "Tchad",
    "CF": "Centrafrique", "GQ": "Guinée équatoriale", "ST": "Sao Tomé-et-Principe", "AO": "Angola", "KE": "Kenya",
    "TZ": "Tanzanie", "UG": "Ouganda", "RW": "Rwanda", "BI": "Burundi", "ET": "Éthiopie", "ER": "Érythrée", "DJ": "Djibouti",
    "SO": "Somalie", "SS": "Soudan du Sud", "SD": "Soudan", "MG": "Madagascar", "MU": "Maurice", "KM": "Comores",
    "SC": "Seychelles", "MA": "Maroc", "DZ": "Algérie", "TN": "Tunisie", "LY": "Libye", "EG": "Égypte", "EH": "Sahara occidental",
    "ZA": "Afrique du Sud", "NA": "Namibie", "BW": "Botswana", "ZW": "Zimbabwe", "ZM": "Zambie", "MZ": "Mozambique",
    "MW": "Malawi", "LS": "Lesotho", "SZ": "Eswatini", "RE": "La Réunion", "YT": "Mayotte",
    "US": "États-Unis", "CA": "Canada", "MX": "Mexique", "GL": "Groenland", "PM": "Saint-Pierre-et-Miquelon", "BM": "Bermudes",
    "GT": "Guatemala", "BZ": "Belize", "HN": "Honduras", "SV": "Salvador", "NI": "Nicaragua", "CR": "Costa Rica", "PA": "Panama",
    "HT": "Haïti", "MQ": "Martinique", "GP": "Guadeloupe", "GF": "Guyane", "CU": "Cuba", "DO": "République dominicaine",
    "JM": "Jamaïque", "TT": "Trinité-et-Tobago", "BB": "Barbade", "BS": "Bahamas", "LC": "Sainte-Lucie", "VC": "Saint-Vincent",
    "GD": "Grenade", "DM": "Dominique", "AG": "Antigua", "KN": "Saint-Kitts", "PR": "Porto Rico", "AW": "Aruba", "CW": "Curaçao",
    "BR": "Brésil", "AR": "Argentine", "CL": "Chili", "CO": "Colombie", "PE": "Pérou", "VE": "Venezuela", "EC": "Équateur",
    "BO": "Bolivie", "PY": "Paraguay", "UY": "Uruguay", "GY": "Guyana", "SR": "Suriname",
    "FR": "France", "BE": "Belgique", "CH": "Suisse", "LU": "Luxembourg", "NL": "Pays-Bas", "DE": "Allemagne", "AT": "Autriche",
    "MC": "Monaco", "LI": "Liechtenstein", "IE": "Irlande", "GB": "Royaume-Uni", "SE": "Suède", "NO": "Norvège", "DK": "Danemark",
    "FI": "Finlande", "IS": "Islande", "EE": "Estonie", "LV": "Lettonie", "LT": "Lituanie", "IT": "Italie", "ES": "Espagne",
    "PT": "Portugal", "GR": "Grèce", "MT": "Malte", "CY": "Chypre", "HR": "Croatie", "SI": "Slovénie", "BA": "Bosnie-Herzégovine",
    "ME": "Monténégro", "MK": "Macédoine du Nord", "AL": "Albanie", "RS": "Serbie", "XK": "Kosovo", "PL": "Pologne", "CZ": "Tchéquie",
    "SK": "Slovaquie", "HU": "Hongrie", "RO": "Roumanie", "BG": "Bulgarie", "UA": "Ukraine", "BY": "Biélorussie", "MD": "Moldavie",
    "RU": "Russie", "CN": "Chine", "JP": "Japon", "KR": "Corée du Sud", "KP": "Corée du Nord", "TW": "Taïwan", "MN": "Mongolie",
    "HK": "Hong Kong", "IN": "Inde", "PK": "Pakistan", "BD": "Bangladesh", "LK": "Sri Lanka", "NP": "Népal", "BT": "Bhoutan",
    "MV": "Maldives", "AF": "Afghanistan", "VN": "Vietnam", "TH": "Thaïlande", "ID": "Indonésie", "MY": "Malaisie",
    "SG": "Singapour", "PH": "Philippines", "KH": "Cambodge", "LA": "Laos", "MM": "Birmanie", "LB": "Liban", "SY": "Syrie",
    "IQ": "Irak", "IR": "Iran", "IL": "Israël", "PS": "Palestine", "JO": "Jordanie", "SA": "Arabie saoudite",
    "AE": "Émirats arabes unis", "QA": "Qatar", "KW": "Koweït", "BH": "Bahreïn", "OM": "Oman", "YE": "Yémen", "TR": "Turquie",
    "KZ": "Kazakhstan", "UZ": "Ouzbékistan", "KG": "Kirghizistan", "TJ": "Tadjikistan", "TM": "Turkménistan", "AM": "Arménie",
    "AZ": "Azerbaïdjan", "GE": "Géorgie", "AU": "Australie", "NZ": "Nouvelle-Zélande", "PG": "Papouasie-Nouvelle-Guinée",
    "FJ": "Fidji", "NC": "Nouvelle-Calédonie", "PF": "Polynésie française", "WS": "Samoa", "TO": "Tonga", "VU": "Vanuatu",
}

COUNTRY_TO_REGION: dict[str, str] = {}
REGION_TO_CONTINENT: dict[str, str] = {}
REGION_LABEL: dict[str, str] = {}
CONTINENT_LABEL: dict[str, str] = {c["key"]: c["label"] for c in GEO}
for _c in GEO:
    for _r in _c["regions"]:
        REGION_TO_CONTINENT[_r["key"]] = _c["key"]
        REGION_LABEL[_r["key"]] = _r["label"]
        for _iso in _r["countries"].split():
            COUNTRY_TO_REGION[_iso] = _r["key"]


def geo_for_country(iso: str) -> dict:
    """{'continent','region'} pour un code pays, ou {} si inconnu."""
    r = COUNTRY_TO_REGION.get((iso or "").upper())
    return {"continent": REGION_TO_CONTINENT[r], "region": r} if r else {}


# ---------------------------------------------------------------- Types de livre (famille → sous-types)
TYPES: list[dict] = [
    {"key": "fiction", "label": "Fiction", "emoji": "📖", "subtypes": [
        ("roman", "Roman"), ("nouvelle", "Nouvelle"), ("recueil-nouvelles", "Recueil de nouvelles"), ("poesie", "Poésie"),
        ("theatre", "Théâtre"), ("conte", "Conte"), ("fable", "Fable"), ("bande-dessinee", "Bande dessinée"),
        ("manga", "Manga"), ("graphic-novel", "Graphic novel"), ("jeunesse", "Littérature jeunesse"),
    ]},
    {"key": "nonfiction", "label": "Non-fiction", "emoji": "📚", "subtypes": [
        ("essai", "Essai"), ("biographie", "Biographie"), ("autobiographie", "Autobiographie"), ("memoires", "Mémoires"),
        ("temoignage", "Témoignage"), ("documentaire", "Documentaire"), ("reportage", "Reportage"),
        ("developpement-personnel", "Développement personnel"), ("philosophie", "Philosophie"), ("psychologie", "Psychologie"),
        ("sciences", "Sciences"), ("histoire", "Histoire"), ("geographie", "Géographie"), ("politique", "Politique"),
        ("economie", "Économie"), ("sociologie", "Sociologie"),
    ]},
    {"key": "apprentissage", "label": "Enseignement / apprentissage", "emoji": "🎓", "subtypes": [
        ("manuel-scolaire", "Manuel scolaire"), ("manuel-universitaire", "Manuel universitaire"), ("cours", "Cours"),
        ("guide-pratique", "Guide pratique"), ("preparation-examens", "Préparation aux examens"), ("methodologie", "Méthodologie"),
        ("langues", "Langues"), ("formation-pro", "Formation professionnelle"), ("informatique", "Informatique"),
        ("droit", "Droit"), ("medecine", "Médecine"), ("finance", "Finance"), ("management", "Management"),
    ]},
    {"key": "religion", "label": "Religion / spiritualité", "emoji": "✨", "subtypes": [
        ("christianisme", "Christianisme"), ("islam", "Islam"), ("judaisme", "Judaïsme"), ("bouddhisme", "Bouddhisme"),
        ("hindouisme", "Hindouisme"), ("spiritualite", "Spiritualité"), ("theologie", "Théologie"),
        ("philosophie-spirituelle", "Philosophie spirituelle"), ("meditation", "Méditation"),
        ("developpement-spirituel", "Développement spirituel"),
    ]},
    {"key": "pratique", "label": "Pratique / loisirs", "emoji": "🧭", "subtypes": [
        ("cuisine", "Cuisine"), ("patisserie", "Pâtisserie"), ("voyage", "Voyage"), ("jardinage", "Jardinage"),
        ("bricolage", "Bricolage"), ("mode", "Mode"), ("art", "Art"), ("photographie", "Photographie"), ("sport", "Sport"),
        ("fitness", "Fitness"), ("loisirs-creatifs", "Loisirs créatifs"),
    ]},
]
SUBTYPE_TO_FAMILY: dict[str, str] = {k: f["key"] for f in TYPES for k, _ in f["subtypes"]}
SUBTYPE_LABEL: dict[str, str] = {k: lbl for f in TYPES for k, lbl in f["subtypes"]}
FAMILY_LABEL: dict[str, str] = {f["key"]: f["label"] for f in TYPES}
# Genres de fiction (précision facultative sous « roman »)
GENRES: list[tuple[str, str]] = [
    ("contemporain", "Fiction contemporaine"), ("polar", "Polar et thriller"), ("imaginaire", "Imaginaire"),
    ("romance", "Romance"), ("historique", "Roman historique"), ("classique", "Classique"), ("feel-good", "Feel-good"),
    ("dystopie", "Dystopie"), ("aventure", "Aventure"), ("humour", "Humour"),
]

# ---------------------------------------------------------------- Domaines (extensibles)
DOMAINS: list[dict] = [
    {"key": "litterature", "label": "Littérature", "emoji": "📚", "items": [("litterature", "Littérature")]},
    {"key": "business", "label": "Business", "emoji": "💼", "items": [
        ("entrepreneuriat", "Entrepreneuriat"), ("marketing", "Marketing"), ("management", "Management"), ("finance", "Finance"),
        ("investissement", "Investissement"), ("immobilier", "Immobilier"), ("leadership", "Leadership")]},
    {"key": "sciences", "label": "Sciences", "emoji": "🔬", "items": [
        ("medecine", "Médecine"), ("biologie", "Biologie"), ("physique", "Physique"), ("chimie", "Chimie"),
        ("astronomie", "Astronomie"), ("technologie", "Technologie")]},
    {"key": "vie-personnelle", "label": "Vie personnelle", "emoji": "🌱", "items": [
        ("developpement-personnel", "Développement personnel"), ("confiance-en-soi", "Confiance en soi"), ("relations", "Relations"),
        ("parentalite", "Parentalité"), ("carriere", "Carrière"), ("bien-etre", "Bien-être")]},
    {"key": "societe", "label": "Société", "emoji": "🌍", "items": [
        ("feminisme", "Féminisme"), ("racisme", "Racisme"), ("immigration", "Immigration"), ("identite", "Identité"),
        ("culture", "Culture"), ("politique", "Politique"), ("justice", "Justice"), ("education", "Éducation")]},
    {"key": "spiritualite", "label": "Spiritualité", "emoji": "✨", "items": [("spiritualite", "Spiritualité"), ("religion", "Religion")]},
    {"key": "arts-loisirs", "label": "Arts et loisirs", "emoji": "🎨", "items": [
        ("cuisine", "Cuisine"), ("voyage", "Voyage"), ("art", "Art"), ("sport", "Sport"), ("musique", "Musique")]},
]
DOMAIN_LABEL: dict[str, str] = {k: lbl for g in DOMAINS for k, lbl in g["items"]}

# ---------------------------------------------------------------- Thèmes (transversaux)
THEMES: list[dict] = [
    {"key": "amour-relations", "label": "Amour & relations", "emoji": "❤️", "items": [
        ("amour", "Amour"), ("premier-amour", "Premier amour"), ("rupture", "Rupture"), ("infidelite", "Infidélité"), ("couple", "Couple"),
        ("mariage", "Mariage"), ("amitie", "Amitié"), ("relations-toxiques", "Relations toxiques"), ("desir", "Désir"),
        ("passion", "Passion"), ("solitude", "Solitude")]},
    {"key": "deuil-perte", "label": "Deuil & perte", "emoji": "🖤", "items": [
        ("deuil", "Deuil"), ("mort", "Mort"), ("perte-proche", "Perte d'un proche"), ("maladie", "Maladie"), ("separation", "Séparation"),
        ("reconstruction", "Reconstruction"), ("acceptation", "Acceptation"), ("resilience", "Résilience")]},
    {"key": "developpement", "label": "Développement personnel", "emoji": "🌱", "items": [
        ("confiance-en-soi", "Confiance en soi"), ("estime-de-soi", "Estime de soi"), ("guerison", "Guérison"), ("motivation", "Motivation"),
        ("discipline", "Discipline"), ("reussite", "Réussite"), ("changement", "Changement"), ("identite", "Identité"),
        ("recherche-de-soi", "Recherche de soi")]},
    {"key": "famille", "label": "Famille", "emoji": "👨‍👩‍👧", "items": [
        ("famille", "Famille"), ("maternite", "Maternité"), ("paternite", "Paternité"), ("enfance", "Enfance"), ("fratrie", "Fratrie"),
        ("parents-enfants", "Relations parents-enfants"), ("heritage-familial", "Héritage familial"), ("secrets-de-famille", "Secrets de famille"),
        ("transmission", "Transmission")]},
    {"key": "psychologie", "label": "Psychologie", "emoji": "🧠", "items": [
        ("trauma", "Trauma"), ("anxiete", "Anxiété"), ("memoire", "Mémoire"), ("manipulation", "Manipulation"), ("narcissisme", "Narcissisme"),
        ("attachement", "Attachement"), ("intelligence-emotionnelle", "Intelligence émotionnelle")]},
    {"key": "identite-societe", "label": "Identité & société", "emoji": "🌍", "items": [
        ("racines", "Racines"), ("immigration", "Immigration"), ("diaspora", "Diaspora"), ("colonialisme", "Colonialisme"), ("culture", "Culture"),
        ("racisme", "Racisme"), ("feminisme", "Féminisme"), ("condition-feminine", "Condition féminine"), ("classes-sociales", "Classes sociales")]},
    {"key": "spiritualite", "label": "Spiritualité", "emoji": "✨", "items": [
        ("foi", "Foi"), ("dieu", "Dieu"), ("priere", "Prière"), ("spiritualite", "Spiritualité"), ("religion", "Religion"),
        ("questionnement-existentiel", "Questionnement existentiel"), ("meditation", "Méditation"), ("eveil", "Éveil")]},
    {"key": "autres", "label": "Autres", "emoji": "🔥", "items": [
        ("ambition", "Ambition"), ("pouvoir", "Pouvoir"), ("argent", "Argent"), ("vengeance", "Vengeance"), ("justice", "Justice"),
        ("liberte", "Liberté"), ("guerre", "Guerre"), ("paix", "Paix"), ("voyage", "Voyage"), ("aventure", "Aventure"), ("mystere", "Mystère"),
        ("survie", "Survie"), ("courage", "Courage"), ("sacrifice", "Sacrifice"), ("trahison", "Trahison"), ("secrets", "Secrets"),
        ("grossesse", "Grossesse"), ("parentalite", "Parentalité"), ("sexualite", "Sexualité"), ("vieillissement", "Vieillissement"),
        ("mortalite", "Mortalité"), ("entrepreneuriat", "Entrepreneuriat"), ("leadership", "Leadership"), ("sante", "Santé"),
        ("finance", "Finances personnelles")]},
]
THEME_LABEL: dict[str, str] = {k: lbl for g in THEMES for k, lbl in g["items"]}
THEME_EMOJI: dict[str, str] = {k: g["emoji"] for g in THEMES for k, _ in g["items"]}
POPULAR_THEMES = ["amour", "deuil", "famille", "reconstruction", "resilience", "confiance-en-soi", "spiritualite", "ambition", "identite", "justice"]

# ---------------------------------------------------------------- Émotions et ambiances (distinctes des thèmes)
EMOTIONS: list[tuple[str, str, str]] = [
    ("emouvant", "Émouvant", "🥹"), ("tristesse", "Tristesse", "😢"), ("joie", "Joie", "😊"), ("espoir", "Espoir", "🌱"),
    ("nostalgie", "Nostalgie", "🍂"), ("melancolie", "Mélancolie", "🌧️"), ("amour", "Amour", "❤️"), ("colere", "Colère", "😠"),
    ("peur", "Peur", "😨"), ("surprise", "Surprise", "😮"), ("reconfort", "Réconfort", "😌"), ("inspiration", "Inspiration", "✨"),
    ("empathie", "Empathie", "🤝"), ("serenite", "Sérénité", "🕊️"), ("motivation", "Motivation", "🔥"), ("reflexion", "Réflexion", "🤔"),
    ("rire", "Rire", "😂"), ("apaisement", "Apaisement", "🌿"),
]
MOODS: list[tuple[str, str, str]] = [
    ("joyeux", "Joyeux", "😊"), ("drole", "Drôle", "😂"), ("leger", "Léger", "☀️"), ("reconfortant", "Réconfortant", "😌"),
    ("romantique", "Romantique", "🌹"), ("emouvant", "Émouvant", "🥹"), ("melancolique", "Mélancolique", "🌙"), ("sombre", "Sombre", "🌑"),
    ("anxiogene", "Anxiogène", "😰"), ("inspirant", "Inspirant", "✨"), ("philosophique", "Philosophique", "💭"), ("poetique", "Poétique", "🪶"),
    ("mysterieux", "Mystérieux", "🕵️"), ("intense", "Intense", "🔥"), ("sensuel", "Sensuel", "💋"), ("epique", "Épique", "🏔️"),
    ("relaxant", "Relaxant", "🧘"),
]
EMOTION_LABEL = {k: l for k, l, _ in EMOTIONS}
EMOTION_EMOJI = {k: e for k, _, e in EMOTIONS}
MOOD_LABEL = {k: l for k, l, _ in MOODS}
MOOD_EMOJI = {k: e for k, _, e in MOODS}

# ---------------------------------------------------------------- Public et langues
AUDIENCES: list[tuple[str, str]] = [
    ("enfants", "Enfants"), ("0-3", "0–3 ans"), ("3-6", "3–6 ans"), ("6-9", "6–9 ans"), ("9-12", "9–12 ans"),
    ("adolescents", "Adolescents"), ("jeunes-adultes", "Jeunes adultes"), ("adultes", "Adultes"), ("seniors", "Seniors"),
    ("professionnels", "Professionnels"), ("universitaires", "Universitaires"),
]
LEVELS: list[tuple[str, str]] = [("debutant", "Débutant"), ("intermediaire", "Intermédiaire"), ("avance", "Avancé"), ("expert", "Expert")]
AUDIENCE_LABEL = {k: l for k, l in AUDIENCES}
LANGUAGES: list[tuple[str, str]] = [
    ("fr", "Français"), ("en", "Anglais"), ("es", "Espagnol"), ("pt", "Portugais"), ("ar", "Arabe"), ("de", "Allemand"),
    ("it", "Italien"), ("wo", "Wolof"), ("sw", "Swahili"), ("ja", "Japonais"), ("zh", "Chinois"), ("ru", "Russe"),
]
LANGUAGE_LABEL = {k: l for k, l in LANGUAGES}

# ---------------------------------------------------------------- Règles (repli sans IA) : catégories sources → étiquettes
# Chaque entrée : marqueur (normalisé) → liste d'étiquettes « dimension:clé »
RULES: list[tuple[str, list[str]]] = [
    ("manga", ["type:manga"]), ("bande dessinee", ["type:bande-dessinee"]), ("comics", ["type:bande-dessinee"]),
    ("graphic novel", ["type:graphic-novel"]), ("juvenile", ["type:jeunesse", "audience:enfants"]), ("jeunesse", ["type:jeunesse"]),
    ("young adult", ["audience:jeunes-adultes"]), ("children", ["audience:enfants", "type:jeunesse"]),
    ("poetry", ["type:poesie"]), ("poesie", ["type:poesie"]), ("theatre", ["type:theatre"]), ("drama", ["type:theatre"]),
    ("short stories", ["type:recueil-nouvelles"]), ("nouvelles", ["type:recueil-nouvelles"]), ("contes", ["type:conte"]), ("tales", ["type:conte"]),
    ("thriller", ["type:roman", "genre:polar", "mood:intense", "mood:mysterieux"]), ("mystery", ["type:roman", "genre:polar", "mood:mysterieux"]),
    ("detective", ["type:roman", "genre:polar"]), ("policier", ["type:roman", "genre:polar"]), ("crime", ["type:roman", "genre:polar"]),
    ("fantasy", ["type:roman", "genre:imaginaire", "mood:epique"]), ("science fiction", ["type:roman", "genre:imaginaire"]),
    ("science-fiction", ["type:roman", "genre:imaginaire"]), ("fantastique", ["type:roman", "genre:imaginaire"]),
    ("horror", ["type:roman", "genre:imaginaire", "mood:sombre", "emotion:peur"]), ("dystopi", ["type:roman", "genre:dystopie", "mood:sombre"]),
    ("romance", ["type:roman", "genre:romance", "theme:amour", "mood:romantique"]), ("love stories", ["type:roman", "theme:amour", "mood:romantique"]),
    ("historical fiction", ["type:roman", "genre:historique"]), ("roman historique", ["type:roman", "genre:historique"]),
    ("classics", ["type:roman", "genre:classique"]), ("literary", ["type:roman", "domain:litterature"]),
    ("fiction", ["type:roman", "domain:litterature"]), ("roman", ["type:roman", "domain:litterature"]), ("novel", ["type:roman", "domain:litterature"]),
    ("litterature", ["domain:litterature"]), ("literature", ["domain:litterature"]),
    ("biography", ["type:biographie"]), ("biographie", ["type:biographie"]), ("autobiography", ["type:autobiographie"]),
    ("memoir", ["type:memoires"]), ("memoires", ["type:memoires"]), ("temoignage", ["type:temoignage"]),
    ("essay", ["type:essai"]), ("essai", ["type:essai"]), ("philosophy", ["type:philosophie", "mood:philosophique"]), ("philosophie", ["type:philosophie", "mood:philosophique"]),
    ("psychology", ["type:psychologie", "domain:developpement-personnel"]), ("psychologie", ["type:psychologie"]),
    ("self-help", ["type:developpement-personnel", "domain:developpement-personnel", "mood:inspirant"]),
    ("self help", ["type:developpement-personnel", "domain:developpement-personnel"]),
    ("developpement personnel", ["type:developpement-personnel", "domain:developpement-personnel", "mood:inspirant"]),
    ("history", ["type:histoire"]), ("histoire", ["type:histoire"]), ("politics", ["type:politique", "domain:politique"]), ("political science", ["type:politique", "domain:politique"]),
    ("economics", ["type:economie"]), ("sociology", ["type:sociologie"]), ("social science", ["type:sociologie"]),
    ("science", ["type:sciences"]), ("medical", ["type:medecine", "domain:medecine"]), ("medicine", ["type:medecine", "domain:medecine"]),
    ("business", ["domain:entrepreneuriat", "type:guide-pratique"]), ("entrepreneurship", ["domain:entrepreneuriat", "theme:entrepreneuriat"]),
    ("management", ["domain:management", "type:management"]), ("leadership", ["domain:leadership", "theme:leadership"]),
    ("marketing", ["domain:marketing"]), ("finance", ["domain:finance", "type:finance"]), ("personal finance", ["domain:finance", "theme:finance"]),
    ("investments", ["domain:investissement"]), ("real estate", ["domain:immobilier"]),
    ("computers", ["type:informatique", "domain:technologie"]), ("law", ["type:droit"]), ("droit", ["type:droit"]),
    ("study aids", ["type:preparation-examens"]), ("textbook", ["type:manuel-scolaire"]), ("manuel", ["type:manuel-scolaire"]),
    ("language arts", ["type:langues"]), ("foreign language", ["type:langues"]),
    ("christian", ["type:christianisme", "theme:foi"]), ("christianisme", ["type:christianisme", "theme:foi"]), ("bible", ["type:christianisme", "theme:foi"]),
    ("islam", ["type:islam", "theme:foi"]), ("judaism", ["type:judaisme"]), ("buddhism", ["type:bouddhisme"]), ("hinduism", ["type:hindouisme"]),
    ("religion", ["type:spiritualite", "domain:religion", "theme:religion"]), ("spirituality", ["type:spiritualite", "domain:spiritualite", "theme:spiritualite"]),
    ("spiritualite", ["type:spiritualite", "domain:spiritualite", "theme:spiritualite"]), ("meditation", ["type:meditation", "theme:meditation", "mood:relaxant"]),
    ("theology", ["type:theologie"]),
    ("cooking", ["type:cuisine", "domain:cuisine"]), ("cuisine", ["type:cuisine", "domain:cuisine"]), ("baking", ["type:patisserie", "domain:cuisine"]),
    ("travel", ["type:voyage", "domain:voyage", "theme:voyage"]), ("voyage", ["type:voyage", "domain:voyage", "theme:voyage"]),
    ("gardening", ["type:jardinage"]), ("crafts", ["type:loisirs-creatifs"]), ("photography", ["type:photographie", "domain:art"]),
    ("art", ["type:art", "domain:art"]), ("sports", ["type:sport", "domain:sport"]), ("fitness", ["type:fitness", "domain:bien-etre"]),
    ("health", ["domain:bien-etre", "theme:sante"]), ("sante", ["domain:bien-etre", "theme:sante"]), ("family", ["theme:famille"]),
    ("grief", ["theme:deuil", "emotion:tristesse"]), ("deuil", ["theme:deuil", "emotion:tristesse"]), ("bereavement", ["theme:deuil"]),
    ("resilience", ["theme:resilience", "emotion:espoir"]), ("confiance en soi", ["theme:confiance-en-soi"]), ("self-esteem", ["theme:estime-de-soi"]),
    ("feminism", ["theme:feminisme", "domain:feminisme"]), ("feminisme", ["theme:feminisme"]), ("immigration", ["theme:immigration", "domain:immigration"]),
    ("racism", ["theme:racisme", "domain:racisme"]), ("colonial", ["theme:colonialisme"]), ("war", ["theme:guerre"]), ("guerre", ["theme:guerre"]),
    ("friendship", ["theme:amitie"]), ("motherhood", ["theme:maternite"]), ("childhood", ["theme:enfance"]), ("identity", ["theme:identite"]),
    ("humor", ["mood:drole", "emotion:rire"]), ("humour", ["mood:drole", "emotion:rire"]), ("adventure", ["theme:aventure", "mood:epique"]),
]

# Anciens sujets Manent (12) → thèmes / domaines
LEGACY_SUBJECTS: dict[str, list[str]] = {
    "résilience": ["theme:resilience", "emotion:espoir"], "finance": ["domain:finance", "theme:finance"],
    "amour": ["theme:amour"], "entrepreneuriat": ["domain:entrepreneuriat", "theme:entrepreneuriat"],
    "foi": ["theme:foi", "domain:spiritualite"], "leadership": ["domain:leadership", "theme:leadership"],
    "deuil": ["theme:deuil"], "confiance": ["theme:confiance-en-soi"], "famille": ["theme:famille"],
    "spiritualité": ["theme:spiritualite", "domain:spiritualite"], "santé": ["theme:sante", "domain:bien-etre"],
    "voyage": ["theme:voyage", "domain:voyage"],
}
# Anciens genres (8) → type / genre
LEGACY_GENRES: dict[str, list[str]] = {
    "litterature": ["type:roman", "domain:litterature"], "polar": ["type:roman", "genre:polar"],
    "imaginaire": ["type:roman", "genre:imaginaire"], "jeunesse": ["type:jeunesse", "audience:enfants"],
    "romance": ["type:roman", "genre:romance", "theme:amour"], "bd": ["type:bande-dessinee"], "manga": ["type:manga"],
    "nonfiction": ["type:essai"],
}


# ---------------------------------------------------------------- Accès uniforme
DIMENSIONS = ("type", "genre", "domain", "theme", "emotion", "mood", "audience")
# Dimensions géographiques : origine de l'AUTEUR (country/region/continent) et contexte de l'HISTOIRE (story_*)
GEO_DIMS = ("continent", "region", "country")
STORY_DIMS = ("story_continent", "story_region", "story_country")
LEVEL_LABEL = {k: l for k, l in LEVELS}
# Regroupements (pour l'admin et les pages de filtres) : clé → groupe
THEME_GROUP: dict[str, str] = {k: g["key"] for g in THEMES for k, _ in g["items"]}
DOMAIN_GROUP: dict[str, str] = {k: g["key"] for g in DOMAINS for k, _ in g["items"]}


GENRE_LABEL: dict[str, str] = dict(GENRES)


def label_for(dim: str, key: str) -> str:
    return {
        "type": lambda k: SUBTYPE_LABEL.get(k) or FAMILY_LABEL.get(k, k),
        "genre": lambda k: GENRE_LABEL.get(k, k),
        "domain": lambda k: DOMAIN_LABEL.get(k, k),
        "theme": lambda k: THEME_LABEL.get(k, k),
        "emotion": lambda k: EMOTION_LABEL.get(k, k),
        "mood": lambda k: MOOD_LABEL.get(k, k),
        "audience": lambda k: AUDIENCE_LABEL.get(k) or LEVEL_LABEL.get(k, k),
        "continent": lambda k: CONTINENT_LABEL.get(k, k),
        "region": lambda k: REGION_LABEL.get(k, k),
        "country": lambda k: COUNTRY_FR.get(k, k),
        "story_continent": lambda k: CONTINENT_LABEL.get(k, k),
        "story_region": lambda k: REGION_LABEL.get(k, k),
        "story_country": lambda k: COUNTRY_FR.get(k, k),
        "lang": lambda k: LANGUAGE_LABEL.get(k, k),
    }.get(dim, lambda k: k)(key)


def valid_keys(dim: str) -> set[str]:
    return {
        "type": set(SUBTYPE_LABEL) | set(FAMILY_LABEL),
        "genre": set(GENRE_LABEL),
        "domain": set(DOMAIN_LABEL),
        "theme": set(THEME_LABEL),
        "emotion": set(EMOTION_LABEL),
        "mood": set(MOOD_LABEL),
        "audience": set(AUDIENCE_LABEL) | set(LEVEL_LABEL),
        "continent": set(CONTINENT_LABEL),
        "region": set(REGION_LABEL),
        "country": set(COUNTRY_FR),
        "story_continent": set(CONTINENT_LABEL),
        "story_region": set(REGION_LABEL),
        "story_country": set(COUNTRY_FR),
        "lang": set(LANGUAGE_LABEL),
    }.get(dim, set())


# ---------------------------------------------------------------- Extension à chaud (taxonomie administrable)
# Les entrées ajoutées depuis l'administration sont stockées en base (`taxonomy_ext`) et ré-appliquées
# au démarrage via register(). Aucune modification de code n'est nécessaire pour un nouveau thème,
# pays, émotion… : filtres, IA, recherche et admin lisent ces structures.
EXTENDABLE = ("continent", "region", "country", "type", "genre", "domain", "theme", "emotion", "mood", "audience", "lang")


def register(dim: str, key: str, label: str, group: str | None = None, emoji: str | None = None, parent: str | None = None) -> bool:
    """Ajoute une entrée au référentiel en mémoire. Retourne False si la dimension/parent est invalide."""
    key = (key or slug(label)).strip()
    label = (label or "").strip()
    if not key or not label or dim not in EXTENDABLE:
        return False
    if dim == "continent":
        if key not in CONTINENT_LABEL:
            GEO.append({"key": key, "label": label, "emoji": emoji or "🌐", "regions": []})
            CONTINENT_LABEL[key] = label
    elif dim == "region":
        cont = next((c for c in GEO if c["key"] == parent), None)
        if not cont:
            return False
        if key not in REGION_LABEL:
            cont["regions"].append({"key": key, "label": label, "countries": ""})
            REGION_LABEL[key] = label
            REGION_TO_CONTINENT[key] = cont["key"]
    elif dim == "country":
        key = key.upper()
        if parent not in REGION_LABEL:
            return False
        COUNTRY_FR[key] = label
        COUNTRY_TO_REGION[key] = parent
        for c in GEO:
            for r in c["regions"]:
                if r["key"] == parent and key not in r["countries"].split():
                    r["countries"] = (r["countries"] + " " + key).strip()
    elif dim == "type":
        fam = next((f for f in TYPES if f["key"] == parent), None)
        if not fam:
            return False
        if key not in SUBTYPE_LABEL:
            fam["subtypes"].append((key, label))
            SUBTYPE_LABEL[key] = label
            SUBTYPE_TO_FAMILY[key] = fam["key"]
    elif dim == "genre":
        if key not in GENRE_LABEL:
            GENRES.append((key, label))
            GENRE_LABEL[key] = label
    elif dim in ("domain", "theme"):
        groups = DOMAINS if dim == "domain" else THEMES
        labels = DOMAIN_LABEL if dim == "domain" else THEME_LABEL
        grp = next((g for g in groups if g["key"] == (group or "autres")), None)
        if not grp:
            grp = {"key": group or "autres", "label": (group or "Autres").capitalize(), "emoji": emoji or "🏷️", "items": []}
            groups.append(grp)
        if key not in labels:
            grp["items"].append((key, label))
            labels[key] = label
            if dim == "theme":
                THEME_GROUP[key] = grp["key"]; THEME_EMOJI[key] = grp.get("emoji", "")
            else:
                DOMAIN_GROUP[key] = grp["key"]
    elif dim == "emotion":
        if key not in EMOTION_LABEL:
            EMOTIONS.append((key, label, emoji or "💫")); EMOTION_LABEL[key] = label; EMOTION_EMOJI[key] = emoji or "💫"
    elif dim == "mood":
        if key not in MOOD_LABEL:
            MOODS.append((key, label, emoji or "🌙")); MOOD_LABEL[key] = label; MOOD_EMOJI[key] = emoji or "🌙"
    elif dim == "audience":
        if key not in AUDIENCE_LABEL:
            AUDIENCES.append((key, label)); AUDIENCE_LABEL[key] = label
    elif dim == "lang":
        if key not in LANGUAGE_LABEL:
            LANGUAGES.append((key, label)); LANGUAGE_LABEL[key] = label
    _reg(dim, key, label)
    return True


# Index texte : libellé normalisé → (dimension, clé), pour la recherche « deuil », « Gabon », « polar »…
LABEL_INDEX: dict[str, tuple[str, str]] = {}
def _reg(dim: str, key: str, label: str):
    LABEL_INDEX.setdefault(slug(label), (dim, key))
    LABEL_INDEX.setdefault(slug(key), (dim, key))
for _k, _l in SUBTYPE_LABEL.items(): _reg("type", _k, _l)
for _k, _l in FAMILY_LABEL.items(): _reg("type", _k, _l)
for _k, _l in GENRES: _reg("genre", _k, _l)
for _k, _l in DOMAIN_LABEL.items(): _reg("domain", _k, _l)
for _k, _l in THEME_LABEL.items(): _reg("theme", _k, _l)
for _k, _l in EMOTION_LABEL.items(): _reg("emotion", _k, _l)
for _k, _l in MOOD_LABEL.items(): _reg("mood", _k, _l)
for _k, _l in AUDIENCE_LABEL.items(): _reg("audience", _k, _l)
for _k, _l in CONTINENT_LABEL.items(): _reg("continent", _k, _l)
for _k, _l in REGION_LABEL.items(): _reg("region", _k, _l)
for _k, _l in COUNTRY_FR.items(): _reg("country", _k, _l)
for _k, _l in LANGUAGE_LABEL.items(): _reg("lang", _k, _l)
# Mots courants des lectrices → étiquettes (recherche et intention sans IA)
for _w, _target in {
    "confiance": ("theme", "confiance-en-soi"), "reconstruire": ("theme", "reconstruction"), "se-reconstruire": ("theme", "reconstruction"),
    "guerir": ("theme", "guerison"), "deprime": ("emotion", "tristesse"), "triste": ("emotion", "tristesse"), "pleurer": ("emotion", "emouvant"),
    "rire": ("mood", "drole"), "rigoler": ("mood", "drole"), "motivant": ("mood", "inspirant"), "reconfort": ("mood", "reconfortant"),
    "reconforte": ("mood", "reconfortant"), "reconforter": ("mood", "reconfortant"), "apaisant": ("mood", "relaxant"), "doux": ("mood", "leger"),
    "thriller": ("genre", "polar"), "policier": ("genre", "polar"), "fantasy": ("genre", "imaginaire"), "science-fiction": ("genre", "imaginaire"),
    "sf": ("genre", "imaginaire"), "fantastique": ("genre", "imaginaire"), "feelgood": ("genre", "feel-good"), "bd": ("type", "bande-dessinee"),
    "enfant": ("audience", "enfants"), "ado": ("audience", "adolescents"), "ados": ("audience", "adolescents"), "recette": ("type", "cuisine"),
    "recettes": ("type", "cuisine"), "entreprendre": ("domain", "entrepreneuriat"), "startup": ("domain", "entrepreneuriat"),
    "bourse": ("domain", "investissement"), "investir": ("domain", "investissement"), "manager": ("domain", "management"),
    "prier": ("theme", "priere"), "chretien": ("type", "christianisme"), "musulman": ("type", "islam"), "coran": ("type", "islam"),
    "bebe": ("theme", "maternite"), "maman": ("theme", "maternite"), "papa": ("theme", "paternite"), "divorce": ("theme", "separation"),
    "chagrin": ("theme", "rupture"), "coeur-brise": ("theme", "rupture"), "esclavage": ("theme", "colonialisme"), "exil": ("theme", "immigration"),
    "migrant": ("theme", "immigration"), "burn-out": ("theme", "sante"), "burnout": ("theme", "sante"), "anxieux": ("theme", "anxiete"),
}.items():
    LABEL_INDEX.setdefault(_w, _target)
# Gentilés courants → pays / continent
for _g, _target in {
    "africain": ("continent", "afrique"), "africaine": ("continent", "afrique"), "europeen": ("continent", "europe"),
    "asiatique": ("continent", "asie"), "americain": ("continent", "ameriques"),
    "senegalais": ("country", "SN"), "senegalaise": ("country", "SN"), "camerounais": ("country", "CM"), "ivoirien": ("country", "CI"),
    "nigerian": ("country", "NG"), "gabonais": ("country", "GA"), "congolais": ("country", "CD"), "malien": ("country", "ML"),
    "guineen": ("country", "GN"), "beninois": ("country", "BJ"), "togolais": ("country", "TG"), "marocain": ("country", "MA"),
    "algerien": ("country", "DZ"), "tunisien": ("country", "TN"), "haitien": ("country", "HT"), "antillais": ("region", "caraibes"),
    "martiniquais": ("country", "MQ"), "guadeloupeen": ("country", "GP"), "quebecois": ("country", "CA"), "belge": ("country", "BE"),
    "suisse": ("country", "CH"), "francais": ("country", "FR"), "libanais": ("country", "LB"), "japonais": ("country", "JP"),
    "coreen": ("country", "KR"), "chinois": ("country", "CN"), "indien": ("country", "IN"), "bresilien": ("country", "BR"),
    "anglais": ("country", "GB"), "italien": ("country", "IT"), "espagnol": ("country", "ES"), "allemand": ("country", "DE"),
}.items():
    LABEL_INDEX.setdefault(_g, _target)
