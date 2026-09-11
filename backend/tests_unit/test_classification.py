"""Tests unitaires du moteur de classification (sans base ni IA réelle).

Lancer depuis backend/ :  python3 -m pytest tests_unit -q
"""
import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import taxonomy as tx                     # noqa: E402
from routes import classification as c   # noqa: E402
from routes.book_search import _norm_key  # noqa: E402


def final(book, authors, ai=None, overrides=None):
    rules = c.rules_classify(book, authors)
    labels, conflicts = c.merge_labels(rules, ai, overrides or {})
    flat = c.flatten(labels)
    return flat, conflicts


def ai_from(**kw):
    """Construit une réponse IA parsée à partir du format JSON attendu (§18)."""
    return c.parse_ai_result(kw)


# TEST 1 — Auteur nigérian
def test_author_nigeria_gives_west_africa():
    flat, _ = final({"catalog_id": "b1", "title": "Purple Hibiscus", "authors": ["Chimamanda Ngozi Adichie"], "kind": "fiction"},
                    [{"name": "Chimamanda Ngozi Adichie", "country": "NG", "origin_confidence": "high", "origin_source": "wikidata"}])
    assert flat["f_countries"] == ["NG"]
    assert flat["f_regions"] == ["afrique-ouest"]
    assert flat["f_continents"] == ["afrique"]
    assert flat["classification"]["labels"][0]["confidence"] >= 0.9 or any(l["dim"] == "country" and l["strong"] for l in flat["classification"]["labels"])


# TEST 2 — Auteur français + histoire au Sénégal : l'auteur reste européen, le livre porte le contexte sénégalais
def test_french_author_story_in_senegal():
    ai = ai_from(book_type=[{"value": "roman", "confidence": 0.95}],
                 story_context={"countries": [{"value": "SN", "confidence": 0.9}]},
                 author_origin={"country": {"value": "FR", "confidence": 0.95}},
                 themes=[{"value": "immigration", "confidence": 0.85}],
                 evidence=[{"classification": "immigration", "reason": "Le récit suit un départ de Dakar vers Paris."}])
    flat, conflicts = final({"catalog_id": "b2", "title": "Roman", "authors": ["Auteur Français"], "summary": "Une histoire à Dakar.", "kind": "fiction"},
                            [{"name": "Auteur Français", "country": "FR", "origin_confidence": "high", "origin_source": "wikidata"}], ai)
    assert flat["f_countries"] == ["FR"] and flat["f_continents"] == ["europe"]
    assert flat["f_story_countries"] == ["SN"] and flat["f_story_continents"] == ["afrique"] and flat["f_story_regions"] == ["afrique-ouest"]
    assert "afrique" not in flat["f_continents"]
    assert conflicts == []
    imm = next(l for l in flat["classification"]["labels"] if l["key"] == "immigration")
    assert "Dakar" in imm["evidence"]


# TEST 3 — Roman sur le deuil
def test_novel_about_grief():
    ai = ai_from(book_type=[{"value": "roman", "confidence": 0.97}], themes=[{"value": "deuil", "confidence": 0.95}, {"value": "famille", "confidence": 0.89}],
                 emotions=[{"value": "tristesse", "confidence": 0.92}, {"value": "espoir", "confidence": 0.84}],
                 moods=[{"value": "emouvant", "confidence": 0.93}, {"value": "melancolique", "confidence": 0.81}])
    flat, _ = final({"catalog_id": "b3", "title": "X", "authors": ["Y"], "raw_subjects": ["Fiction", "Grief"], "summary": "Après la mort de sa mère…"}, [], ai)
    cls = flat["classification"]
    assert cls["type"]["subtype"] == "roman" and cls["type"]["family"] == "fiction"
    assert "deuil" in flat["f_themes"] and "famille" in flat["f_themes"]
    assert set(flat["f_emotions"]) >= {"tristesse", "espoir"}
    assert set(flat["f_moods"]) >= {"emouvant", "melancolique"}
    deuil = next(l for l in cls["labels"] if l["key"] == "deuil" and l["dim"] == "theme")
    assert deuil["strong"] and "ai" in deuil["origins"] and "metadata" in deuil["origins"]  # sources concordantes


# TEST 4 — Cuisine sénégalaise
def test_senegalese_cookbook():
    flat, _ = final({"catalog_id": "b4", "title": "La cuisine sénégalaise", "authors": ["Cheffe"], "raw_subjects": ["Cooking", "Senegalese cooking"], "kind": "nonfiction"},
                    [{"name": "Cheffe", "country": "SN", "origin_confidence": "medium", "origin_source": "openlibrary"}])
    assert "cuisine" in flat["f_types"] and "pratique" in flat["f_types"] and "cuisine" in flat["f_domains"]
    assert flat["f_countries"] == ["SN"] and flat["f_continents"] == ["afrique"] and flat["f_regions"] == ["afrique-ouest"]


# TEST 5 — Manuel universitaire de mathématiques
def test_university_math_textbook():
    ai = ai_from(book_type=[{"value": "manuel-universitaire", "confidence": 0.96}], domains=[{"value": "physique", "confidence": 0.4}],
                 audience=[{"value": "universitaires", "confidence": 0.95}])
    flat, _ = final({"catalog_id": "b5", "title": "Analyse mathématique", "authors": ["Prof"], "raw_subjects": ["Mathematics", "Textbook", "Study aids"]}, [], ai)
    assert "manuel-universitaire" in flat["f_types"] and "apprentissage" in flat["f_types"]
    assert "universitaires" in flat["f_audience"]
    assert "physique" not in flat["f_domains"]  # confiance 0.4 : jamais filtrée sans validation humaine


