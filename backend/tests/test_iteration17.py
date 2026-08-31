"""Iteration 17 — Correctifs sécurité + couvertures/synopsis.

Couvre :
  A) SSRF Wattpad scrape (host allow-list + auth)
  B) Premium activate → vérification RevenueCat (403 sinon)
  C) register-push authentifié + identité côté session
  D) Pin de citation contrôlé (403 si citation privée d'autrui)
  E) Rate-limit login (5 échecs → 429 sur 6e)
  F) /dev/seed admin-only
  G) Home discover / covers / book-summary
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path

# ------------------ setup ------------------
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _register(pseudo_hint: str = "T"):
    email = f"test_it17_{uuid.uuid4().hex[:8]}@manent.app"
    body = {"email": email, "password": "Test1234!", "pseudo": f"{pseudo_hint}{uuid.uuid4().hex[:4]}"}
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    return {
        "email": email, "password": body["password"],
        "user_id": d["user"]["user_id"],
        "token": d["session_token"],
        "headers": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"},
    }


@pytest.fixture(scope="module")
def user_a():
    return _register("A")


@pytest.fixture(scope="module")
def user_b():
    return _register("B")


@pytest.fixture(scope="module")
def user_premium():
    """test.manent@example.com is premium (miroir DB) — pas admin."""
    r = requests.post(f"{API}/auth/login",
                      json={"email": "test.manent@example.com", "password": "Test1234!"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return {
        "user_id": d["user"]["user_id"],
        "token": d["session_token"],
        "headers": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"},
    }


# ==================================================================
# A) SSRF Wattpad scrape
# ==================================================================
class TestWattpadSSRF:
    def test_scrape_requires_auth(self):
        r = requests.get(f"{API}/wattpad/scrape",
                         params={"url": "https://www.wattpad.com/story/198765482"}, timeout=30)
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code} {r.text}"

    def test_scrape_rejects_non_wattpad(self, user_a):
        r = requests.get(f"{API}/wattpad/scrape",
                         params={"url": "https://evil.com/x"},
                         headers=user_a["headers"], timeout=30)
        assert r.status_code == 400, f"expected 400 for evil.com, got {r.status_code} {r.text}"
        assert r.json().get("detail") == "invalid_url"

    def test_scrape_accepts_wattpad(self, user_a):
        r = requests.get(f"{API}/wattpad/scrape",
                         params={"url": "https://www.wattpad.com/story/198765482"},
                         headers=user_a["headers"], timeout=60)
        # 200 (OK) ou 500 scrape_failed (contrôlé) — jamais un fetch hors wattpad.com
        assert r.status_code in (200, 500), f"unexpected {r.status_code} {r.text}"
        if r.status_code == 500:
            assert r.json().get("detail") in ("scrape_failed",)


# ==================================================================
# B) Premium activate → RevenueCat verification
# ==================================================================
class TestPremiumRevenueCat:
    def test_activate_without_subscription_returns_403(self, user_a):
        r = requests.post(f"{API}/premium/activate",
                          json={"plan": "mensuel"},
                          headers=user_a["headers"], timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
        assert r.json().get("detail") == "subscription_not_verified"

    def test_test_manent_stays_premium(self, user_premium):
        r = requests.get(f"{API}/premium/status", headers=user_premium["headers"], timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_premium") is True, f"test.manent should stay premium: {data}"


# ==================================================================
# C) Push register — auth required + no user_id in body
# ==================================================================
class TestPushRegister:
    def test_register_push_requires_auth(self):
        r = requests.post(f"{API}/register-push",
                          json={"platform": "android", "device_token": "x"}, timeout=30)
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code} {r.text}"

    def test_register_push_body_rejects_user_id(self, user_a):
        # user_id in body doit être ignoré (identité = session). En dev EMERGENT_PUSH_KEY=placeholder,
        # après auth le backend peut renvoyer 500 (attendu). L'important : 401 sans token, et le champ
        # user_id n'est pas dans le modèle Pydantic donc ignoré silencieusement.
        r = requests.post(f"{API}/register-push",
                          json={"platform": "android", "device_token": "x", "user_id": "SPOOFED_ID"},
                          headers=user_a["headers"], timeout=30)
        # 201 (succès) ou 500 (placeholder key) — pas 401 puisque token valide
        assert r.status_code in (201, 500, 502), f"unexpected {r.status_code} {r.text}"


# ==================================================================
# D) Pin quote — visibility check
# ==================================================================
class TestPinVisibility:
    def _create_private_quote(self, user):
        book = requests.post(f"{API}/books", json={
            "type": "papier", "title": f"TEST_it17_priv_{uuid.uuid4().hex[:6]}",
            "author": "Anon", "pages": 100
        }, headers=user["headers"], timeout=30)
        assert book.status_code == 200, book.text
        book_id = book.json()["book_id"]
        q = requests.post(f"{API}/quotes", json={
            "book_id": book_id, "text": "TEST_priv secret line", "page": 12,
            "themes": ["résilience"], "is_public": False
        }, headers=user["headers"], timeout=30)
        assert q.status_code == 200, q.text
        return q.json()["quote_id"]

    def _create_public_quote(self, user):
        book = requests.post(f"{API}/books", json={
            "type": "papier", "title": f"TEST_it17_pub_{uuid.uuid4().hex[:6]}",
            "author": "Anon", "pages": 100
        }, headers=user["headers"], timeout=30)
        assert book.status_code == 200, book.text
        book_id = book.json()["book_id"]
        q = requests.post(f"{API}/quotes", json={
            "book_id": book_id, "text": "TEST_pub public line", "page": 12,
            "themes": ["confiance"], "is_public": True
        }, headers=user["headers"], timeout=30)
        assert q.status_code == 200, q.text
        return q.json()["quote_id"]

    def _create_board(self, user):
        r = requests.post(f"{API}/boards", json={
            "name": f"TEST_it17_board_{uuid.uuid4().hex[:5]}",
            "visibility": "private"
        }, headers=user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        return r.json()["board_id"]

    def test_cannot_pin_others_private_quote(self, user_a, user_b):
        priv_q = self._create_private_quote(user_a)
        board_b = self._create_board(user_b)
        r = requests.post(f"{API}/boards/{board_b}/pin",
                          json={"quote_id": priv_q},
                          headers=user_b["headers"], timeout=30)
        assert r.status_code == 403, f"expected 403 quote_not_visible, got {r.status_code} {r.text}"
        assert r.json().get("detail") == "quote_not_visible"

    def test_can_pin_others_public_quote(self, user_a, user_b):
        pub_q = self._create_public_quote(user_a)
        board_b = self._create_board(user_b)
        r = requests.post(f"{API}/boards/{board_b}/pin",
                          json={"quote_id": pub_q},
                          headers=user_b["headers"], timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        assert r.json().get("ok") is True


# ==================================================================
# E) Rate-limit login (5 échecs → 429)
# ==================================================================
class TestLoginRateLimit:
    def test_bruteforce_returns_429_on_6th(self):
        # email dédié pour ne pas verrouiller les comptes de test
        target = f"bruteforce_it17_{uuid.uuid4().hex[:6]}@manent.app"
        for i in range(5):
            r = requests.post(f"{API}/auth/login",
                              json={"email": target, "password": "wrong"}, timeout=30)
            assert r.status_code == 401, f"attempt {i+1} expected 401, got {r.status_code}"
        r6 = requests.post(f"{API}/auth/login",
                           json={"email": target, "password": "wrong"}, timeout=30)
        assert r6.status_code == 429, f"6th attempt should be 429, got {r6.status_code} {r6.text}"
        assert r6.json().get("detail") == "too_many_attempts"

    def test_valid_login_still_works_after_others_locked(self):
        # test.manent@example.com — doit rester connectable
        r = requests.post(f"{API}/auth/login",
                          json={"email": "test.manent@example.com", "password": "Test1234!"}, timeout=30)
        assert r.status_code == 200, f"valid login blocked: {r.status_code} {r.text}"


# ==================================================================
# F) /dev/seed admin-only
# ==================================================================
class TestSeedAdminOnly:
    def test_seed_non_admin_returns_403(self, user_a):
        r = requests.post(f"{API}/dev/seed", headers=user_a["headers"], timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_seed_premium_but_not_admin_returns_403(self, user_premium):
        r = requests.post(f"{API}/dev/seed", headers=user_premium["headers"], timeout=30)
        assert r.status_code == 403, f"premium (not admin) got {r.status_code} {r.text}"


# ==================================================================
# G) Couvertures + synopsis
# ==================================================================
class TestCoversAndSummary:
    def test_home_discover_popular_has_covers(self, user_premium):
        r = requests.get(f"{API}/home/discover", headers=user_premium["headers"], timeout=60)
        assert r.status_code == 200, r.text
        popular = r.json().get("popular") or []
        assert len(popular) > 0, "popular is empty"
        real_titles = ("candide", "alchimiste", "longue lettre", "impatientes")
        matched = [p for p in popular if any(t in (p.get("title") or "").lower() for t in real_titles)]
        # Au moins 1 vrai livre doit avoir une couverture
        with_cover = [p for p in matched if p.get("cover")]
        assert len(with_cover) >= 1, (
            f"expected covers on real books; matched={len(matched)} with_cover={len(with_cover)} "
            f"popular={[{'t': p.get('title'), 'c': bool(p.get('cover'))} for p in popular]}"
        )

    def test_search_covers_majority(self, user_premium):
        r = requests.get(f"{API}/books/search",
                         params={"q": "africain"}, headers=user_premium["headers"], timeout=60)
        assert r.status_code == 200, r.text
        results = r.json().get("results") or []
        if not results:
            pytest.skip("no results returned for 'africain'")
        with_cover = [x for x in results if x.get("cover")]
        # Repli leslibraires.fr → couvertures majoritaires (>= 50%)
        ratio = len(with_cover) / len(results)
        assert ratio >= 0.5, f"covers minority: {len(with_cover)}/{len(results)} ratio={ratio:.2f}"

    def test_books_summary_candide(self, user_premium):
        r = requests.get(f"{API}/books-summary",
                         params={"title": "Candide", "author": "Voltaire"},
                         headers=user_premium["headers"], timeout=60)
        assert r.status_code == 200, r.text
        summary = r.json().get("summary")
        assert summary and len(summary) > 30, f"summary empty or too short: {summary!r}"
        # deuxième appel : renvoie le cache
        r2 = requests.get(f"{API}/books-summary",
                          params={"title": "Candide", "author": "Voltaire"},
                          headers=user_premium["headers"], timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("summary") == summary


# ==================================================================
# H) Régression rapide
# ==================================================================
class TestRegression:
    def test_login_ok(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "test.manent@example.com", "password": "Test1234!"}, timeout=30)
        assert r.status_code == 200

    def test_feed_ok(self, user_premium):
        r = requests.get(f"{API}/feed", headers=user_premium["headers"], timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (list, dict))
