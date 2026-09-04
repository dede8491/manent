"""Moteur de classification des livres — service interne (pas un simple appel IA).

Pipeline pour chaque livre (une fiche canonique, plusieurs étiquettes, jamais exclusif) :

    données du livre + auteurs  →  normalisation  →  moteur de règles pondérées
    →  faut-il l'IA ?  →  IA (JSON strict, preuves, cache, version)  →  fusion et priorités
    →  score de confiance  →  corrections humaines (toujours prioritaires)
    →  champs indexés `f_*`  →  recherche / filtres / admin

Priorités (une information faible n'écrase jamais une information validée) :
    1. validation humaine (admin)      2. donnée structurée fiable (pays d'auteur vérifié, ISBN)
    3. règle déterministe              4. sources concordantes (bonus)
    5. IA                              6. déduction faible (mot isolé, description) — jamais filtrée seule

Deux géographies distinctes : origine de l'AUTEUR (`country/region/continent`) et contexte de
l'HISTOIRE (`story_country/…`). Un auteur français situant son roman au Sénégal reste européen ;
le livre porte un contexte sénégalais / africain.

Seuils (configurables, admin) : ≥ strong automatique ; proposed…strong acceptable mais vérifiable ;
< proposed jamais utilisé pour les filtres tant qu'un humain ne l'a pas validé.

Collections : catalog_books (classification + f_*), catalog_tasks (kind classify : pending/running/
failed), ai_classifications (cache IA versionné), classification_feedback (corrections humaines),
classification_logs (observabilité), ai_calls (appels IA), taxonomy_ext (taxonomie administrable),
meta.classification_settings (seuils, poids, quota).
"""
import os
import re
import json
import time
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Callable, Awaitable

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel, Field

import taxonomy as tx
from ai_provider import provider

logger = logging.getLogger("manent")
db = None  # injecté par catalog.init()
resolve_user: Optional[Callable[[Optional[str]], Awaitable[dict]]] = None  # injecté par server.py (admin_id du feedback)

ENGINE_VERSION = "1.1"
PROMPT_VERSION = "cls-2"

router = APIRouter(prefix="/api/catalog")            # auth utilisateur (inclus par server.py)
admin_router = APIRouter(prefix="/api/catalog/admin")  # auth admin

# dimension → champ aplati indexé
FIELD = {"continent": "f_continents", "region": "f_regions", "country": "f_countries",
         "story_continent": "f_story_continents", "story_region": "f_story_regions", "story_country": "f_story_countries",
         "type": "f_types", "genre": "f_genres", "domain": "f_domains", "theme": "f_themes", "emotion": "f_emotions",
         "mood": "f_moods", "audience": "f_audience", "lang": "f_lang"}
QUERY_DIMS = tuple(FIELD.keys())
DISPLAY_ORDER = ("type", "genre", "continent", "region", "country", "story_continent", "story_region", "story_country",
                 "domain", "theme", "emotion", "mood", "audience", "lang")

# ---------------------------------------------------------------- Réglages (seuils, poids) — modifiables depuis l'admin
DEFAULT_SETTINGS = {
    "strong": 0.90, "proposed": 0.70,
    "ai_enabled": True, "daily_limit": int(os.environ.get("CLASSIFY_DAILY_LIMIT", "300")),
    # poids des sources (spécification §15/§40) exprimés en confiance 0–1
    "w_isbn": 1.0, "w_author_manual": 1.0, "w_author_reliable": 0.95, "w_author_medium": 0.85, "w_author_ai": 0.72,
    "w_metadata": 0.85, "w_legacy": 0.85, "w_description": 0.55, "w_word": 0.20, "w_agreement_bonus": 0.05,
}
_settings_cache: dict = dict(DEFAULT_SETTINGS)


async def load_settings() -> dict:
    global _settings_cache
    doc = await db.meta.find_one({"key": "classification_settings"}, {"_id": 0, "values": 1}) if db is not None else None
    _settings_cache = {**DEFAULT_SETTINGS, **((doc or {}).get("values") or {})}
    return _settings_cache


def S() -> dict:
    return _settings_cache


def now_utc():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- Normalisation (nom de pays, gentilés…)
_COUNTRY_ALIASES = {tx.slug(v): k for k, v in tx.COUNTRY_FR.items()}
_COUNTRY_ALIASES.update({"nigerian": "NG", "senegalese": "SN", "senegalais": "SN", "ivorian": "CI", "cameroonian": "CM",
                         "ghanaian": "GH", "kenyan": "KE", "south african": "ZA", "moroccan": "MA", "algerian": "DZ",
                         "haitian": "HT", "french": "FR", "english": "GB", "british": "GB", "american": "US", "canadian": "CA",
                         "belgian": "BE", "swiss": "CH", "italian": "IT", "spanish": "ES", "german": "DE", "japanese": "JP",
                         "brazilian": "BR", "indian": "IN", "chinese": "CN", "lebanese": "LB", "congolese": "CD", "malian": "ML",
                         "united states": "US", "usa": "US", "uk": "GB", "united kingdom": "GB", "england": "GB",
                         "cote d ivoire": "CI", "ivory coast": "CI", "democratic republic of the congo": "CD"})


def normalize_country(text: str) -> Optional[str]:
    """« Nigeria », « Nigerian », « NG », « Nigerian fiction » → NG (ou None)."""
    if not text:
        return None
    t = str(text).strip()
    if re.fullmatch(r"[A-Za-z]{2}", t) and t.upper() in tx.COUNTRY_FR:
        return t.upper()
    s = tx.slug(t).replace("-", " ")
    if s in _COUNTRY_ALIASES:
        return _COUNTRY_ALIASES[s]
    for alias, iso in _COUNTRY_ALIASES.items():
        if len(alias) > 4 and (s.startswith(alias + " ") or s.endswith(" " + alias)):
            return iso
    return None


# ---------------------------------------------------------------- Étiquettes
def _add(labels: dict, dim: str, key: str, conf: float, source: str, method: str = "", evidence: str = "", origin: str = ""):
    """Ajoute/renforce une étiquette. `source` : rules|ai|admin|legacy ; `method` : règle ou technique ; `evidence` : justification."""
    if not key or key not in tx.valid_keys(dim):
        return
    k = f"{dim}:{key}"
    cur = labels.get(k)
    conf = round(min(max(conf, 0.0), 1.0), 2)
    if not cur or conf > cur["confidence"]:
        labels[k] = {"confidence": conf, "source": source, "method": method or source, "evidence": evidence[:240], "origins": sorted(set((cur or {}).get("origins", []) + ([origin] if origin else [])))}
    elif origin and origin not in cur.get("origins", []):
        cur["origins"] = sorted(set(cur.get("origins", []) + [origin]))


def _author_conf(a: dict) -> float:
    s = S()
    src, conf = a.get("origin_source") or "", a.get("origin_confidence") or "low"
    if src == "manual":
        return s["w_author_manual"]
    if conf == "high":
        return s["w_author_reliable"]
    if conf == "medium":
        return s["w_author_medium"]
    return s["w_author_ai"]