# TEST 6 — Livre chrétien sur le mariage
def test_christian_book_on_marriage():
    ai = ai_from(book_type=[{"value": "christianisme", "confidence": 0.94}], themes=[{"value": "mariage", "confidence": 0.93}, {"value": "foi", "confidence": 0.9}])
    flat, _ = final({"catalog_id": "b6", "title": "Le mariage selon Dieu", "authors": ["Pasteur"], "raw_subjects": ["Religion", "Christian life", "Marriage"]}, [], ai)
    assert "christianisme" in flat["f_types"] and "religion" in flat["f_types"]
    assert "mariage" in flat["f_themes"] and "foi" in flat["f_themes"]


# TEST 7 — Recherche naturelle (repli déterministe, sans IA)
def test_intent_keywords():
    sel = c.keyword_intent("Je veux un roman africain sur le deuil mais avec de l'espoir")
    assert "roman" in sel.get("type", [])
    assert "afrique" in sel.get("continent", [])
    assert "deuil" in sel.get("theme", [])
    assert "espoir" in sel.get("emotion", [])


def test_intent_parse_with_ai_stub(monkeypatch):
    class Stub:
        available = True
        model = "stub"

        async def parse_search_intent(self, system, text):
            return {"filters": {"type": ["roman"], "continent": ["Afrique"], "theme": ["deuil"], "emotion": ["espoir"],
                                "mood": ["emouvant", "reconfortant"], "country": ["Nigeria"]}, "interpretation": "Roman africain sur le deuil, porteur d'espoir"}

    class FakeDB:
        class meta:
            @staticmethod
            async def find_one(*a, **k): return {"n": 0}
            @staticmethod
            async def update_one(*a, **k): return None
    monkeypatch.setattr(c, "provider", Stub())
    monkeypatch.setattr(c, "db", FakeDB())
    out = asyncio.run(c.parse_search_intent("Je veux un roman africain sur le deuil mais avec de l'espoir."))
    f = out["filters"]
    assert f["type"] == ["roman"] and f["theme"] == ["deuil"] and f["emotion"] == ["espoir"]
    assert set(f["mood"]) == {"emouvant", "reconfortant"}
    assert f["country"] == ["NG"]          # « Nigeria » normalisé en ISO
    assert "continent" not in f            # « Afrique » n'est pas une clé valide : rejeté, pas inventé
    assert out["source"] == "ai"


# Priorités : une correction humaine prime sur l'IA ; une donnée structurée prime sur l'origine IA (conflit signalé)
def test_human_override_and_structured_priority():
    ai = ai_from(themes=[{"value": "maternite", "confidence": 0.9}], author_origin={"country": {"value": "GH", "confidence": 0.9}})
    flat, conflicts = final({"catalog_id": "b8", "title": "X", "authors": ["A"], "raw_subjects": ["Fiction"]},
                            [{"name": "A", "country": "NG", "origin_confidence": "high", "origin_source": "wikidata"}], ai,
                            {"add": ["theme:deuil"], "remove": ["theme:maternite"]})
    assert "deuil" in flat["f_themes"] and "maternite" not in flat["f_themes"]
    assert flat["f_countries"] == ["NG"]
    assert conflicts and conflicts[0]["ai"] == "GH" and conflicts[0]["structured"] == ["NG"]
    adm = next(l for l in flat["classification"]["labels"] if l["key"] == "deuil")
    assert adm["source"] == "admin" and adm["confidence"] == 1.0


# Description : un mot isolé ne suffit pas (déduction faible), l'accord IA + règles renforce
def test_description_word_is_weak_until_confirmed():
    book = {"catalog_id": "b9", "title": "X", "authors": ["A"], "summary": "Elle traverse un deuil. Le deuil la transforme."}
    rules = c.rules_classify(book, [])
    assert rules["theme:deuil"]["confidence"] < c.S()["proposed"]
    flat, _ = final(book, [])
    assert "deuil" not in flat["f_themes"]
    flat2, _ = final(book, [], ai_from(themes=[{"value": "deuil", "confidence": 0.8}]))
    assert "deuil" in flat2["f_themes"]


def test_needs_ai_decision():
    book = {"summary": "…", "raw_subjects": ["Fiction"]}
    assert c.needs_ai(book, c.rules_classify(book, []))[0] is True
    assert c.needs_ai({}, {})[0] is True


def test_normalize_country_and_dedup_key():
    assert c.normalize_country("Nigerian fiction") == "NG"
    assert c.normalize_country("Nigeria") == "NG"
    assert c.normalize_country("ng") == "NG"
    assert c.normalize_country("Atlantide") is None
    assert _norm_key("Une si longue lettre (French Edition)", "Mariama Bâ") == _norm_key("Une si longue lettre", "Bâ, Mariama")


def test_taxonomy_hot_extension():
    assert tx.register("theme", "harcelement", "Harcèlement", group="psychologie")
    assert "harcelement" in tx.valid_keys("theme") and tx.label_for("theme", "harcelement") == "Harcèlement"
    assert tx.LABEL_INDEX.get("harcelement") == ("theme", "harcelement")
    assert tx.register("country", "XX", "Pays test", parent="afrique-ouest")
    assert tx.geo_for_country("XX") == {"continent": "afrique", "region": "afrique-ouest"}
    assert not tx.register("region", "nulle-part", "Nulle part", parent="atlantide")
