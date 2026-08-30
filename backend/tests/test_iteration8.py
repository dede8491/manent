"""
Iteration 8 backend tests
Covers:
  (1) Yearly goal: PATCH /api/me/goal + /api/stats/reading books_year + finished_at on status→termine
  (2) Daily quote: GET /api/quotes/daily (route order vs /quotes/{id})
  (3) Themes: GET /api/themes/mine (>=12 + custom), GET /api/themes/{t}/page suggested_books
  (4) Settings persistence + export + DELETE /me (with disposable account)
"""
import os
import uuid
import json
import pytest
import requests
from pathlib import Path

# ---- Resolve BASE_URL ----
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")

PRIMARY_EMAIL = "test.manent@example.com"
PRIMARY_PASSWORD = "Test1234!"


# ---- Fixtures ----
@pytest.fixture(scope="module")
def primary_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": PRIMARY_EMAIL, "password": PRIMARY_PASSWORD})
    assert r.status_code == 200, f"login primary failed: {r.text}"
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def disposable_account():
    """Register/login a throwaway account for DELETE /me test."""
    email = "delete.test@manent.app"
    pwd = "Test1234!"
    # try login first; if fails, register
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    if r.status_code != 200:
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": pwd, "pseudo": "Jetable"})
        assert r.status_code == 200, f"register throwaway: {r.text}"
    tok = r.json()["session_token"]
    return {"email": email, "password": pwd, "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


# =========================================================
# (1) Yearly goal + reading stats + finished_at behaviour
# =========================================================
class TestYearlyGoal:
    def test_patch_goal_sets_value(self, primary_headers):
        r = requests.patch(f"{BASE_URL}/api/me/goal", json={"yearly_goal": 12}, headers=primary_headers)
        assert r.status_code == 200, r.text
        assert r.json()["yearly_goal"] == 12

    def test_stats_reading_contains_yearly_fields(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/stats/reading", headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "year" in d and isinstance(d["year"], int)
        assert d.get("yearly_goal") == 12
        assert "books_year" in d and isinstance(d["books_year"], int)

    def test_patch_book_termine_sets_finished_at_and_increments_books_year(self, primary_headers):
        stats0 = requests.get(f"{BASE_URL}/api/stats/reading", headers=primary_headers).json()
        before = stats0["books_year"]

        # create a fresh test book
        title = f"TEST_it8_book_{uuid.uuid4().hex[:6]}"
        payload = {"type": "papier", "title": title, "author": "Testeur",
                   "status": "en_cours", "mode": "perso"}
        r = requests.post(f"{BASE_URL}/api/books", json=payload, headers=primary_headers)
        assert r.status_code == 200, r.text
        book_id = r.json()["book_id"]

        # patch to termine
        r = requests.patch(f"{BASE_URL}/api/books/{book_id}", json={"status": "termine"}, headers=primary_headers)
        assert r.status_code == 200, r.text
        book = r.json()
        assert book["status"] == "termine"
        assert book.get("finished_at"), "finished_at should be set when moving to termine"

        # stats books_year increments
        stats1 = requests.get(f"{BASE_URL}/api/stats/reading", headers=primary_headers).json()
        assert stats1["books_year"] == before + 1, (before, stats1["books_year"])

        # cleanup
        requests.delete(f"{BASE_URL}/api/books/{book_id}", headers=primary_headers)


# =========================================================
# (2) Daily quote — route order
# =========================================================
class TestDailyQuote:
    def test_daily_quote_not_404_and_returns_quote(self, primary_headers):
        # Ensure the user has at least one quote first
        r = requests.get(f"{BASE_URL}/api/quotes", headers=primary_headers)
        assert r.status_code == 200
        if not r.json().get("quotes"):
            # seed one
            body = {"text": "TEST_it8 seed quote", "themes": ["résilience"], "is_public": False}
            r2 = requests.post(f"{BASE_URL}/api/quotes", json=body, headers=primary_headers)
            assert r2.status_code == 200, r2.text

        r = requests.get(f"{BASE_URL}/api/quotes/daily", headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "quote" in d
        assert d["quote"] is not None, "daily quote should not be null when user has quotes"
        q = d["quote"]
        assert q.get("quote_id"), "must have quote_id"
        # book may be None if seed quote has no book_id, but the key/field can be absent
        # if quote has book_id, book must be attached
        if q.get("book_id"):
            assert q.get("book"), "book meta should be attached when book_id present"


# =========================================================
# (3) Themes: mine + suggested_books + custom theme
# =========================================================
class TestThemes:
    def test_themes_mine_has_at_least_12(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/themes/mine", headers=primary_headers)
        assert r.status_code == 200, r.text
        themes = r.json()["themes"]
        assert len(themes) >= 12, themes
        # base themes present
        for t in ["résilience", "amour", "foi"]:
            assert t in themes, f"{t} missing from base themes"

    def test_custom_theme_added_and_visible(self, primary_headers):
        custom = f"mélancolie_{uuid.uuid4().hex[:4]}"
        # create a quote with the custom theme
        body = {"text": "TEST_it8 quote custom", "themes": [custom], "is_public": True}
        r = requests.post(f"{BASE_URL}/api/quotes", json=body, headers=primary_headers)
        assert r.status_code == 200, r.text
        qid = r.json()["quote_id"]

        # themes/mine contains it
        r = requests.get(f"{BASE_URL}/api/themes/mine", headers=primary_headers)
        assert r.status_code == 200
        assert custom in r.json()["themes"]

        # themes/{custom}/page works
        r = requests.get(f"{BASE_URL}/api/themes/{custom}/page", headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["theme"] == custom
        assert "quotes" in d and "suggested_books" in d and "stats" in d

        # cleanup
        requests.delete(f"{BASE_URL}/api/quotes/{qid}", headers=primary_headers)

    def test_theme_page_suggested_books_non_empty_for_resilience(self, primary_headers):
        # Ensure at least one public quote+book on résilience for THIS user (so suggestions have data)
        # First, get an existing book (any) or create one
        r = requests.get(f"{BASE_URL}/api/books", headers=primary_headers)
        books = r.json().get("books", []) if r.status_code == 200 else []
        if not books:
            payload = {"type": "papier", "title": f"TEST_it8_resil_{uuid.uuid4().hex[:5]}",
                       "author": "Auteur", "status": "en_cours", "mode": "perso"}
            b = requests.post(f"{BASE_URL}/api/books", json=payload, headers=primary_headers).json()
            book_id = b["book_id"]
        else:
            book_id = books[0]["book_id"]

        # ensure at least one public quote linked to that book with theme résilience
        body = {"text": "TEST_it8 résilience seed", "themes": ["résilience"], "is_public": True, "book_id": book_id}
        r = requests.post(f"{BASE_URL}/api/quotes", json=body, headers=primary_headers)
        assert r.status_code == 200, r.text
        qid = r.json()["quote_id"]

        r = requests.get(f"{BASE_URL}/api/themes/résilience/page", headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        sug = d.get("suggested_books", [])
        assert isinstance(sug, list) and len(sug) >= 1, sug
        b0 = sug[0]
        assert "title" in b0 and b0["title"], b0
        assert "is_mine" in b0 and isinstance(b0["is_mine"], bool), b0
        # author may be None but key should be present
        assert "author" in b0

        # cleanup
        requests.delete(f"{BASE_URL}/api/quotes/{qid}", headers=primary_headers)


# =========================================================
# (4) Settings + export
# =========================================================
class TestSettingsExport:
    def test_patch_settings_default_public(self, primary_headers):
        r = requests.patch(f"{BASE_URL}/api/me/settings", json={"default_public": True}, headers=primary_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("default_public") is True

        # persistence: re-fetch (via /api/me via language field)
        r = requests.patch(f"{BASE_URL}/api/me/settings", json={}, headers=primary_headers)
        assert r.status_code == 200
        assert r.json().get("default_public") is True

        # revert to false (do not affect test account across regressions)
        r = requests.patch(f"{BASE_URL}/api/me/settings", json={"default_public": False}, headers=primary_headers)
        assert r.status_code == 200
        assert r.json().get("default_public") is False

    def test_export_returns_full_json(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/me/export", headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ["exported_at", "user", "books", "quotes", "boards", "flashcards", "clubs", "reading_events"]:
            assert key in d, f"missing key {key}"
        assert isinstance(d["books"], list)
        assert isinstance(d["quotes"], list)
        # password_hash must NOT leak
        u = d.get("user") or {}
        assert "password_hash" not in u, "password_hash leaked in export"


# =========================================================
# (5) DELETE /me — disposable account only
# =========================================================
class TestDeleteAccount:
    def test_delete_disposable_account_full_flow(self, disposable_account):
        headers = disposable_account["headers"]
        email = disposable_account["email"]
        pwd = disposable_account["password"]

        # seed: 1 book + 1 quote
        b = requests.post(f"{BASE_URL}/api/books",
                          json={"type": "papier", "title": "TEST_delete_book", "status": "en_cours", "mode": "perso"},
                          headers=headers)
        assert b.status_code == 200, b.text
        q = requests.post(f"{BASE_URL}/api/quotes",
                          json={"text": "TEST_delete_quote", "themes": ["résilience"], "is_public": False, "book_id": b.json()["book_id"]},
                          headers=headers)
        assert q.status_code == 200, q.text

        # DELETE /me
        r = requests.delete(f"{BASE_URL}/api/me", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json().get("deleted") is True

        # re-login must 401
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
        assert r.status_code in (401, 404), f"expected 401/404 after delete, got {r.status_code}: {r.text}"


# =========================================================
# Regression: books search still works
# =========================================================
class TestSearchRegression:
    def test_books_search_alchimiste(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/books/search", params={"q": "alchimiste"}, headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("results"), list)
        assert len(d["results"]) >= 1, d