def rules_classify(book: dict, authors: list[dict]) -> dict:
    """Moteur de règles pondérées. Étiquettes déduites de : origine des auteurs (structuré), catégories sources
    (métadonnées bibliographiques), anciens sujets/genres Manent, langue, mots du résumé (faible)."""
    s = S()
    labels: dict = {}
    # 1. Origine de l'AUTEUR — donnée structurée, poids selon la source de l'origine
    for a in authors:
        iso = (a.get("country") or "").upper()
        if not iso:
            continue
        c = _author_conf(a)
        why = f"Pays de l'auteur {a.get('name') or ''} ({a.get('origin_source') or 'source'})".strip()
        _add(labels, "country", iso, c, "rules", "author_country", why, origin=a.get("origin_source") or "author")
    # 2. Catégories bibliographiques des sources externes
    seen: set = set()
    for raw in book.get("raw_subjects") or []:
        t = tx.slug(raw)
        if not t:
            continue
        iso = normalize_country(raw)
        for marker, outs in tx.RULES:
            m = tx.slug(marker)
            if m and m in t and (m, t) not in seen:
                seen.add((m, t))
                for lab in outs:
                    dim, key = lab.split(":", 1)
                    _add(labels, dim, key, s["w_metadata"], "rules", "source_category", f"Catégorie source « {raw} »", origin="metadata")
        if iso and any(w in t for w in ("fiction", "literature", "litterature", "roman", "novel", "authors", "auteurs")):
            # « Nigerian fiction », « Senegalese literature » : renforce l'origine de l'auteur (sans la créer seule)
            _add(labels, "country", iso, s["w_metadata"] if any(k.startswith("country:") for k in labels) else s["w_description"],
                 "rules", "source_category", f"Catégorie source « {raw} »", origin="metadata")
    # 3. Anciens sujets / genres Manent (compatibilité)
    for sub in book.get("subjects") or []:
        for lab in tx.LEGACY_SUBJECTS.get(sub, []):
            dim, key = lab.split(":", 1)
            _add(labels, dim, key, s["w_legacy"], "legacy", "legacy_subject", f"Sujet Manent « {sub} »", origin="legacy")
    for lab in tx.LEGACY_GENRES.get(book.get("genre") or "", []):
        dim, key = lab.split(":", 1)
        _add(labels, dim, key, s["w_legacy"], "legacy", "legacy_genre", f"Genre Manent « {book.get('genre')} »", origin="legacy")
    if book.get("kind") == "fiction" and not any(k.startswith("type:") for k in labels):
        _add(labels, "type", "roman", s["w_description"] + 0.15, "rules", "kind", "Ouvrage identifié comme fiction")
    if book.get("kind") == "nonfiction" and not any(k.startswith("type:") for k in labels):
        _add(labels, "type", "essai", s["w_description"] + 0.15, "rules", "kind", "Ouvrage identifié comme non-fiction")
    # 4. Langue de l'édition
    lang = (book.get("language") or "").lower()[:2]
    if lang:
        _add(labels, "lang", lang, s["w_author_reliable"], "rules", "language_field", "Langue de l'édition")
    # 5. Mots du résumé → déductions FAIBLES (thèmes/émotions), à confirmer par l'IA ou un humain
    summ = tx.slug(book.get("summary") or "")
    if summ:
        words = summ.split("-")
        grams = words + [f"{a}-{b}" for a, b in zip(words, words[1:])]
        hits: dict = {}
        for g in grams:
            hit = tx.LABEL_INDEX.get(g)
            if hit and len(g) > 4 and hit[0] in ("theme", "emotion", "mood", "story_country", "country"):
                dim, key = hit
                if dim == "country":
                    dim = "story_country"  # un pays cité dans le résumé parle du LIVRE, pas de l'auteur
                hits[(dim, key)] = hits.get((dim, key), 0) + 1
        for (dim, key), n in hits.items():
            _add(labels, dim, key, s["w_description"] if n > 1 else s["w_word"], "rules", "description_keyword",
                 f"Mot « {tx.label_for(dim, key)} » dans le résumé ({n}×)", origin="description")
    return labels


def needs_ai(book: dict, rules: dict) -> tuple[bool, str]:
    """L'IA n'est appelée que si les règles ne suffisent pas (coût maîtrisé)."""
    if not S().get("ai_enabled", True):
        return False, "ai_disabled"
    strong = S()["strong"]
    has = lambda dim: any(k.startswith(dim + ":") and v["confidence"] >= strong for k, v in rules.items())
    if not book.get("summary") and not book.get("raw_subjects"):
        return True, "no_data_try_known_title"
    if has("theme") and has("mood") and has("type"):
        return False, "rules_sufficient"
    return True, "ambiguous_or_incomplete"


# ---------------------------------------------------------------- IA (JSON strict, preuves, cache versionné)
def _keys_block() -> str:
    j = lambda items: ", ".join(items)
    return (
        f"book_type : {j(tx.SUBTYPE_LABEL)}\n"
        f"genre (fiction seulement) : {j(tx.GENRE_LABEL)}\n"
        f"domains : {j(tx.DOMAIN_LABEL)}\n"
        f"themes : {j(tx.THEME_LABEL)}\n"
        f"emotions : {j(tx.EMOTION_LABEL)}\n"
        f"moods : {j(tx.MOOD_LABEL)}\n"
        f"audience : {j(list(tx.AUDIENCE_LABEL) + list(tx.LEVEL_LABEL))}\n"
        f"language (ISO 639-1) : {j(tx.LANGUAGE_LABEL)}\n"
        "country (ISO 3166-1 alpha-2 ; MQ/GP/GF/RE pour Antilles-Guyane-Réunion)"
    )


def ai_system_prompt() -> str:
    return (
        "Tu es un bibliothécaire francophone rigoureux, moteur de classification interne d'une bibliothèque. "
        "On te donne un livre (titre, auteurs, résumé, catégories sources, origine connue des auteurs). Mission : "
        "1) type du livre 2) domaine 3) thèmes 4) émotions 5) ambiance 6) public 7) langue originale "
        "8) contexte géographique de l'HISTOIRE 9) origine de l'AUTEUR, distincte du contexte de l'histoire "
        "10) score de confiance par étiquette 11) preuves utilisées.\n"
        "Renvoie UNIQUEMENT ce JSON :\n"
        "{\"book_type\": [{\"value\": \"…\", \"confidence\": 0.0}], \"genre\": [...], \"domains\": [...], "
        "\"themes\": [...], \"emotions\": [...], \"moods\": [...], \"audience\": [...], "
        "\"language\": {\"value\": \"fr\", \"confidence\": 0.0}, "
        "\"author_origin\": {\"country\": {\"value\": \"ISO2 ou null\", \"confidence\": 0.0}}, "
        "\"story_context\": {\"countries\": [{\"value\": \"ISO2\", \"confidence\": 0.0}]}, "
        "\"evidence\": [{\"classification\": \"deuil\", \"reason\": \"…\"}], \"unknown\": false}\n"
        "Règles : n'utilise QUE les clés listées ci-dessous ; plusieurs étiquettes par dimension sont bienvenues ; "
        "distingue thème (sujet réellement traité, pas une simple mention), émotion (ce que ressent la lectrice) et ambiance (ton) ; "
        "confidence = ta certitude réelle (0.9+ évident, 0.7–0.89 probable, < 0.7 incertain) ; "
        "ne confonds jamais l'origine de l'auteur avec le lieu de l'histoire ; "
        "si tu ne connais pas ce livre, \"unknown\": true et ne renvoie que ce qui est déductible des données fournies ; "
        "n'invente jamais un pays, un public ou un thème absent des données. Aucun texte hors du JSON.\n\n"
        "Clés autorisées :\n" + _keys_block()
    )


