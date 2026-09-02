"""Classification multidimensionnelle des livres (origine, type, domaines, thèmes, émotions, ambiances, public, langue).

Principes :
- un livre = une fiche, plusieurs étiquettes ; jamais exclusif ;
- chaque étiquette porte une confiance : ≥ 0,90 automatique (« forte »), 0,70–0,89 proposée,
  < 0,70 ignorée pour les filtres tant qu'un humain ne l'a pas validée ;
- corrections admin (`overrides`) prioritaires sur l'IA et les règles, conservées à chaque reclassification ;
- classification en tâche de fond (file `catalog_tasks`, kind `classify`) : règles d'abord, IA ensuite
  dans la limite d'un quota quotidien global (`CLASSIFY_DAILY_LIMIT`) ;
- étiquettes « aplaties » dans des tableaux indexés `f_*` pour des filtres rapides
  (OU à l'intérieur d'une dimension, ET entre dimensions).
Les anciens champs (`subjects`, `genre`, `kind`, `areas`, `continents`, `countries`) sont conservés
et enrichis, jamais supprimés : la recherche et les pages existantes continuent de fonctionner.
"""
import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import taxonomy as tx

logger = logging.getLogger("manent")
db = None  # injecté par catalog.init()

STRONG = 0.90
PROPOSED = 0.70
AI_VERSION = "cls-v1"
CLASSIFY_DAILY_LIMIT = int(os.environ.get("CLASSIFY_DAILY_LIMIT", "300"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

router = APIRouter(prefix="/api/catalog")            # auth utilisateur (inclus par server.py)
admin_router = APIRouter(prefix="/api/catalog/admin")  # auth admin

# dimension → champ aplati indexé
FIELD = {"continent": "f_continents", "region": "f_regions", "country": "f_countries", "type": "f_types",
         "genre": "f_genres", "domain": "f_domains", "theme": "f_themes", "emotion": "f_emotions",
         "mood": "f_moods", "audience": "f_audience", "lang": "f_lang"}
# paramètres de requête acceptés par /browse et /intent (plusieurs valeurs = OU)
QUERY_DIMS = ("continent", "region", "country", "type", "genre", "domain", "theme", "emotion", "mood", "audience", "lang")


def now_utc():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- Règles (sans IA)
def _add(labels: dict, dim: str, key: str, conf: float, source: str):
    if not key or key not in tx.valid_keys(dim):
        return
    k = f"{dim}:{key}"
    cur = labels.get(k)
    if not cur or conf > cur["confidence"]:
        labels[k] = {"confidence": round(min(max(conf, 0.0), 1.0), 2), "source": source}


def rules_classify(book: dict, authors: list[dict]) -> dict:
    """Étiquettes déduites des catégories sources, des anciens sujets/genres et de l'origine des auteurs."""
    labels: dict = {}
    seen_markers: set = set()
    texts = [tx.slug(x) for x in (book.get("raw_subjects") or []) if x]
    for t in texts:
        for marker, outs in tx.RULES:
            m = tx.slug(marker)
            if m and m in t and (m, t) not in seen_markers:
                seen_markers.add((m, t))
                for lab in outs:
                    dim, key = lab.split(":", 1)
                    _add(labels, dim, key, 0.80, "rules")
    for s in book.get("subjects") or []:
        for lab in tx.LEGACY_SUBJECTS.get(s, []):
            dim, key = lab.split(":", 1)
            _add(labels, dim, key, 0.85, "rules")
    for lab in tx.LEGACY_GENRES.get(book.get("genre") or "", []):
        dim, key = lab.split(":", 1)
        _add(labels, dim, key, 0.85, "rules")
    if book.get("kind") == "fiction" and not any(k.startswith("type:") for k in labels):
        _add(labels, "type", "roman", 0.72, "rules")
    if book.get("kind") == "nonfiction" and not any(k.startswith("type:") for k in labels):
        _add(labels, "type", "essai", 0.70, "rules")
    # Origine : pays des auteurs (confiance selon la source de l'origine)
    conf_map = {"high": 0.95, "medium": 0.85, "low": 0.72}
    for a in authors:
        iso = (a.get("country") or "").upper()
        if not iso:
            continue
        c = conf_map.get(a.get("origin_confidence") or "low", 0.72)
        if a.get("origin_source") == "manual":
            c = 1.0
        _add(labels, "country", iso, c, "rules")
        g = tx.geo_for_country(iso)
        if g:
            _add(labels, "region", g["region"], c, "rules")
            _add(labels, "continent", g["continent"], c, "rules")
    lang = (book.get("language") or "").lower()[:2]
    if lang:
        _add(labels, "lang", lang, 0.90, "rules")
    return labels


# ---------------------------------------------------------------- IA (JSON strict, jamais d'invention)
def _keys_block() -> str:
    def j(items):
        return ", ".join(items)
    return (
        f"type (sous-types) : {j(tx.SUBTYPE_LABEL)}\n"
        f"genre (fiction seulement) : {j(k for k, _ in tx.GENRES)}\n"
        f"domain : {j(tx.DOMAIN_LABEL)}\n"
        f"theme : {j(tx.THEME_LABEL)}\n"
        f"emotion : {j(tx.EMOTION_LABEL)}\n"
        f"mood : {j(tx.MOOD_LABEL)}\n"
        f"audience : {j(tx.AUDIENCE_LABEL)}\n"
        f"lang (langue originale, ISO 639-1) : {j(tx.LANGUAGE_LABEL)}\n"
        "country (pays de l'auteur ou où se déroule l'histoire, ISO 3166-1 alpha-2, MQ/GP/GF/RE pour les Antilles-Guyane-Réunion)"
    )


AI_SYSTEM = (
    "Tu es un bibliothécaire francophone rigoureux. On te donne un livre (titre, auteur, résumé, catégories sources). "
    "Tu renvoies UNIQUEMENT un objet JSON : {\"labels\": [{\"dim\": \"…\", \"key\": \"…\", \"confidence\": 0.0-1.0}], "
    "\"story_countries\": [\"ISO2\"], \"unknown\": false}. "
    "Règles : n'utilise QUE les clés listées ci-dessous ; un livre peut avoir plusieurs étiquettes par dimension ; "
    "distingue bien thème (sujet traité), émotion (ce que ressent le lecteur) et ambiance (ton du livre) ; "
    "la confiance reflète ta certitude réelle : 0.9+ si évident, 0.7-0.89 si probable, en dessous si incertain ; "
    "si tu ne connais pas ce livre, mets \"unknown\": true et ne renvoie que ce qui est déductible du résumé. "
    "N'invente jamais un pays, un public ou un thème. Aucun texte hors du JSON.\n\nClés autorisées :\n" + _keys_block()
)


async def ai_classify(book: dict, authors: list[dict]) -> Optional[dict]:
    """Retourne {'labels': {dim:key → {confidence, source:'ai'}}, 'story_countries': [...], 'unknown': bool} ou None."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        return None
    ident = f"Titre : {book.get('title')}\nAuteur(s) : {', '.join(book.get('authors') or []) or 'inconnu'}"
    origins = [tx.COUNTRY_FR.get((a.get("country") or "").upper(), a.get("country")) for a in authors if a.get("country")]
    if origins:
        ident += f"\nOrigine connue des auteurs : {', '.join(origins)}"
    if book.get("year"):
        ident += f"\nAnnée : {book['year']}"
    if book.get("summary"):
        ident += f"\nRésumé : {book['summary'][:900]}"
    if book.get("raw_subjects"):
        ident += f"\nCatégories sources : {', '.join(book['raw_subjects'][:12])}"
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"cls_{book['catalog_id']}",
                       system_message=AI_SYSTEM).with_model("anthropic", "claude-sonnet-4-6")
        resp = await chat.send_message(UserMessage(text=ident + "\n\nRenvoie le JSON."))
        raw = re.sub(r'^```(?:json)?|```$', '', str(resp).strip(), flags=re.M).strip()
        data = json.loads(raw)
    except Exception as e:
        logger.warning("ai classify failed (%s): %s", book.get("catalog_id"), e)
        return None
    labels: dict = {}
    for item in data.get("labels") or []:
        try:
            dim, key, conf = str(item.get("dim")), str(item.get("key")), float(item.get("confidence", 0))
        except Exception:
            continue
        if dim == "language":
            dim = "lang"
        if dim in ("continent", "region"):
            continue  # dérivés du pays, jamais donnés directement
        _add(labels, dim, key, conf, "ai")
    story = [str(c).upper() for c in (data.get("story_countries") or []) if str(c).upper() in tx.COUNTRY_FR][:5]
    return {"labels": labels, "story_countries": story, "unknown": bool(data.get("unknown"))}


# ---------------------------------------------------------------- Fusion, priorités et aplatissement
def _derive_geo(labels: dict):
    """Ajoute région et continent pour chaque pays présent (même confiance)."""
    for k, v in list(labels.items()):
        if not k.startswith("country:"):
            continue
        g = tx.geo_for_country(k.split(":", 1)[1])
        if g:
            _add(labels, "region", g["region"], v["confidence"], v["source"])
            _add(labels, "continent", g["continent"], v["confidence"], v["source"])
    # famille de type déduite des sous-types
    for k, v in list(labels.items()):
        if k.startswith("type:"):
            fam = tx.SUBTYPE_TO_FAMILY.get(k.split(":", 1)[1])
            if fam:
                _add(labels, "type", fam, v["confidence"], v["source"])
    if any(k.startswith("genre:") for k in labels) and "type:fiction" not in labels:
        best = max(v["confidence"] for k, v in labels.items() if k.startswith("genre:"))
        _add(labels, "type", "roman", best, "rules")
        _add(labels, "type", "fiction", best, "rules")


def merge_labels(rules: dict, ai: Optional[dict], overrides: dict) -> dict:
    labels: dict = {}
    for k, v in rules.items():
        labels[k] = dict(v)
    if ai:
        for k, v in ai["labels"].items():
            dim, _, key = k.partition(":")
            if key not in tx.valid_keys(dim):
                continue
            cur = labels.get(k)
            if not cur or v["confidence"] >= cur["confidence"]:
                labels[k] = dict(v)
            elif cur:  # deux sources d'accord → on consolide
                labels[k]["confidence"] = round(min(1.0, cur["confidence"] + 0.05), 2)
        for iso in ai.get("story_countries") or []:
            _add(labels, "country", iso, 0.80, "ai")
    for k in overrides.get("remove") or []:
        labels.pop(k, None)
    for k in overrides.get("add") or []:
        dim, _, key = k.partition(":")
        if key in tx.valid_keys(dim):
            labels[k] = {"confidence": 1.0, "source": "admin"}
    _derive_geo(labels)
    # les suppressions admin priment aussi sur les dérivations
    for k in overrides.get("remove") or []:
        labels.pop(k, None)
    return labels


def flatten(labels: dict) -> dict:
    """Champs `f_*` (≥ PROPOSED) + document `classification` lisible."""
    out: dict = {f: [] for f in FIELD.values()}
    items = []
    for k, v in labels.items():
        dim, _, key = k.partition(":")
        conf = v["confidence"]
        entry = {"dim": dim, "key": key, "label": tx.label_for(dim, key), "confidence": conf,
                 "strong": conf >= STRONG, "proposed": PROPOSED <= conf < STRONG, "source": v["source"]}
        items.append(entry)
        if conf >= PROPOSED and dim in FIELD:
            out[FIELD[dim]].append(key)
    for f in FIELD.values():
        out[f] = sorted(set(out[f]))
    order = {d: i for i, d in enumerate(("type", "genre", "continent", "region", "country", "domain", "theme", "emotion", "mood", "audience", "lang"))}
    items.sort(key=lambda x: (order.get(x["dim"], 99), -x["confidence"], x["label"]))
    strong = [x for x in items if x["confidence"] >= PROPOSED]
    fam = next((x["key"] for x in strong if x["dim"] == "type" and x["key"] in tx.FAMILY_LABEL), None)
    sub = next((x["key"] for x in strong if x["dim"] == "type" and x["key"] in tx.SUBTYPE_LABEL), None)
    gen = next((x["key"] for x in strong if x["dim"] == "genre"), None)
    out["classification"] = {
        "labels": items,
        "type": {"family": fam, "subtype": sub, "genre": gen},
        "geo": {"continents": out["f_continents"], "regions": out["f_regions"], "countries": out["f_countries"]},
        "themes": out["f_themes"], "domains": out["f_domains"], "emotions": out["f_emotions"], "moods": out["f_moods"],
        "audience": out["f_audience"], "languages": out["f_lang"],
    }
    return out


# Genre nouveau → ancien genre (pages /genre/* existantes)
_GENRE_BACK = {"polar": "polar", "imaginaire": "imaginaire", "dystopie": "imaginaire", "romance": "romance",
               "contemporain": "litterature", "historique": "litterature", "classique": "litterature",
               "feel-good": "litterature", "aventure": "litterature", "humour": "litterature"}
_THEME_BACK = {}
for _s, _labs in tx.LEGACY_SUBJECTS.items():
    for _l in _labs:
        if _l.startswith("theme:"):
            _THEME_BACK.setdefault(_l.split(":", 1)[1], _s)


def _legacy_sync(book: dict, flat: dict) -> tuple[dict, list]:
    """Retro-alimente les anciens champs (sans rien retirer) pour que les pages existantes en profitent."""
    upd: dict = {}
    cls = flat["classification"]
    fam = cls["type"]["family"]
    if fam and book.get("kind") in (None, "unknown"):
        upd["kind"] = "fiction" if fam == "fiction" else "nonfiction"
    if not book.get("genre"):
        if cls["type"]["genre"] and _GENRE_BACK.get(cls["type"]["genre"]):
            upd["genre"] = _GENRE_BACK[cls["type"]["genre"]]
        elif cls["type"]["subtype"] in ("bande-dessinee", "graphic-novel"):
            upd["genre"] = "bd"
        elif cls["type"]["subtype"] == "manga":
            upd["genre"] = "manga"
        elif cls["type"]["subtype"] == "jeunesse":
            upd["genre"] = "jeunesse"
        elif fam == "fiction":
            upd["genre"] = "litterature"
        elif fam and fam != "fiction":
            upd["genre"] = "nonfiction"
    subjects = {_THEME_BACK[t] for t in flat["f_themes"] if t in _THEME_BACK}
    for d in flat["f_domains"]:
        if d in ("finance", "entrepreneuriat", "leadership"):
            subjects.add(d)
    add_subjects = sorted(subjects - set(book.get("subjects") or []))
    return upd, add_subjects


async def _authors_of(book: dict) -> list[dict]:
    ids = book.get("author_ids") or []
    if not ids:
        return []
    return await db.catalog_authors.find({"author_id": {"$in": ids}},
                                         {"_id": 0, "country": 1, "origin_confidence": 1, "origin_source": 1}).to_list(10)


async def _ai_quota_ok() -> bool:
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    doc = await db.meta.find_one({"key": key}, {"_id": 0, "n": 1})
    return (doc or {}).get("n", 0) < CLASSIFY_DAILY_LIMIT


async def _ai_quota_use():
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    await db.meta.update_one({"key": key}, {"$inc": {"n": 1}, "$set": {"at": now_utc()}}, upsert=True)


async def classify_book(catalog_id: str, use_ai: bool = True, force_ai: bool = False) -> Optional[dict]:
    """Pipeline complet : règles → IA (si quota) → corrections admin → aplatissement → écriture."""
    book = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not book:
        return None
    authors = await _authors_of(book)
    rules = rules_classify(book, authors)
    ai = None
    ai_done = bool((book.get("classification") or {}).get("ai_version"))
    if use_ai and (force_ai or not ai_done):
        if await _ai_quota_ok():
            await _ai_quota_use()
            ai = await ai_classify(book, authors)
        else:
            ai = None
    elif ai_done and not force_ai:
        # on garde les étiquettes IA précédentes (stockées) pour ne pas re-payer l'appel
        prev = book.get("classification") or {}
        ai = {"labels": {f"{x['dim']}:{x['key']}": {"confidence": x["confidence"], "source": "ai"}
                         for x in prev.get("labels", []) if x.get("source") == "ai"},
              "story_countries": [], "unknown": prev.get("ai_unknown", False)}
    overrides = book.get("overrides") or {}
    labels = merge_labels(rules, ai, overrides)
    flat = flatten(labels)
    legacy, add_subjects = _legacy_sync(book, flat)
    cls = flat.pop("classification")
    cls.update({
        "source": "admin" if (overrides.get("add") or overrides.get("remove")) else ("ai" if ai and ai["labels"] else "rules"),
        "classified_at": now_utc(),
        "ai_version": AI_VERSION if ai is not None else (book.get("classification") or {}).get("ai_version"),
        # sans IA (quota épuisé) : à retenter plus tard ; une correction admin ne fait pas perdre ce statut
        "ai_pending": bool((use_ai and ai is None and not ai_done)
                           or (not use_ai and not ai_done and (book.get("classification") or {}).get("ai_pending"))),
        "ai_unknown": bool(ai and ai.get("unknown")),
    })
    upd = {**flat, "classification": cls, "updated_at": now_utc(), **legacy}
    ops: dict = {"$set": upd}
    if add_subjects:
        ops["$addToSet"] = {"subjects": {"$each": add_subjects}}
    await db.catalog_books.update_one({"catalog_id": catalog_id}, ops)
    return cls


# ---------------------------------------------------------------- Tâches de fond
async def enqueue(catalog_id: str):
    await db.catalog_tasks.update_one(
        {"catalog_id": catalog_id, "kind": "classify", "status": {"$in": ["pending", "running"]}},
        {"$setOnInsert": {"status": "pending", "tries": 0, "created_at": now_utc()}}, upsert=True)


async def process_tasks(limit: int = 4) -> int:
    tasks = await db.catalog_tasks.find({"status": "pending", "kind": "classify"}).sort("created_at", 1).to_list(limit)
    for t in tasks:
        await db.catalog_tasks.update_one({"_id": t["_id"]}, {"$set": {"status": "running"}})
        try:
            book = await db.catalog_books.find_one({"catalog_id": t["catalog_id"]}, {"_id": 0, "summary": 1})
            if not book:
                await db.catalog_tasks.delete_one({"_id": t["_id"]})
                continue
            if not book.get("summary") and t.get("tries", 0) < 2:
                # le résumé arrive en général quelques secondes plus tard : l'IA classera mieux avec.
                waiting = await db.catalog_tasks.find_one({"catalog_id": t["catalog_id"], "kind": "summary", "status": {"$in": ["pending", "running"]}})
                if waiting:
                    await db.catalog_tasks.update_one({"_id": t["_id"]}, {"$set": {"status": "pending", "created_at": now_utc()}, "$inc": {"tries": 1}})
                    continue
            await classify_book(t["catalog_id"], use_ai=True)
            await db.catalog_tasks.delete_one({"_id": t["_id"]})
        except Exception as e:
            logger.warning("classify task failed: %s", e)
            await db.catalog_tasks.update_one({"_id": t["_id"]}, {"$set": {"status": "pending"}, "$inc": {"tries": 1}})
            if t.get("tries", 0) >= 3:
                await db.catalog_tasks.delete_one({"_id": t["_id"]})
    return len(tasks)


async def retry_ai_pending(n: int = 20):
    """Chaque jour, remet en file les livres classés par règles seules faute de quota IA."""
    if not await _ai_quota_ok():
        return
    async for b in db.catalog_books.find({"classification.ai_pending": True}, {"_id": 0, "catalog_id": 1}).limit(n):
        await enqueue(b["catalog_id"])


async def backfill():
    """Migration progressive : chaque livre existant passe par la file (rien n'est supprimé)."""
    if await db.meta.find_one({"key": "classification_backfill_v1"}):
        return
    await db.meta.update_one({"key": "classification_backfill_v1"}, {"$set": {"at": now_utc()}}, upsert=True)
    n = 0
    async for b in db.catalog_books.find({"classification": {"$exists": False}}, {"_id": 0, "catalog_id": 1}).sort("popularity", -1):
        await enqueue(b["catalog_id"])
        n += 1
    logger.info("classification backfill: %s livres en file", n)


async def ensure_indexes():
    for f in FIELD.values():
        await db.catalog_books.create_index(f)
    await db.catalog_books.create_index("classification.ai_pending")
    await db.catalog_books.create_index([("popularity", -1)])


# ---------------------------------------------------------------- Présentation
def lines(b: dict) -> list[dict]:
    """Lignes de classification pour les cartes et fiches : [{icon, text}] (max 4)."""
    cls = b.get("classification") or {}
    if not cls:
        return []
    out = []
    t = cls.get("type") or {}
    parts = [tx.label_for("type", t["subtype"])] if t.get("subtype") else ([tx.label_for("type", t["family"])] if t.get("family") else [])
    if t.get("genre"):
        parts.append(tx.label_for("genre", t["genre"]))
    if parts:
        out.append({"icon": "📖", "text": " · ".join(parts)})
    geo = cls.get("geo") or {}
    gparts = [tx.COUNTRY_FR.get(c, c) for c in (geo.get("countries") or [])[:2]]
    if not gparts and geo.get("regions"):
        gparts = [tx.REGION_LABEL.get(geo["regions"][0], geo["regions"][0])]
    if gparts:
        cont = (geo.get("continents") or [None])[0]
        text = (tx.CONTINENT_LABEL.get(cont, "") + " · " if cont else "") + " · ".join(gparts)
        out.append({"icon": "🌍", "text": text})
    themes = [tx.THEME_LABEL.get(k, k) for k in (cls.get("themes") or [])[:3]]
    if themes:
        out.append({"icon": "🧵", "text": " · ".join(themes)})
    feel = [tx.MOOD_LABEL.get(k, k) for k in (cls.get("moods") or [])[:2]] + [tx.EMOTION_LABEL.get(k, k) for k in (cls.get("emotions") or [])[:1]]
    if feel:
        out.append({"icon": "💫", "text": " · ".join(feel)})
    return out


def taxonomy_payload() -> dict:
    return {
        "geo": [{"key": c["key"], "label": c["label"], "emoji": c.get("emoji"),
                 "regions": [{"key": r["key"], "label": r["label"],
                              "countries": [{"key": iso, "label": tx.COUNTRY_FR.get(iso, iso)} for iso in r["countries"].split() if iso in tx.COUNTRY_FR]}
                             for r in c["regions"]]} for c in tx.GEO],
        "types": [{"key": f["key"], "label": f["label"], "emoji": f.get("emoji"),
                   "subtypes": [{"key": k, "label": l} for k, l in f["subtypes"]]} for f in tx.TYPES],
        "genres": [{"key": k, "label": l} for k, l in tx.GENRES],
        "domains": [{"key": g["key"], "label": g["label"], "emoji": g.get("emoji"),
                     "items": [{"key": k, "label": l} for k, l in g["items"]]} for g in tx.DOMAINS],
        "themes": [{"key": g["key"], "label": g["label"], "emoji": g.get("emoji"),
                    "items": [{"key": k, "label": l} for k, l in g["items"]]} for g in tx.THEMES],
        "popular_themes": [{"key": k, "label": tx.THEME_LABEL.get(k, k), "emoji": tx.THEME_EMOJI.get(k, "")} for k in tx.POPULAR_THEMES],
        "emotions": [{"key": k, "label": l, "emoji": e} for k, l, e in tx.EMOTIONS],
        "moods": [{"key": k, "label": l, "emoji": e} for k, l, e in tx.MOODS],
        "audiences": [{"key": k, "label": l} for k, l in tx.AUDIENCES],
        "languages": [{"key": k, "label": l} for k, l in tx.LANGUAGES],
        "labels": {d: {k: tx.label_for(d, k) for k in tx.valid_keys(d)} for d in ("type", "genre", "domain", "theme", "emotion", "mood", "audience", "continent", "region", "country", "lang")},
    }


# ---------------------------------------------------------------- Filtres et navigation
def build_filter(sel: dict) -> dict:
    """{dim: [keys]} → filtre Mongo : OU dans une dimension, ET entre dimensions."""
    flt: dict = {}
    for dim, keys in sel.items():
        keys = [k for k in (keys or []) if k]
        if not keys or dim not in FIELD:
            continue
        # géographie : un pays choisi rend la région/le continent redondants (plus précis gagne)
        flt[FIELD[dim]] = {"$in": keys}
    if "f_countries" in flt:
        flt.pop("f_regions", None); flt.pop("f_continents", None)
    elif "f_regions" in flt:
        flt.pop("f_continents", None)
    # sous-type choisi → la famille n'ajoute rien (mais reste acceptée)
    return flt


def selected_chips(sel: dict) -> list[dict]:
    chips = []
    for dim in QUERY_DIMS:
        for k in sel.get(dim) or []:
            chips.append({"dim": dim, "key": k, "label": tx.label_for(dim, k)})
    return chips


SORTS = {"pertinence": [("popularity", -1), ("updated_at", -1)], "populaires": [("popularity", -1)],
         "recents": [("created_at", -1)], "titre": [("title", 1)], "annee": [("year", -1)]}


def _sel_from_params(**kw) -> dict:
    sel = {}
    for dim in QUERY_DIMS:
        vals = kw.get(dim) or []
        flat: list[str] = []
        for v in vals:
            flat += [x.strip() for x in str(v).split(",") if x.strip()]
        if flat:
            sel[dim] = flat
    return sel


@router.get("/taxonomy")
async def get_taxonomy():
    return taxonomy_payload()


@router.get("/browse")
async def browse(q: Optional[str] = None, sort: str = "pertinence", page: int = 1, size: int = 20, count_only: int = 0,
                 continent: list[str] = Query(default=[]), region: list[str] = Query(default=[]), country: list[str] = Query(default=[]),
                 type: list[str] = Query(default=[]), genre: list[str] = Query(default=[]), domain: list[str] = Query(default=[]),
                 theme: list[str] = Query(default=[]), emotion: list[str] = Query(default=[]), mood: list[str] = Query(default=[]),
                 audience: list[str] = Query(default=[]), lang: list[str] = Query(default=[])):
    from routes.catalog import _card
    sel = _sel_from_params(continent=continent, region=region, country=country, type=type, genre=genre, domain=domain,
                           theme=theme, emotion=emotion, mood=mood, audience=audience, lang=lang)
    flt = build_filter(sel)
    if q and q.strip():
        flt["$text"] = {"$search": q.strip()[:120]}
    total = await db.catalog_books.count_documents(flt)
    if count_only:
        return {"total": total, "chips": selected_chips(sel)}
    size = min(max(size, 1), 40)
    skip = max(page - 1, 0) * size
    cur = db.catalog_books.find(flt, {"_id": 0})
    if "$text" in flt and sort == "pertinence":
        cur = db.catalog_books.find(flt, {"_id": 0, "score": {"$meta": "textScore"}}).sort([("score", {"$meta": "textScore"})])
    else:
        cur = cur.sort(SORTS.get(sort, SORTS["pertinence"]))
    docs = await cur.skip(skip).limit(size).to_list(size)
    return {"results": [_card(b) for b in docs], "total": total, "page": page, "size": size,
            "chips": selected_chips(sel), "filters": sel, "sort": sort}


# ---------------------------------------------------------------- Recherche par intention (« Je cherche un livre qui… »)
INTENT_SYSTEM = (
    "Tu transformes une demande de lecture en filtres. Renvoie UNIQUEMENT un JSON : "
    "{\"filters\": {\"theme\": [..], \"emotion\": [..], \"mood\": [..], \"type\": [..], \"genre\": [..], \"domain\": [..], "
    "\"audience\": [..], \"continent\": [..], \"country\": [..ISO2..], \"lang\": [..]}, \"interpretation\": \"phrase courte en français\"}. "
    "Utilise UNIQUEMENT les clés autorisées ci-dessous, 1 à 4 étiquettes par dimension pertinente, omets les dimensions non concernées. "
    "Ne mets pas de mots libres. Aucun texte hors du JSON.\n\nClés autorisées :\n" + _keys_block()
    + "\ncontinent : " + ", ".join(tx.CONTINENT_LABEL)
)


def _keyword_intent(text: str) -> dict:
    """Repli sans IA : mots et bigrammes du texte → étiquettes du référentiel."""
    words = tx.slug(text).split("-")
    sel: dict = {}
    grams = words + [f"{a}-{b}" for a, b in zip(words, words[1:])]
    for g in grams:
        hit = tx.LABEL_INDEX.get(g)
        if hit and len(g) > 3:
            sel.setdefault(hit[0], [])
            if hit[1] not in sel[hit[0]]:
                sel[hit[0]].append(hit[1])
    return sel


class IntentBody(BaseModel):
    text: str = Field(min_length=3, max_length=300)


@router.post("/intent")
async def intent_search(body: IntentBody):
    from routes.catalog import _card
    text = body.text.strip()
    sel: dict = {}
    interp = None
    source = "ai"
    if EMERGENT_LLM_KEY and await _ai_quota_ok():
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            await _ai_quota_use()
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"intent_{abs(hash(text)) % 10**8}",
                           system_message=INTENT_SYSTEM).with_model("anthropic", "claude-sonnet-4-6")
            resp = await chat.send_message(UserMessage(text=f"Demande : « {text} »"))
            raw = re.sub(r'^```(?:json)?|```$', '', str(resp).strip(), flags=re.M).strip()
            data = json.loads(raw)
            for dim, keys in (data.get("filters") or {}).items():
                dim = "lang" if dim == "language" else dim
                if dim in QUERY_DIMS and isinstance(keys, list):
                    ok = [str(k) for k in keys if str(k) in tx.valid_keys(dim)][:4]
                    if ok:
                        sel[dim] = ok
            interp = (data.get("interpretation") or "")[:160] or None
        except Exception as e:
            logger.warning("intent ai failed: %s", e)
    if not sel:
        sel = _keyword_intent(text)
        source = "keywords"
    flt = build_filter(sel)
    docs, total = [], 0
    if flt:
        total = await db.catalog_books.count_documents(flt)
        docs = await db.catalog_books.find(flt, {"_id": 0}).sort([("popularity", -1)]).limit(20).to_list(20)
        # trop peu de résultats : on relâche progressivement (on garde thèmes/émotions en priorité)
        if total < 3 and len(sel) > 1:
            for drop in ("lang", "audience", "country", "continent", "region", "genre", "type", "domain", "mood", "emotion"):
                if drop in sel and len(sel) > 1:
                    relaxed = {k: v for k, v in sel.items() if k != drop}
                    f2 = build_filter(relaxed)
                    t2 = await db.catalog_books.count_documents(f2)
                    if t2 >= 3:
                        sel, flt, total = relaxed, f2, t2
                        docs = await db.catalog_books.find(f2, {"_id": 0}).sort([("popularity", -1)]).limit(20).to_list(20)
                        break
    return {"filters": sel, "chips": selected_chips(sel), "interpretation": interp, "source": source,
            "results": [_card(b) for b in docs], "total": total}


# ---------------------------------------------------------------- Recherche classique : étiquettes du référentiel
def labels_in_query(q: str) -> dict:
    """« polar sénégalais », « deuil » → {dim: [keys]} (mots entiers du référentiel uniquement)."""
    return _keyword_intent(q)


# ---------------------------------------------------------------- Admin
class OverrideBody(BaseModel):
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


def _admin_view(b: dict) -> dict:
    from routes.catalog import _card
    cls = b.get("classification") or {}
    return {**_card(b), "classification": cls, "overrides": b.get("overrides") or {"add": [], "remove": []},
            "raw_subjects": b.get("raw_subjects") or [], "lines": lines(b)}


@admin_router.get("/classification/{catalog_id}")
async def admin_get_classification(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if not b.get("classification"):
        await classify_book(catalog_id, use_ai=False)
        await enqueue(catalog_id)
        b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    return _admin_view(b)


@admin_router.patch("/classification/{catalog_id}")
async def admin_patch_classification(catalog_id: str, body: OverrideBody):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0, "overrides": 1})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    ov = b.get("overrides") or {"add": [], "remove": []}
    add, remove = set(ov.get("add") or []), set(ov.get("remove") or [])
    for k in body.add:
        dim, _, key = k.partition(":")
        if key not in tx.valid_keys(dim):
            raise HTTPException(status_code=422, detail=f"invalid_label:{k}")
        add.add(k); remove.discard(k)
    for k in body.remove:
        remove.add(k); add.discard(k)
    await db.catalog_books.update_one({"catalog_id": catalog_id}, {"$set": {
        "overrides": {"add": sorted(add), "remove": sorted(remove), "updated_at": now_utc()}}})
    await classify_book(catalog_id, use_ai=False)
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    return _admin_view(b)


@admin_router.post("/classification/{catalog_id}/reclassify")
async def admin_reclassify(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0, "catalog_id": 1})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if not await _ai_quota_ok():
        raise HTTPException(status_code=429, detail="classify_quota_reached")
    cls = await classify_book(catalog_id, use_ai=True, force_ai=True)
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    return _admin_view(b) | {"ai_ok": bool(cls and cls.get("source") in ("ai", "admin"))}


@admin_router.get("/classification-stats")
async def admin_classification_stats():
    total = await db.catalog_books.count_documents({})
    classified = await db.catalog_books.count_documents({"classification": {"$exists": True}})
    ai = await db.catalog_books.count_documents({"classification.ai_version": {"$ne": None}})
    pending = await db.catalog_tasks.count_documents({"kind": "classify", "status": {"$in": ["pending", "running"]}})
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    used = ((await db.meta.find_one({"key": key}, {"_id": 0, "n": 1})) or {}).get("n", 0)
    return {"total": total, "classified": classified, "ai": ai, "pending": pending,
            "quota_used": used, "quota_limit": CLASSIFY_DAILY_LIMIT}
