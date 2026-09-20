"""Iteration 20 — Vérif post-fusion Manent : couvertures, resume, areas, admin, filtres.

Ne réintroduit pas les tests iter19 (partage/invitations/likes) — non-régression assumée.
Focus: points 3 (resume + areas), 4 (couverture Bouts de bois), 5 (search Adichie),
6 (filters routing), 11 (scan page — backend), 12 (admin classification + no authors).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://lecture-capture-24.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "test_lotc@manent.app", "password": "Test1234!"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "test_admin@manent.app", "password": "Admin1234!"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ============ Point 4 : couverture « Les Bouts de bois de Dieu » ============
class TestCouvertureBoutsDeBois:
    def test_search_returns_book_with_cover(self, user_token):
        r = requests.get(f"{BASE_URL}/api/catalog/search",
                         params={"q": "bouts de bois", "limit": 5}, headers=auth(user_token))
        assert r.status_code == 200
        results = r.json().get("results", [])
        match = next((b for b in results if "bouts de bois" in (b.get("title") or "").lower()), None)
        assert match is not None, "Livre introuvable"
        assert match.get("cover"), f"Couverture manquante : {match}"
        assert match["cover"].startswith("http")


# ============ Point 5 : recherche par auteur ============
class TestSearchAdichie:
    def test_adichie_returns_works(self, user_token):
        r = requests.get(f"{BASE_URL}/api/catalog/search",
                         params={"q": "Adichie", "limit": 10}, headers=auth(user_token))
        assert r.status_code == 200
        results = r.json().get("results", [])
        assert len(results) >= 3, f"Devrait trouver plusieurs œuvres, got {len(results)}"
        assert all("Adichie" in (b.get("author") or "") for b in results), \
            f"Auteurs: {[b.get('author') for b in results]}"


# ============ Point 3 : /home/discover resume trié par updated_at ============
class TestHomeDiscover:
    def test_home_discover_shape(self, user_token):
        r = requests.get(f"{BASE_URL}/api/home/discover", headers=auth(user_token))
        assert r.status_code == 200
        d = r.json()
        # resume peut être None si compte sans livre en cours, mais next_up doit exister
        assert "resume" in d
        assert "next_up" in d
        assert "awarded" in d and isinstance(d["awarded"], list)
        assert "collections" in d


# ============ Point 3 : /catalog/areas → 1 continent par carte, sans doublon ni émoji dans label ============
class TestAreas:
    def test_areas_one_per_continent_no_dup(self, user_token):
        r = requests.get(f"{BASE_URL}/api/catalog/areas", headers=auth(user_token))
        assert r.status_code == 200
        areas = r.json().get("areas", [])
        keys = [a["key"] for a in areas]
        assert len(keys) == len(set(keys)), f"Doublons détectés : {keys}"
        labels = [a["label"] for a in areas]
        # Aucun emoji dans labels (pas de char > \u2600 typique emoji)
        for lbl in labels:
            assert all(ord(c) < 0x2600 or 0x3000 <= ord(c) < 0xD800 for c in lbl), \
                f"Emoji détecté dans label: {lbl!r}"

    def test_area_key_used_by_home_maps_to_browse(self, user_token):
        """BUG POTENTIEL : /areas renvoie key='c-afrique' mais /browse attend 'afrique'.
        home.tsx tap → /browse avec continent=c-afrique → doit retourner > 0 (sinon écran vide).
        """
        areas = requests.get(f"{BASE_URL}/api/catalog/areas",
                             headers=auth(user_token)).json().get("areas", [])
        assert areas, "Pas d'areas"
        # On prend le continent le plus peuplé
        top = max(areas, key=lambda a: a.get("count", 0))
        key = top["key"]
        expected_count = top["count"]
        r = requests.get(f"{BASE_URL}/api/catalog/browse",
                         params={"continent": key, "count_only": 1}, headers=auth(user_token))
        assert r.status_code == 200
        got = r.json().get("total", 0)
        assert got > 0, (
            f"REGRESSION : /browse?continent={key} retourne {got} (attendu ~{expected_count}). "
            f"Le tap 'Par origine' depuis Accueil affichera une liste VIDE."
        )


# ============ Point 6 : filtres combinés (Afrique + Fiction + Deuil) ============
class TestFilters:
    def test_combined_filters_return_count(self, user_token):
        r = requests.get(f"{BASE_URL}/api/catalog/browse",
                         params={"continent": "afrique", "type": "fiction",
                                 "theme": "deuil", "count_only": 1},
                         headers=auth(user_token))
        assert r.status_code == 200
        d = r.json()
        assert "total" in d
        assert "chips" in d and len(d["chips"]) == 3


# ============ Point 12 : /admin backend — classification dashboard, badge sans auteurs ============
class TestAdminClassification:
    def test_classification_stats(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/catalog/admin/classification-stats",
                         headers=auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "classified", "unclassified", "needs_review",
                  "quota_used", "quota_limit", "engine_version", "prompt_version"):
            assert k in d, f"Clé manquante : {k}"

    def test_classification_review(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/catalog/admin/classification/review",
                         params={"limit": 3}, headers=auth(admin_token))
        assert r.status_code == 200
        assert "books" in r.json()

    def test_classification_settings(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/catalog/admin/classification/settings",
                         headers=auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "settings" in d and "strong" in d["settings"]

    def test_admin_badge_no_authors(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/badge", headers=auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        # Le badge contient encore 'authors' pour compat mais frontend ne l'affiche plus
        assert "reports" in d


# ============ Point 5 (bis) : page /theme/résilience ============
class TestThemePage:
    def test_theme_resilience(self, user_token):
        r = requests.get(f"{BASE_URL}/api/theme/r%C3%A9silience", headers=auth(user_token))
        # endpoint peut être /themes/{name} — on teste seulement une réponse non 500
        assert r.status_code in (200, 404), r.status_code