def ai_payload(book: dict, authors: list[dict]) -> str:
    ident = f"Titre : {book.get('title')}"
    if book.get("subtitle"):
        ident += f"\nSous-titre : {book['subtitle']}"
    ident += f"\nAuteur(s) : {', '.join(book.get('authors') or []) or 'inconnu'}"
    origins = [tx.COUNTRY_FR.get((a.get("country") or "").upper(), a.get("country")) for a in authors if a.get("country")]
    if origins:
        ident += f"\nOrigine connue des auteurs (donnée vérifiée) : {', '.join(origins)}"
    if book.get("year"):
        ident += f"\nAnnée : {book['year']}"
    if book.get("publisher"):
        ident += f"\nÉditeur : {book['publisher']}"
    if book.get("language"):
        ident += f"\nLangue de l'édition : {book['language']}"
    if book.get("summary"):
        ident += f"\nRésumé : {book['summary'][:1000]}"
    if book.get("raw_subjects"):
        ident += f"\nCatégories sources : {', '.join(book['raw_subjects'][:12])}"
    return ident


def _items(lst, dim: str, labels: dict, evid: dict, prefix_method: str = "ai"):
    for item in lst or []:
        try:
            key, conf = str(item.get("value")), float(item.get("confidence", 0))
        except Exception:
            continue
        if dim in ("country", "story_country"):
            key = normalize_country(key) or ""
        _add(labels, dim, key, conf, "ai", prefix_method, evid.get(key, evid.get(tx.label_for(dim, key), "")), origin="ai")


def parse_ai_result(data: dict) -> dict:
    """Réponse IA → {'labels', 'author_country', 'unknown'} avec preuves rattachées."""
    labels: dict = {}
    evid = {}
    for e in data.get("evidence") or []:
        if isinstance(e, dict) and e.get("classification"):
            evid[str(e["classification"])] = str(e.get("reason") or "")[:240]
            evid[tx.slug(str(e["classification"]))] = evid[str(e["classification"])]
    _items(data.get("book_type"), "type", labels, evid)
    _items(data.get("genre"), "genre", labels, evid)
    _items(data.get("domains"), "domain", labels, evid)
    _items(data.get("themes"), "theme", labels, evid)
    _items(data.get("emotions"), "emotion", labels, evid)
    _items(data.get("moods"), "mood", labels, evid)
    _items(data.get("audience"), "audience", labels, evid)
    lang = data.get("language") or {}
    if isinstance(lang, dict) and lang.get("value"):
        _add(labels, "lang", str(lang["value"]).lower()[:2], float(lang.get("confidence", 0) or 0), "ai", "ai", origin="ai")
    story = (data.get("story_context") or {}).get("countries") or []
    _items(story, "story_country", labels, evid, "ai_story_context")
    ao = ((data.get("author_origin") or {}).get("country") or {})
    author_country = None
    if isinstance(ao, dict) and ao.get("value"):
        iso = normalize_country(str(ao["value"]))
        if iso:
            author_country = (iso, float(ao.get("confidence", 0) or 0))
    return {"labels": labels, "author_country": author_country, "unknown": bool(data.get("unknown"))}


def _input_hash(payload: str) -> str:
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


async def ai_classify(book: dict, authors: list[dict], force: bool = False) -> tuple[Optional[dict], bool]:
    """(résultat parsé ou None, servi_depuis_le_cache). Cache : même contenu + même version de prompt → pas d'appel."""
    payload = ai_payload(book, authors)
    h = _input_hash(payload)
    if not force:
        cached = await db.ai_classifications.find_one({"catalog_id": book["catalog_id"], "input_hash": h, "prompt_version": PROMPT_VERSION}, {"_id": 0, "result": 1})
        if cached and cached.get("result"):
            return parse_ai_result(cached["result"]), True
    data = await provider.classify_book(ai_system_prompt(), payload, book["catalog_id"], PROMPT_VERSION)
    if data is None:
        return None, False
    await db.ai_classifications.update_one(
        {"catalog_id": book["catalog_id"], "prompt_version": PROMPT_VERSION},
        {"$set": {"input_hash": h, "model": provider.model, "result": data, "created_at": now_utc(), "input_preview": payload[:400]}},
        upsert=True)
    return parse_ai_result(data), False


# ---------------------------------------------------------------- Fusion, priorités, dérivations, conflits
STRUCTURED_METHODS = {"author_country", "language_field", "isbn"}


def _derive_geo(labels: dict):
    """Pays → région → continent (même confiance, même preuve), pour l'auteur et pour l'histoire ; sous-type → famille."""
    for dim, rdim, cdim in (("country", "region", "continent"), ("story_country", "story_region", "story_continent")):
        for k, v in list(labels.items()):
            if not k.startswith(dim + ":"):
                continue
            g = tx.geo_for_country(k.split(":", 1)[1])
            if g:
                _add(labels, rdim, g["region"], v["confidence"], v["source"], "derived_geo", v.get("evidence", ""))
                _add(labels, cdim, g["continent"], v["confidence"], v["source"], "derived_geo", v.get("evidence", ""))
    for k, v in list(labels.items()):
        if k.startswith("type:"):
            fam = tx.SUBTYPE_TO_FAMILY.get(k.split(":", 1)[1])
            if fam:
                _add(labels, "type", fam, v["confidence"], v["source"], "derived_family", v.get("evidence", ""))
    if any(k.startswith("genre:") for k in labels) and "type:fiction" not in labels:
        best = max(v["confidence"] for k, v in labels.items() if k.startswith("genre:"))
        _add(labels, "type", "roman", best, "rules", "derived_from_genre", "Genre de fiction détecté")
        _add(labels, "type", "fiction", best, "rules", "derived_from_genre", "Genre de fiction détecté")


def merge_labels(rules: dict, ai: Optional[dict], overrides: dict) -> tuple[dict, list]:
    """Retourne (étiquettes fusionnées, conflits). Ordre de priorité : admin > structuré > règles > accord > IA > faible."""
    s = S()
    labels: dict = {k: dict(v) for k, v in rules.items()}
    conflicts: list = []
    if ai:
        for k, v in ai["labels"].items():
            dim, _, key = k.partition(":")
            if key not in tx.valid_keys(dim):
                continue
            cur = labels.get(k)
            if not cur:
                labels[k] = dict(v)
            elif cur.get("method") in STRUCTURED_METHODS:
                cur["confidence"] = round(min(1.0, cur["confidence"] + s["w_agreement_bonus"]), 2)  # accord avec une donnée structurée
                cur["origins"] = sorted(set(cur.get("origins", []) + ["ai"]))
            else:
                # sources concordantes : on prend la meilleure et on ajoute un bonus d'accord
                best = max(cur["confidence"], v["confidence"])
                cur.update({"confidence": round(min(1.0, best + s["w_agreement_bonus"]), 2),
                            "evidence": v.get("evidence") or cur.get("evidence", ""),
                            "method": cur["method"] if cur["confidence"] >= v["confidence"] else v["method"],
                            "origins": sorted(set(cur.get("origins", []) + ["ai"]))})
        # origine de l'auteur selon l'IA : jamais prioritaire sur une donnée structurée ; conflit signalé
        ac = ai.get("author_country")
        if ac:
            iso, conf = ac
            structured = [k.split(":", 1)[1] for k, v in labels.items() if k.startswith("country:") and v.get("method") == "author_country"]
            if structured and iso not in structured:
                if conf >= s["proposed"]:
                    conflicts.append({"dim": "country", "structured": structured, "ai": iso, "ai_confidence": conf,
                                      "note": "L'IA propose une autre origine d'auteur que la donnée structurée ; donnée structurée conservée."})
            elif not structured:
                _add(labels, "country", iso, min(conf, s["w_author_ai"]), "ai", "ai_author_origin", "Origine de l'auteur estimée par l'IA", origin="ai")
    for k in overrides.get("remove") or []:
        labels.pop(k, None)
    for k in overrides.get("add") or []:
        dim, _, key = k.partition(":")
        if key in tx.valid_keys(dim):
            labels[k] = {"confidence": 1.0, "source": "admin", "method": "human_validation", "evidence": "Validé par l'administration", "origins": ["admin"]}
    _derive_geo(labels)
    for k in overrides.get("remove") or []:  # les suppressions admin priment aussi sur les dérivations
        labels.pop(k, None)
    return labels, conflicts


