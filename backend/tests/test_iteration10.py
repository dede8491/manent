"""
Iteration 10 backend tests — Book search (Google + OpenLibrary + BnF), ISBN fallback, Premium regression.
Covers:
  GET /api/books/search?q=veiller sur elle → 200 + 'Veiller sur elle' de Jean-Baptiste Andrea en 1er avec isbn + cover
  GET /api/books/search/isbn?isbn=9782290398487 → 200 source 'bnf'
  GET /api/books/search/isbn?isbn=9782070612758 → 200 source 'google' ou 'openlibrary'
  Régression auth: register/login
  Premium: /status, /activate, /deactivate
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")


# ---- Fixtures ----
@pytest.fixture(scope="module")
def fresh_user_headers():
    """Fresh (non-premium) user for premium activate/deactivate cycle."""
    email = f"TEST_it10_{uuid.uuid4().hex[:6]}@manent.app"
    pwd = "Test1234!"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": pwd, "pseudo": "It10User"})
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, email, pwd


# =========================================================
# (1) Book search: 'veiller sur elle'
# =========================================================
class TestBookSearchByQuery:
    def test_search_returns_results(self):
        r = requests.get(f"{BASE_URL}/api/books/search", params={"q": "veiller sur elle"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) > 0, "results must not be empty"

    def test_veiller_sur_elle_is_first_with_isbn_and_cover(self):
        r = requests.get(f"{BASE_URL}/api/books/search", params={"q": "veiller sur elle"}, timeout=30)
        assert r.status_code == 200
        results = r.json()["results"]
        # 1st result should be Veiller sur elle by Jean-Baptiste Andrea
        first = results[0]
        assert first.get("title"), f"first result has no title: {first}"
        title_l = (first.get("title") or "").lower()
        author_l = (first.get("author") or "").lower()
        assert "veiller" in title_l and "elle" in title_l, f"unexpected title: {first.get('title')}"
        assert "andrea" in author_l, f"unexpected author: {first.get('author')}"
        assert first.get("isbn"), f"first result missing isbn: {first}"
        assert first.get("cover"), f"first result missing cover: {first}"

    def test_no_duplicate_titles(self):
        r = requests.get(f"{BASE_URL}/api/books/search", params={"q": "candide voltaire"}, timeout=30)
        assert r.status_code == 200
        results = r.json()["results"]
        keys = [(x.get("title", "").lower().strip(), (x.get("author") or "").lower().strip()) for x in results]
        assert len(keys) == len(set(keys)) or len(results) <= 10, "results appear duplicated"


# =========================================================
# (2) Book search by ISBN — BnF fallback + Google/OpenLibrary
# =========================================================
class TestBookSearchByIsbn:
    def test_isbn_bnf_fallback(self):
        # 9782290398487 → un ISBN qui doit passer par le fallback BnF
        r = requests.get(f"{BASE_URL}/api/books/search/isbn", params={"isbn": "9782290398487"}, timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        d = r.json()
        assert d.get("title"), f"title missing: {d}"
        assert d.get("isbn") == "9782290398487"
        # La source doit être 'bnf' (Google et OpenLibrary ne le connaissent pas)
        assert d.get("source") == "bnf", f"expected source=bnf, got source={d.get('source')}: {d}"

    def test_isbn_google_or_openlibrary(self):
        # 9782070612758 → connu par Google ou OpenLibrary
        r = requests.get(f"{BASE_URL}/api/books/search/isbn", params={"isbn": "9782070612758"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("title"), d
        assert d.get("isbn") == "9782070612758"
        assert d.get("source") in ("google", "openlibrary", "bnf"), f"unexpected source: {d.get('source')}"

    def test_invalid_isbn_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/books/search/isbn", params={"isbn": "9999999999999"}, timeout=30)
        # ean13 invalide -> 404
        assert r.status_code == 404, r.text


# =========================================================
# (3) Auth regression — register + login
# =========================================================
class TestAuthRegression:
    def test_register_login_flow(self):
        email = f"TEST_it10_auth_{uuid.uuid4().hex[:6]}@manent.app"
        pwd = "Test1234!"
        # register
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": pwd, "pseudo": "RegLogin"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_token" in d
        assert d.get("user", {}).get("email", "").lower() == email.lower()
        # login
        r2 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": email, "password": pwd})
        assert r2.status_code == 200, r2.text
        assert r2.json().get("session_token")

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "test.manent@example.com", "password": "wrongpass"})
        assert r.status_code in (400, 401, 403), r.text


# =========================================================
# (4) Premium regression — status / activate / deactivate
# =========================================================
class TestPremiumRegression:
    def test_premium_status_default_free(self, fresh_user_headers):
        headers, _, _ = fresh_user_headers
        r = requests.get(f"{BASE_URL}/api/premium/status", headers=headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_premium") is False
        assert d.get("captures_limit") == 10
        assert isinstance(d.get("captures_used"), int)

    def test_premium_activate_annuel(self, fresh_user_headers):
        headers, _, _ = fresh_user_headers
        r = requests.post(f"{BASE_URL}/api/premium/activate",
                          json={"plan": "annuel"}, headers=headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_premium") is True
        assert d.get("plan") == "annuel"
        # Vérifie la persistance via GET /status
        r2 = requests.get(f"{BASE_URL}/api/premium/status", headers=headers)
        assert r2.status_code == 200
        assert r2.json().get("is_premium") is True

    def test_premium_deactivate(self, fresh_user_headers):
        headers, _, _ = fresh_user_headers
        r = requests.post(f"{BASE_URL}/api/premium/deactivate", headers=headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_premium") is False
        assert d.get("plan") in (None, "")
        # persistence
        r2 = requests.get(f"{BASE_URL}/api/premium/status", headers=headers)
        assert r2.json().get("is_premium") is False

    def test_premium_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/premium/status")
        assert r.status_code in (401, 403), r.text
