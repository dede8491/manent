"""Iteration 14 backend tests:
- POST /api/books/{book_id}/fiche/autofill (Claude Sonnet 4.6 via emergentintegrations)
- GET /api/discover/isbn/{isbn} (metadata + community readers, avg rating, quotes, in_library)
- Regression: POST /api/clubs/{club_id}/messages accepts multi-line text (used by fiche-send-club)
"""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def test_manent_headers(s):
    """Sign in as the primary premium test account test.manent@example.com."""
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "test.manent@example.com", "password": "Test1234!"})
    assert r.status_code == 200, f"login test.manent failed: {r.status_code} {r.text}"
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def candide_book_id(s, test_manent_headers):
    """Locate the Candide book in test.manent's library (created in earlier iterations)."""
    r = s.get(f"{BASE_URL}/api/books", headers=test_manent_headers)
    assert r.status_code == 200
    books = r.json().get("books", [])
    for b in books:
        if "candide" in (b.get("title") or "").lower():
            return b["book_id"]
    pytest.skip("Candide not found in test.manent library")


@pytest.fixture(scope="module")
def fresh_user_headers(s):
    """Register a fresh user (for the ISBN 404 test and independent autofill test)."""
    email = f"TEST_it14_{uuid.uuid4().hex[:10]}@example.com"
    body = {"email": email, "password": "Test1234!", "pseudo": f"It14{uuid.uuid4().hex[:4]}"}
    r = s.post(f"{BASE_URL}/api/auth/register", json=body)
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- 1) Autofill fiche ----------
class TestAutofillFiche:
    def test_autofill_candide_returns_non_empty_suggestions(self, s, test_manent_headers, candide_book_id):
        r = s.post(
            f"{BASE_URL}/api/books/{candide_book_id}/fiche/autofill",
            headers=test_manent_headers,
            timeout=90,
        )
        assert r.status_code == 200, f"autofill failed: {r.status_code} {r.text[:500]}"
        payload = r.json()
        assert "suggestions" in payload
        sug = payload["suggestions"]
        # Toutes les clés doivent exister
        for k in ("genre", "publisher", "author_bio", "summary"):
            assert k in sug, f"missing key {k}"
        # Au moins genre + author_bio + summary doivent être non vides (publisher parfois null selon Claude)
        assert sug["genre"], f"empty genre: {sug}"
        assert sug["author_bio"], f"empty author_bio: {sug}"
        assert sug["summary"], f"empty summary: {sug}"
        # Candide → doit mentionner Voltaire ou conte philosophique (validation sémantique légère)
        combined = " ".join(str(v) for v in sug.values() if v).lower()
        assert "voltaire" in combined or "conte" in combined or "philosoph" in combined, (
            f"suggestions ne semblent pas correspondre à Candide: {sug}"
        )

    def test_autofill_not_found_returns_404(self, s, test_manent_headers):
        r = s.post(
            f"{BASE_URL}/api/books/bk_nonexistent_xyz/fiche/autofill",
            headers=test_manent_headers,
            timeout=30,
        )
        assert r.status_code == 404
        assert r.json().get("detail") == "not_found"


# ---------- 2) Discover ISBN ----------
class TestDiscoverIsbn:
    def test_discover_known_isbn(self, s, test_manent_headers):
        """9782253006329 = 20000 Lieues Sous Les Mers (LGF/Livre de Poche)."""
        r = s.get(f"{BASE_URL}/api/discover/isbn/9782253006329", headers=test_manent_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert "book" in d and d["book"], "book manquant"
        assert "readers" in d
        assert "avg_rating" in d
        assert "ratings_count" in d
        assert "quotes" in d and isinstance(d["quotes"], list)
        assert "in_library" in d and isinstance(d["in_library"], bool)
        title = (d["book"].get("title") or "").lower()
        # Le titre doit contenir "lieues" ou "vingt mille" ou "20000"
        assert any(k in title for k in ("lieues", "vingt mille", "20000", "20 000")), f"titre inattendu: {d['book']}"

    def test_discover_unknown_isbn_returns_404(self, s, test_manent_headers):
        r = s.get(f"{BASE_URL}/api/discover/isbn/1111111111111", headers=test_manent_headers, timeout=30)
        assert r.status_code == 404
        assert r.json().get("detail") == "isbn_not_found"


# ---------- 3) Regression: multi-line clubs message ----------
class TestClubsMultilineMessage:
    def test_post_multiline_message_to_club(self, s, test_manent_headers):
        # Trouver le club "Club Candide" du user test.manent
        r = s.get(f"{BASE_URL}/api/clubs", headers=test_manent_headers)
        assert r.status_code == 200
        clubs = r.json().get("clubs", [])
        target = None
        for c in clubs:
            if "candide" in (c.get("name") or "").lower():
                target = c
                break
        if not target and clubs:
            target = clubs[0]
        assert target, "aucun club disponible pour le user test.manent"

        multiline_text = (
            "TEST_it14 On en parle ? — Candide\n"
            "1. Quel passage vous a marqué ?\n"
            "2. Le meilleur des mondes possibles, y crois-tu ?"
        )
        r = s.post(
            f"{BASE_URL}/api/clubs/{target['club_id']}/messages",
            headers=test_manent_headers,
            json={"text": multiline_text},
        )
        assert r.status_code == 200, f"POST message failed: {r.status_code} {r.text}"

        # Vérifier que le message est bien persisté avec les newlines
        r2 = s.get(f"{BASE_URL}/api/clubs/{target['club_id']}/messages", headers=test_manent_headers)
        assert r2.status_code == 200
        msgs = r2.json().get("messages", [])
        found = [m for m in msgs if (m.get("text") or "").startswith("TEST_it14 On en parle ?")]
        assert found, f"message multi-lignes introuvable dans la discussion (n messages={len(msgs)})"
        assert "\n" in found[0]["text"], "les newlines ont été perdues à la persistance"
        assert "1. Quel passage" in found[0]["text"]
        assert "2. Le meilleur" in found[0]["text"]