def flatten(labels: dict) -> dict:
    """Champs `f_*` (≥ proposed) + document `classification` lisible (toutes les étiquettes, avec preuves)."""
    s = S()
    out: dict = {f: [] for f in FIELD.values()}
    items = []
    for k, v in labels.items():
        dim, _, key = k.partition(":")
        conf = v["confidence"]
        items.append({"dim": dim, "key": key, "label": tx.label_for(dim, key), "confidence": conf,
                      "strong": conf >= s["strong"], "proposed": s["proposed"] <= conf < s["strong"],
                      "source": v["source"], "method": v.get("method", v["source"]), "evidence": v.get("evidence", ""),
                      "origins": v.get("origins", [])})
        if conf >= s["proposed"] and dim in FIELD:
            out[FIELD[dim]].append(key)
    for f in FIELD.values():
        out[f] = sorted(set(out[f]))
    order = {d: i for i, d in enumerate(DISPLAY_ORDER)}
    items.sort(key=lambda x: (order.get(x["dim"], 99), -x["confidence"], x["label"]))
    ok = [x for x in items if x["confidence"] >= s["proposed"]]
    fam = next((x["key"] for x in ok if x["dim"] == "type" and x["key"] in tx.FAMILY_LABEL), None)
    sub = next((x["key"] for x in ok if x["dim"] == "type" and x["key"] in tx.SUBTYPE_LABEL), None)
    gen = next((x["key"] for x in ok if x["dim"] == "genre"), None)
    filt = [x["confidence"] for x in ok if x["dim"] in ("type", "theme", "country", "domain")]
    out["classification"] = {
        "labels": items,
        "type": {"family": fam, "subtype": sub, "genre": gen},
        "author_geo": {"continents": out["f_continents"], "regions": out["f_regions"], "countries": out["f_countries"]},
        "story_geo": {"continents": out["f_story_continents"], "regions": out["f_story_regions"], "countries": out["f_story_countries"]},
        "geo": {"continents": out["f_continents"], "regions": out["f_regions"], "countries": out["f_countries"]},  # compat
        "themes": out["f_themes"], "domains": out["f_domains"], "emotions": out["f_emotions"], "moods": out["f_moods"],
        "audience": out["f_audience"], "languages": out["f_lang"],
        "score": round(sum(filt) / len(filt), 2) if filt else 0.0,   # confiance globale (dimensions structurantes)
        "n_strong": sum(1 for x in ok if x["strong"]), "n_proposed": sum(1 for x in ok if x["proposed"]),
        "n_weak": len(items) - len(ok),
    }
    return out


# Genre nouveau → ancien genre (pages /genre/* existantes) ; thème → ancien sujet (pages /theme/*)
_GENRE_BACK = {"polar": "polar", "imaginaire": "imaginaire", "dystopie": "imaginaire", "romance": "romance",
               "contemporain": "litterature", "historique": "litterature", "classique": "litterature",
               "feel-good": "litterature", "aventure": "litterature", "humour": "litterature"}
_THEME_BACK: dict = {}
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
    return upd, sorted(subjects - set(book.get("subjects") or []))


async def _authors_of(book: dict) -> list[dict]:
    ids = book.get("author_ids") or []
    if not ids:
        return []
    return await db.catalog_authors.find({"author_id": {"$in": ids}},
                                         {"_id": 0, "name": 1, "country": 1, "origin_confidence": 1, "origin_source": 1}).to_list(10)


async def _ai_quota_ok() -> bool:
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    doc = await db.meta.find_one({"key": key}, {"_id": 0, "n": 1})
    return (doc or {}).get("n", 0) < S()["daily_limit"]


async def _ai_quota_use():
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    await db.meta.update_one({"key": key}, {"$inc": {"n": 1}, "$set": {"at": now_utc()}}, upsert=True)


async def classify_book(catalog_id: str, use_ai: bool = True, force_ai: bool = False, reason: str = "task") -> Optional[dict]:
    """Pipeline complet pour un livre. Journalisé dans classification_logs."""
    t0 = time.monotonic()
    book = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not book:
        return None
    prev = book.get("classification") or {}
    authors = await _authors_of(book)
    rules = rules_classify(book, authors)
    ai, ai_cached, ai_reason, ai_called = None, False, "not_requested", False
    ai_done = bool(prev.get("ai_version"))
    if use_ai and (force_ai or not ai_done):
        want, ai_reason = needs_ai(book, rules)
        if force_ai:
            want, ai_reason = True, "forced"
        if want and provider.available:
            if await _ai_quota_ok():
                await _ai_quota_use()
                ai_called = True
                ai, ai_cached = await ai_classify(book, authors, force=force_ai)
            else:
                ai_reason = "quota_reached"
        elif want:
            ai_reason = "provider_unavailable"
    if ai is None and ai_done and not force_ai:
        # réutilise les étiquettes IA stockées (cache) : jamais de nouvel appel pour un simple recalcul
        cached = await db.ai_classifications.find_one({"catalog_id": catalog_id}, {"_id": 0, "result": 1}, sort=[("created_at", -1)])
        if cached and cached.get("result"):
            ai, ai_cached, ai_reason = parse_ai_result(cached["result"]), True, "cached"
    overrides = book.get("overrides") or {}
    labels, conflicts = merge_labels(rules, ai, overrides)
    flat = flatten(labels)
    legacy, add_subjects = _legacy_sync(book, flat)
    cls = flat.pop("classification")
    ai_version = PROMPT_VERSION if ai is not None else prev.get("ai_version")
    cls.update({
        "source": "admin" if (overrides.get("add") or overrides.get("remove")) else ("ai" if ai and ai["labels"] else "rules"),
        "classified_at": now_utc(), "engine_version": ENGINE_VERSION, "ai_version": ai_version,
        "ai_model": provider.model if ai is not None else prev.get("ai_model"),
        "ai_reason": ai_reason, "ai_unknown": bool(ai and ai.get("unknown")),
        # sans IA faute de quota/fournisseur : à retenter ; une correction admin ne fait pas perdre ce statut
        "ai_pending": bool(use_ai and ai is None and not ai_done and ai_reason in ("quota_reached", "provider_unavailable"))
                      or bool(not use_ai and not ai_done and prev.get("ai_pending")),
        "conflicts": conflicts,
        "needs_review": bool(conflicts) or (cls_score_low(flat, cls)),
    })
    upd = {**flat, "classification": cls, "updated_at": now_utc(), **legacy}
    ops: dict = {"$set": upd}
    if add_subjects:
        ops["$addToSet"] = {"subjects": {"$each": add_subjects}}
    await db.catalog_books.update_one({"catalog_id": catalog_id}, ops)
    try:
        await db.classification_logs.insert_one({
            "catalog_id": catalog_id, "reason": reason, "engine_version": ENGINE_VERSION, "prompt_version": PROMPT_VERSION,
            "ai_called": ai_called, "ai_cached": ai_cached, "ai_reason": ai_reason, "n_rules": len(rules),
            "n_ai": len(ai["labels"]) if ai else 0, "n_final": len(labels), "score": cls["score"], "conflicts": len(conflicts),
            "duration_ms": int((time.monotonic() - t0) * 1000), "ok": True, "at": now_utc()})
    except Exception:
        pass
    return cls


