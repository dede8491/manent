"""Iteration 11 — Refactoring backend (routes/) + Push notifications hooks.

Coverage:
- Régression /api/books/search (moved to routes/book_search.py)
- /api/books/{book_id} (auth) still resolvable — no route order conflict
- /api/register-push returns clean 500 with placeholder EMERGENT_PUSH_KEY
- Club push hooks (message, reco, challenge, weekly_passage) non-blocking
- Régression rapide auth + books + quotes + premium
"""
import uuid
import pytest


# ---------- 1. Régression recherche livres ----------

class TestBookSearchRegression:
    def test_search_alchimiste_returns_results(self, api, base_url):
        r = api.get(f"{base_url}/api/books/search", params={"q": "alchimiste"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) > 0
        first = data["results"][0]
        assert first.get("title")

    def test_search_isbn_alchimiste_pocket(self, api, base_url):
        # 9782253006329 = L'Alchimiste (Coelho, Livre de Poche)
        r = api.get(f"{base_url}/api/books/search/isbn", params={"isbn": "9782253006329"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("isbn") == "9782253006329"
        assert d.get("source") in ("google", "openlibrary", "bnf")
        assert d.get("title")

    def test_search_isbn_fallback_bnf(self, api, base_url):
        # 9782290398487 — expected to fall back to BnF (per prev iteration)
        r = api.get(f"{base_url}/api/books/search/isbn", params={"isbn": "9782290398487"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("source") == "bnf", f"expected bnf source, got {d.get('source')}"
        assert d.get("title")


# ---------- 2. Route order — /books/search vs /books/{book_id} ----------

class TestBookRouteOrder:
    def test_get_book_by_id_still_reachable(self, api, base_url, auth_headers):
        # /books/{book_id} with a non-existing id must return 404 (not caught by /books/search)
        r = api.get(f"{base_url}/api/books/does_not_exist_xyz", headers=auth_headers)
        assert r.status_code == 404, f"route order conflict? {r.status_code} {r.text}"

    def test_get_book_search_unauth_still_reachable(self, api, base_url):
        # /books/search must NOT require auth (defined on book_search_router with no dep)
        r = api.get(f"{base_url}/api/books/search", params={"q": "candide"})
        assert r.status_code == 200
        assert "results" in r.json()


# ---------- 3. /register-push — placeholder key should return clean 500 ----------

class TestRegisterPush:
    def test_register_push_returns_500_with_placeholder_key(self, api, base_url):
        body = {
            "user_id": f"TEST_it11_{uuid.uuid4().hex[:8]}",
            "platform": "android",
            "device_token": "fake_device_token_for_test",
        }
        r = api.post(f"{base_url}/api/register-push", json=body)
        # Expected: 500 with clear message OR 502 (provider) — anything but 404/422/5xx-crash
        assert r.status_code in (500, 502), f"expected 500/502 (placeholder key), got {r.status_code} {r.text}"
        # Do not require an exact detail message — some deployments may pass real key
        assert r.headers.get("content-type", "").startswith("application/json")

    def test_register_push_validation(self, api, base_url):
        # Missing required field -> 422
        r = api.post(f"{base_url}/api/register-push", json={"user_id": "x"})
        assert r.status_code == 422


# ---------- 4. Club hooks — push failure must NOT block operation ----------

class TestClubPushHooksNonBlocking:
    """Create a club, then message/reco/challenge/passage; every op must return 2xx
    even though the push relay fails silently (placeholder key)."""

    @pytest.fixture(scope="class")
    def club(self, api, base_url, auth_headers):
        name = f"TEST_it11_club_{uuid.uuid4().hex[:6]}"
        r = api.post(f"{base_url}/api/clubs", json={"name": name}, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("club_id")
        return d

    def test_post_message(self, api, base_url, auth_headers, club):
        r = api.post(
            f"{base_url}/api/clubs/{club['club_id']}/messages",
            json={"text": "TEST_it11 message push hook"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("text") == "TEST_it11 message push hook"

    def test_post_reco(self, api, base_url, auth_headers, club):
        r = api.post(
            f"{base_url}/api/clubs/{club['club_id']}/reco",
            json={"title": "L'Alchimiste", "author": "Paulo Coelho", "note": "Un incontournable"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_reco") is True
        assert d.get("book", {}).get("title") == "L'Alchimiste"

    def test_patch_challenge(self, api, base_url, auth_headers, club):
        r = api.patch(
            f"{base_url}/api/clubs/{club['club_id']}",
            json={"challenge": {"title": "Défi 50 pages", "goal_pages": 50}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("challenge", {}).get("title") == "Défi 50 pages"
        assert d.get("challenge", {}).get("goal_pages") == 50

    def test_patch_weekly_passage(self, api, base_url, auth_headers, club):
        r = api.patch(
            f"{base_url}/api/clubs/{club['club_id']}",
            json={"weekly_passage": {"text": "TEST_it11 passage à méditer cette semaine."}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        wp = d.get("weekly_passage") or {}
        assert "TEST_it11" in (wp.get("text") or "")


# ---------- 5. Régression rapide auth/books/quotes/premium ----------

class TestQuickRegression:
    def test_auth_flow(self, api, base_url):
        email = f"TEST_it11_reg_{uuid.uuid4().hex[:8]}@manent.app"
        r = api.post(
            f"{base_url}/api/auth/register",
            json={"email": email, "password": "Test1234!", "pseudo": f"Reg{uuid.uuid4().hex[:4]}"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("session_token")

        r2 = api.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "Test1234!"},
        )
        assert r2.status_code == 200
        assert r2.json().get("session_token")

    def test_get_books(self, api, base_url, auth_headers):
        r = api.get(f"{base_url}/api/books", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        # backend returns {"books": [...]}
        assert isinstance(d, dict) and isinstance(d.get("books"), list)

    def test_post_quote(self, api, base_url, auth_headers):
        r = api.post(
            f"{base_url}/api/quotes",
            json={"text": "TEST_it11 citation régression rapide.", "is_public": False},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("quote_id")
        assert "TEST_it11" in d.get("text", "")

    def test_premium_status(self, api, base_url, auth_headers):
        r = api.get(f"{base_url}/api/premium/status", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "is_premium" in d
        assert "captures_used" in d
        assert "captures_limit" in d