def cls_score_low(flat: dict, cls: dict) -> bool:
    return bool(cls.get("score", 0) and cls["score"] < S()["proposed"]) or (not flat["f_types"] and not flat["f_themes"])


# ---------------------------------------------------------------- File d'attente (catalog_tasks, kind classify)
async def enqueue(catalog_id: str, reason: str = "new"):
    await db.catalog_tasks.update_one(
        {"catalog_id": catalog_id, "kind": "classify", "status": {"$in": ["pending", "running"]}},
        {"$setOnInsert": {"status": "pending", "tries": 0, "created_at": now_utc(), "reason": reason}}, upsert=True)


async def process_tasks(limit: int = 4) -> int:
    tasks = await db.catalog_tasks.find({"status": "pending", "kind": "classify"}).sort("created_at", 1).to_list(limit)
    for t in tasks:
        await db.catalog_tasks.update_one({"_id": t["_id"]}, {"$set": {"status": "running", "started_at": now_utc()}})
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
            await classify_book(t["catalog_id"], use_ai=True, force_ai=t.get("reason") == "reclassify", reason=t.get("reason", "task"))
            await db.catalog_tasks.delete_one({"_id": t["_id"]})
        except Exception as e:
            logger.warning("classify task failed (%s): %s", t.get("catalog_id"), e)
            try:
                await db.classification_logs.insert_one({"catalog_id": t["catalog_id"], "reason": t.get("reason"), "ok": False,
                                                         "error": str(e)[:300], "engine_version": ENGINE_VERSION, "at": now_utc()})
            except Exception:
                pass
            failed = t.get("tries", 0) >= 3
            await db.catalog_tasks.update_one({"_id": t["_id"]}, {"$set": {"status": "failed" if failed else "pending", "error": str(e)[:200]}, "$inc": {"tries": 1}})
    return len(tasks)


async def retry_ai_pending(n: int = 20):
    """Chaque heure : livres classés par règles seules faute de quota IA, remis en file si le quota le permet."""
    if not await _ai_quota_ok():
        return
    async for b in db.catalog_books.find({"classification.ai_pending": True}, {"_id": 0, "catalog_id": 1}).limit(n):
        await enqueue(b["catalog_id"], "retry_ai")


async def backfill():
    """Migration progressive : chaque livre existant passe par la file (rien n'est supprimé)."""
    key = f"classification_backfill_{ENGINE_VERSION}"
    if await db.meta.find_one({"key": key}):
        return
    await db.meta.update_one({"key": key}, {"$set": {"at": now_utc()}}, upsert=True)
    n = 0
    async for b in db.catalog_books.find({"$or": [{"classification": {"$exists": False}}, {"classification.engine_version": {"$ne": ENGINE_VERSION}}]},
                                         {"_id": 0, "catalog_id": 1}).sort("popularity", -1):
        await enqueue(b["catalog_id"], "backfill")
        n += 1
    logger.info("classification backfill (%s): %s livres en file", ENGINE_VERSION, n)


async def load_taxonomy_extensions():
    n = 0
    async for e in db.taxonomy_ext.find({}, {"_id": 0}).sort("created_at", 1):
        if tx.register(e["dim"], e.get("key"), e["label"], e.get("group"), e.get("emoji"), e.get("parent")):
            n += 1
    if n:
        logger.info("taxonomy extensions: %s entrées", n)


async def init(database):
    global db
    db = database
    provider.db = database
    await load_settings()
    await load_taxonomy_extensions()
    for f in FIELD.values():
        await db.catalog_books.create_index(f)
    await db.catalog_books.create_index("classification.ai_pending")
    await db.catalog_books.create_index("classification.needs_review")
    await db.catalog_books.create_index("classification.score")
    await db.catalog_books.create_index([("popularity", -1)])
    await db.ai_classifications.create_index([("catalog_id", 1), ("prompt_version", 1)])
    await db.classification_logs.create_index([("at", -1)])
    await db.classification_feedback.create_index([("created_at", -1)])
    await db.ai_calls.create_index([("at", -1)])
    await db.taxonomy_ext.create_index([("dim", 1), ("key", 1)], unique=True)


# ---------------------------------------------------------------- Présentation
def lines(b: dict) -> list[dict]:
    """Lignes de classification pour les cartes et fiches : [{icon, text}] (max 5)."""
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
    geo = cls.get("author_geo") or cls.get("geo") or {}
    gparts = [tx.COUNTRY_FR.get(c, c) for c in (geo.get("countries") or [])[:2]]
    if not gparts and geo.get("regions"):
        gparts = [tx.REGION_LABEL.get(geo["regions"][0], geo["regions"][0])]
    if gparts:
        cont = (geo.get("continents") or [None])[0]
        out.append({"icon": "🌍", "text": (tx.CONTINENT_LABEL.get(cont, "") + " · " if cont else "") + " · ".join(gparts)})
    sg = cls.get("story_geo") or {}
    sparts = [tx.COUNTRY_FR.get(c, c) for c in (sg.get("countries") or [])[:2] if c not in (geo.get("countries") or [])]
    if sparts:
        out.append({"icon": "📍", "text": " · ".join(sparts)})
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
        "levels": [{"key": k, "label": l} for k, l in tx.LEVELS],
        "languages": [{"key": k, "label": l} for k, l in tx.LANGUAGES],
        "labels": {d: {k: tx.label_for(d, k) for k in tx.valid_keys(d)} for d in QUERY_DIMS},
        "thresholds": {"strong": S()["strong"], "proposed": S()["proposed"]},
    }


# ---------------------------------------------------------------- Filtres et navigation
def build_filter(sel: dict) -> dict:
    """{dim: [keys]} → filtre Mongo : OU dans une dimension, ET entre dimensions."""
    flt: dict = {}
    for dim, keys in sel.items():
        keys = [k for k in (keys or []) if k]
        if keys and dim in FIELD:
            flt[FIELD[dim]] = {"$in": keys}
    # géographie : un pays choisi rend la région/le continent redondants (le plus précis gagne)
    for c, r, k in (("f_countries", "f_regions", "f_continents"), ("f_story_countries", "f_story_regions", "f_story_continents")):
        if c in flt:
            flt.pop(r, None); flt.pop(k, None)
        elif r in flt:
            flt.pop(k, None)
    return flt


def selected_chips(sel: dict) -> list[dict]:
    return [{"dim": dim, "key": k, "label": tx.label_for(dim, k)} for dim in QUERY_DIMS for k in (sel.get(dim) or [])]


SORTS = {"pertinence": [("popularity", -1), ("classification.score", -1), ("updated_at", -1)], "populaires": [("popularity", -1)],
         "recents": [("created_at", -1)], "titre": [("title", 1)], "annee": [("year", -1)]}


def _sel_from_params(**kw) -> dict:
    sel = {}
    for dim in QUERY_DIMS:
        flat: list[str] = []
        for v in kw.get(dim) or []:
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
                 story_continent: list[str] = Query(default=[]), story_region: list[str] = Query(default=[]), story_country: list[str] = Query(default=[]),
                 type: list[str] = Query(default=[]), genre: list[str] = Query(default=[]), domain: list[str] = Query(default=[]),
                 theme: list[str] = Query(default=[]), emotion: list[str] = Query(default=[]), mood: list[str] = Query(default=[]),
                 audience: list[str] = Query(default=[]), lang: list[str] = Query(default=[])):
    from routes.catalog import _card
    sel = _sel_from_params(continent=continent, region=region, country=country, story_continent=story_continent,
                           story_region=story_region, story_country=story_country, type=type, genre=genre, domain=domain,
                           theme=theme, emotion=emotion, mood=mood, audience=audience, lang=lang)
    flt = build_filter(sel)
    if q and q.strip():
        flt["$text"] = {"$search": q.strip()[:120]}
    exact_total = await db.catalog_books.count_documents(flt)
    if count_only:
        return {"total": exact_total, "chips": selected_chips(sel)}
    size = min(max(size, 1), 40)
    skip = max(page - 1, 0) * size
    fields = {k: v["$in"] for k, v in flt.items() if k != "$text"}
    if sort == "pertinence" and len(fields) >= 2 and "$text" not in flt:
        # Pertinence : d'abord les livres qui remplissent TOUS les filtres, puis ceux qui en remplissent
        # le plus grand nombre (score = nombre de dimensions satisfaites) — la liste ne s'arrête jamais
        # aux seules correspondances exactes.
        conds = [{"$cond": [{"$gt": [{"$size": {"$setIntersection": [{"$ifNull": [f"${f}", []]}, keys]}}, 0]}, 1, 0]} for f, keys in fields.items()]
        base = {"$or": [{f: {"$in": keys}} for f, keys in fields.items()]}
        pipe = [{"$match": base}, {"$addFields": {"match_score": {"$add": conds}, "match_of": len(fields)}},
                {"$sort": {"match_score": -1, "popularity": -1, "classification.score": -1, "updated_at": -1}},
                {"$skip": skip}, {"$limit": size}, {"$project": {"_id": 0}}]
        docs = await db.catalog_books.aggregate(pipe).to_list(size)
        total = await db.catalog_books.count_documents(base)
        return {"results": [_card(b) | {"match_score": b.get("match_score"), "match_of": b.get("match_of")} for b in docs],
                "total": total, "exact_total": exact_total, "page": page, "size": size, "chips": selected_chips(sel), "filters": sel, "sort": sort}
    if "$text" in flt and sort == "pertinence":
        cur = db.catalog_books.find(flt, {"_id": 0, "score": {"$meta": "textScore"}}).sort([("score", {"$meta": "textScore"})])
    else:
        cur = db.catalog_books.find(flt, {"_id": 0}).sort(SORTS.get(sort, SORTS["pertinence"]))
    docs = await cur.skip(skip).limit(size).to_list(size)
    return {"results": [_card(b) for b in docs], "total": exact_total, "exact_total": exact_total, "page": page, "size": size,
            "chips": selected_chips(sel), "filters": sel, "sort": sort}


# ---------------------------------------------------------------- Recherche par intention (parseSearchIntent)
def intent_system_prompt() -> str:
    return (
        "Tu transformes une demande de lecture en critères de recherche structurés. Renvoie UNIQUEMENT ce JSON : "
        "{\"filters\": {\"theme\": [..], \"emotion\": [..], \"mood\": [..], \"type\": [..], \"genre\": [..], \"domain\": [..], "
        "\"audience\": [..], \"continent\": [..], \"country\": [..ISO2..], \"story_continent\": [..], \"story_country\": [..ISO2..], \"lang\": [..]}, "
        "\"interpretation\": \"phrase courte en français\", \"search_mode\": \"semantic\"}. "
        "continent/country = origine de l'AUTEUR (« roman africain », « auteur nigérian ») ; story_* = lieu de l'HISTOIRE (« qui se passe au Sénégal »). "
        "Utilise UNIQUEMENT les clés autorisées ci-dessous, 1 à 4 étiquettes par dimension pertinente, omets les dimensions non concernées. "
        "« triste mais qui redonne espoir » → emotion tristesse + espoir, mood emouvant + reconfortant. Pas de mots libres. Aucun texte hors du JSON.\n\n"
        "Clés autorisées :\n" + _keys_block() + "\ncontinent : " + ", ".join(tx.CONTINENT_LABEL)
    )


def keyword_intent(text: str) -> dict:
    """Repli déterministe : mots et bigrammes du texte → étiquettes du référentiel (pays cité = origine d'auteur)."""
    words = tx.slug(text).split("-")
    sel: dict = {}
    for g in words + [f"{a}-{b}" for a, b in zip(words, words[1:])]:
        hit = tx.LABEL_INDEX.get(g)
        if hit and len(g) > 3:
            sel.setdefault(hit[0], [])
            if hit[1] not in sel[hit[0]]:
                sel[hit[0]].append(hit[1])
    return sel


async def parse_search_intent(text: str) -> dict:
    """Service interne : texte libre → {filters, interpretation, source}."""
    sel: dict = {}
    interp = None
    source = "keywords"
    if provider.available and S().get("ai_enabled", True) and await _ai_quota_ok():
        await _ai_quota_use()
        data = await provider.parse_search_intent(intent_system_prompt(), text)
        if data:
            for dim, keys in (data.get("filters") or {}).items():
                dim = "lang" if dim == "language" else dim
                if dim in QUERY_DIMS and isinstance(keys, list):
                    ok = []
                    for k in keys:
                        k = str(k)
                        if dim.endswith("country"):
                            k = normalize_country(k) or k
                        if k in tx.valid_keys(dim):
                            ok.append(k)
                    if ok:
                        sel[dim] = ok[:4]
            interp = (data.get("interpretation") or "")[:160] or None
            if sel:
                source = "ai"
    if not sel:
        sel = keyword_intent(text)
    return {"filters": sel, "interpretation": interp, "source": source}


class IntentBody(BaseModel):
    text: str = Field(min_length=3, max_length=300)


@router.post("/intent")
async def intent_search(body: IntentBody):
    from routes.catalog import _card
    text = body.text.strip()
    parsed = await parse_search_intent(text)
    sel = parsed["filters"]
    flt = build_filter(sel)
    docs, total = [], 0
    if flt:
        total = await db.catalog_books.count_documents(flt)
        docs = await db.catalog_books.find(flt, {"_id": 0}).sort(SORTS["pertinence"]).limit(20).to_list(20)
        # trop peu de résultats : relâchement CUMULATIF (on retire une dimension après l'autre,
        # thèmes et émotions en dernier) jusqu'à obtenir au moins 3 livres
        if total < 3 and len(sel) > 1:
            relaxed = dict(sel)
            for drop in ("lang", "audience", "story_country", "story_region", "story_continent", "country", "region", "continent",
                         "genre", "type", "domain", "mood", "emotion"):
                if drop in relaxed and len(relaxed) > 1:
                    relaxed = {k: v for k, v in relaxed.items() if k != drop}
                    f2 = build_filter(relaxed)
                    t2 = await db.catalog_books.count_documents(f2)
                    if t2 >= 3:
                        sel, flt, total = relaxed, f2, t2
                        docs = await db.catalog_books.find(f2, {"_id": 0}).sort(SORTS["pertinence"]).limit(20).to_list(20)
                        break
    return {"filters": sel, "chips": selected_chips(sel), "interpretation": parsed["interpretation"], "source": parsed["source"],
            "search_mode": "semantic", "results": [_card(b) for b in docs], "total": total}


def labels_in_query(q: str) -> dict:
    """Recherche classique : « polar sénégalais », « deuil » → filtres (mots entiers du référentiel uniquement)."""
    return keyword_intent(q)


# ---------------------------------------------------------------- Admin : livre
async def _admin_user(authorization: Optional[str]) -> dict:
    if resolve_user is None:
        return {}
    try:
        return await resolve_user(authorization)
    except Exception:
        return {}


class OverrideBody(BaseModel):
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)
    confirm: list[str] = Field(default_factory=list)


def _admin_view(b: dict) -> dict:
    from routes.catalog import _card
    return {**_card(b), "classification": b.get("classification") or {}, "overrides": b.get("overrides") or {"add": [], "remove": []},
            "raw_subjects": b.get("raw_subjects") or [], "lines": lines(b), "thresholds": {"strong": S()["strong"], "proposed": S()["proposed"]}}


# ---------------------------------------------------------------- Admin : lots, tableau de bord, réglages, taxonomie
class BatchBody(BaseModel):
    mode: str = Field(pattern="^(new|low_confidence|outdated|failed|review)$")
    limit: int = Field(default=500, ge=1, le=5000)


@admin_router.post("/classification/batch")
async def admin_batch(body: BatchBody):
    """Lance un lot : nouveaux livres, faible confiance, ancienne version du moteur, tâches en échec, à vérifier."""
    if body.mode == "failed":
        r = await db.catalog_tasks.update_many({"kind": "classify", "status": "failed"}, {"$set": {"status": "pending", "tries": 0}})
        return {"queued": r.modified_count, "mode": body.mode}
    flt = {"new": {"classification": {"$exists": False}},
           "low_confidence": {"classification.score": {"$lt": S()["proposed"]}},
           "outdated": {"classification.engine_version": {"$ne": ENGINE_VERSION}},
           "review": {"classification.needs_review": True}}[body.mode]
    n = 0
    async for b in db.catalog_books.find(flt, {"_id": 0, "catalog_id": 1}).sort("popularity", -1).limit(body.limit):
        await enqueue(b["catalog_id"], "reclassify" if body.mode != "new" else "batch_new")
        n += 1
    return {"queued": n, "mode": body.mode}


@admin_router.get("/classification-stats")
async def admin_classification_stats():
    s = S()
    total = await db.catalog_books.count_documents({})
    classified = await db.catalog_books.count_documents({"classification": {"$exists": True}})
    ai = await db.catalog_books.count_documents({"classification.ai_version": {"$ne": None}})
    low = await db.catalog_books.count_documents({"classification.score": {"$lt": s["proposed"]}})
    review = await db.catalog_books.count_documents({"classification.needs_review": True})
    pending = await db.catalog_tasks.count_documents({"kind": "classify", "status": {"$in": ["pending", "running"]}})
    failed = await db.catalog_tasks.count_documents({"kind": "classify", "status": "failed"})
    outdated = await db.catalog_books.count_documents({"classification": {"$exists": True}, "classification.engine_version": {"$ne": ENGINE_VERSION}})
    key = f"classify_quota_{now_utc().strftime('%Y%m%d')}"
    used = ((await db.meta.find_one({"key": key}, {"_id": 0, "n": 1})) or {}).get("n", 0)
    calls = await db.ai_calls.aggregate([{"$group": {"_id": "$kind", "n": {"$sum": 1}, "ok": {"$sum": {"$cond": ["$ok", 1, 0]}},
                                                     "avg_ms": {"$avg": "$duration_ms"}}}]).to_list(20)
    ai_calls = {c["_id"]: {"n": c["n"], "ok": c["ok"], "success_rate": round(c["ok"] / c["n"], 3) if c["n"] else None, "avg_ms": int(c["avg_ms"] or 0)} for c in calls}
    top = lambda field: db.catalog_books.aggregate([{"$unwind": f"${field}"}, {"$group": {"_id": f"${field}", "n": {"$sum": 1}}},
                                                    {"$sort": {"n": -1}}, {"$limit": 10}]).to_list(10)
    top_themes = [{"key": x["_id"], "label": tx.label_for("theme", x["_id"]), "n": x["n"]} for x in await top("f_themes")]
    top_types = [{"key": x["_id"], "label": tx.label_for("type", x["_id"]), "n": x["n"]} for x in await top("f_types")]
    top_countries = [{"key": x["_id"], "label": tx.label_for("country", x["_id"]), "n": x["n"]} for x in await top("f_countries")]
    corrections = await db.classification_feedback.count_documents({})
    freq = await db.classification_feedback.aggregate([{"$group": {"_id": {"label": "$label", "action": "$action"}, "n": {"$sum": 1}}},
                                                       {"$sort": {"n": -1}}, {"$limit": 8}]).to_list(8)
    frequent_errors = [{"label": x["_id"]["label"], "action": x["_id"]["action"], "n": x["n"]} for x in freq]
    logs = await db.classification_logs.aggregate([{"$match": {"ok": True}}, {"$group": {"_id": None, "n": {"$sum": 1}, "avg_ms": {"$avg": "$duration_ms"}}}]).to_list(1)
    return {"total": total, "classified": classified, "unclassified": total - classified, "ai": ai, "low_confidence": low,
            "needs_review": review, "pending": pending, "failed": failed, "outdated": outdated,
            "quota_used": used, "quota_limit": s["daily_limit"], "engine_version": ENGINE_VERSION, "prompt_version": PROMPT_VERSION,
            "model": provider.model, "provider": provider.name, "ai_available": provider.available, "ai_calls": ai_calls,
            "runs": {"n": (logs[0]["n"] if logs else 0), "avg_ms": int((logs[0]["avg_ms"] or 0) if logs else 0)},
            "top_themes": top_themes, "top_types": top_types, "top_countries": top_countries,
            "corrections": corrections, "frequent_errors": frequent_errors, "thresholds": {"strong": s["strong"], "proposed": s["proposed"]}}


@admin_router.get("/classification/review")
async def admin_review_list(page: int = 1, size: int = 20):
    """Livres à vérifier : conflits ou faible confiance, les plus populaires d'abord."""
    from routes.catalog import _card
    size = min(max(size, 1), 50)
    flt = {"classification.needs_review": True}
    total = await db.catalog_books.count_documents(flt)
    docs = await db.catalog_books.find(flt, {"_id": 0}).sort("popularity", -1).skip((max(page, 1) - 1) * size).limit(size).to_list(size)
    return {"books": [_card(b) | {"conflicts": (b.get("classification") or {}).get("conflicts", []), "score": (b.get("classification") or {}).get("score")} for b in docs],
            "total": total, "page": page, "size": size}


class SettingsBody(BaseModel):
    strong: Optional[float] = Field(default=None, ge=0.5, le=1.0)
    proposed: Optional[float] = Field(default=None, ge=0.3, le=1.0)
    ai_enabled: Optional[bool] = None
    daily_limit: Optional[int] = Field(default=None, ge=0, le=100000)
    weights: Optional[dict[str, float]] = None


@admin_router.get("/classification/settings")
async def admin_get_settings():
    return {"settings": S(), "defaults": DEFAULT_SETTINGS, "engine_version": ENGINE_VERSION, "prompt_version": PROMPT_VERSION}


@admin_router.patch("/classification/settings")
async def admin_patch_settings(body: SettingsBody):
    doc = await db.meta.find_one({"key": "classification_settings"}, {"_id": 0, "values": 1})
    vals = dict((doc or {}).get("values") or {})
    for k in ("strong", "proposed", "ai_enabled", "daily_limit"):
        v = getattr(body, k)
        if v is not None:
            vals[k] = v
    for k, v in (body.weights or {}).items():
        if k in DEFAULT_SETTINGS and k.startswith("w_"):
            vals[k] = float(min(max(v, 0.0), 1.0))
    if vals.get("proposed", DEFAULT_SETTINGS["proposed"]) > vals.get("strong", DEFAULT_SETTINGS["strong"]):
        raise HTTPException(status_code=422, detail="proposed_above_strong")
    await db.meta.update_one({"key": "classification_settings"}, {"$set": {"values": vals, "at": now_utc()}}, upsert=True)
    await load_settings()
    return {"settings": S()}


# ---------------------------------------------------------------- Admin : livre (routes dynamiques, déclarées après les statiques)
@admin_router.get("/classification/{catalog_id}")
async def admin_get_classification(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if not b.get("classification"):
        await classify_book(catalog_id, use_ai=False, reason="admin_view")
        await enqueue(catalog_id, "admin_view")
        b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    return _admin_view(b)


@admin_router.patch("/classification/{catalog_id}")
async def admin_patch_classification(catalog_id: str, body: OverrideBody, authorization: Optional[str] = Header(None)):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0, "overrides": 1, "classification": 1})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    admin = await _admin_user(authorization)
    prev = {f"{x['dim']}:{x['key']}": x for x in (b.get("classification") or {}).get("labels", [])}
    ov = b.get("overrides") or {"add": [], "remove": []}
    add, remove = set(ov.get("add") or []), set(ov.get("remove") or [])
    feedback = []
    for k in list(body.add) + list(body.confirm):
        dim, _, key = k.partition(":")
        if key not in tx.valid_keys(dim):
            raise HTTPException(status_code=422, detail=f"invalid_label:{k}")
        add.add(k); remove.discard(k)
        p = prev.get(k)
        feedback.append({"label": k, "action": "confirm" if p else "add", "previous_value": (p or {}).get("confidence"),
                         "previous_source": (p or {}).get("source"), "corrected_value": 1.0})
    for k in body.remove:
        remove.add(k); add.discard(k)
        p = prev.get(k)
        feedback.append({"label": k, "action": "remove", "previous_value": (p or {}).get("confidence"),
                         "previous_source": (p or {}).get("source"), "corrected_value": None})
    await db.catalog_books.update_one({"catalog_id": catalog_id}, {"$set": {
        "overrides": {"add": sorted(add), "remove": sorted(remove), "updated_at": now_utc()}}})
    if feedback:
        # jeu de données de corrections humaines (amélioration future des règles/prompts ; pas d'entraînement automatique)
        await db.classification_feedback.insert_many([{**f, "catalog_id": catalog_id, "admin_id": admin.get("user_id"),
                                                       "engine_version": ENGINE_VERSION, "prompt_version": PROMPT_VERSION,
                                                       "created_at": now_utc()} for f in feedback])
    await classify_book(catalog_id, use_ai=False, reason="admin_override")
    return _admin_view(await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0}))


@admin_router.post("/classification/{catalog_id}/reclassify")
async def admin_reclassify(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0, "catalog_id": 1})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if not await _ai_quota_ok():
        raise HTTPException(status_code=429, detail="classify_quota_reached")
    cls = await classify_book(catalog_id, use_ai=True, force_ai=True, reason="admin_reclassify")
    return _admin_view(await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})) | {"ai_ok": bool(cls and cls.get("ai_reason") in ("forced",) and cls.get("ai_version"))}


class TaxonomyEntry(BaseModel):
    dim: str
    label: str = Field(min_length=1, max_length=60)
    key: Optional[str] = Field(default=None, max_length=40)
    group: Optional[str] = Field(default=None, max_length=40)
    emoji: Optional[str] = Field(default=None, max_length=8)
    parent: Optional[str] = Field(default=None, max_length=40)


@admin_router.get("/taxonomy")
async def admin_taxonomy():
    custom = await db.taxonomy_ext.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"custom": custom, "dims": list(tx.EXTENDABLE),
            "parents": {"region": [{"key": c["key"], "label": c["label"]} for c in tx.GEO],
                        "country": [{"key": r["key"], "label": r["label"]} for c in tx.GEO for r in c["regions"]],
                        "type": [{"key": f["key"], "label": f["label"]} for f in tx.TYPES]},
            "groups": {"theme": [{"key": g["key"], "label": g["label"]} for g in tx.THEMES],
                       "domain": [{"key": g["key"], "label": g["label"]} for g in tx.DOMAINS]}}


@admin_router.post("/taxonomy")
async def admin_taxonomy_add(body: TaxonomyEntry):
    if body.dim not in tx.EXTENDABLE:
        raise HTTPException(status_code=422, detail="invalid_dim")
    key = (body.key or tx.slug(body.label)).strip()
    if body.dim == "country":
        key = key.upper()
        if not re.fullmatch(r"[A-Z]{2}", key):
            raise HTTPException(status_code=422, detail="country_key_iso2")
    if key in tx.valid_keys(body.dim):
        raise HTTPException(status_code=409, detail="already_exists")
    if not tx.register(body.dim, key, body.label, body.group, body.emoji, body.parent):
        raise HTTPException(status_code=422, detail="invalid_parent_or_group")
    entry = {"dim": body.dim, "key": key, "label": body.label.strip(), "group": body.group, "emoji": body.emoji, "parent": body.parent, "created_at": now_utc()}
    await db.taxonomy_ext.update_one({"dim": body.dim, "key": key}, {"$set": entry}, upsert=True)
    return {"ok": True, "entry": entry}


@admin_router.delete("/taxonomy/{dim}/{key}")
async def admin_taxonomy_delete(dim: str, key: str):
    """Retire une entrée ajoutée depuis l'admin (les entrées de base ne sont pas supprimables ; les livres gardent leurs autres étiquettes)."""
    r = await db.taxonomy_ext.delete_one({"dim": dim, "key": key})
    if not r.deleted_count:
        raise HTTPException(status_code=404, detail="not_custom_entry")
    field = FIELD.get(dim)
    if field:
        await db.catalog_books.update_many({field: key}, {"$pull": {field: key}})
    return {"ok": True, "note": "effective_after_restart_for_labels"}
