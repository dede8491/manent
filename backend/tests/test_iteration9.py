"""
Iteration 9 backend tests — 'Recos entre amis' dans les clubs
Covers:
  POST /api/clubs/{club_id}/reco — 200 with is_reco/book/text
  403 for non-member
  422 for empty note (min_length=1)
  GET /api/clubs/{id}/messages includes the reco with author populated
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

PRIMARY_EMAIL = "test.manent@example.com"
PRIMARY_PASSWORD = "Test1234!"
CANDIDE_CLUB_ID = "cl_e0b27822964b4fb3"


# ---- Fixtures ----
@pytest.fixture(scope="module")
def primary_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": PRIMARY_EMAIL, "password": PRIMARY_PASSWORD})
    assert r.status_code == 200, f"login primary failed: {r.text}"
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def outsider_headers():
    """Register/login a completely different user who is NOT a member of Candide club."""
    email = f"outsider_it9_{uuid.uuid4().hex[:6]}@manent.app"
    pwd = "Test1234!"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": pwd, "pseudo": "Outsider"})
    assert r.status_code == 200, f"register outsider: {r.text}"
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# =========================================================
# (1) Happy path: primary posts a valid reco
# =========================================================
class TestRecoHappyPath:
    def test_post_reco_returns_200_with_shape(self, primary_headers):
        payload = {"title": "Candide", "author": "Voltaire",
                   "note": f"TEST_it9 lecture jubilatoire {uuid.uuid4().hex[:5]}"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_reco") is True, d
        assert d.get("book", {}).get("title") == "Candide"
        assert d.get("book", {}).get("author") == "Voltaire"
        assert d.get("text") == payload["note"]
        assert d.get("author", {}).get("pseudo"), "author.pseudo should be populated"
        assert d.get("message_id", "").startswith("cm_")
        # store for next test
        TestRecoHappyPath._msg_id = d["message_id"]
        TestRecoHappyPath._note = payload["note"]

    def test_get_messages_includes_reco_with_author(self, primary_headers):
        r = requests.get(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/messages",
                         headers=primary_headers)
        assert r.status_code == 200, r.text
        msgs = r.json()["messages"]
        recos = [m for m in msgs if m.get("is_reco")]
        assert len(recos) >= 1, "at least one reco should be present"
        found = next((m for m in recos if m.get("message_id") == TestRecoHappyPath._msg_id), None)
        assert found is not None, f"reco not found by message_id in listing"
        assert found.get("author", {}).get("pseudo"), "author.pseudo must be present in listing"
        assert found.get("text") == TestRecoHappyPath._note
        assert found.get("book", {}).get("title") == "Candide"

    def test_post_reco_without_author_ok(self, primary_headers):
        payload = {"title": f"TEST_livre_sans_auteur_{uuid.uuid4().hex[:5]}",
                   "note": "TEST_it9 sans auteur"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_reco"] is True
        # author must be None (or absent) when not provided
        assert d["book"].get("author") in (None, "")


# =========================================================
# (2) Auth / access errors
# =========================================================
class TestRecoAccess:
    def test_non_member_gets_403(self, outsider_headers):
        payload = {"title": "Candide", "author": "Voltaire",
                   "note": "tentative outsider"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=outsider_headers)
        assert r.status_code == 403, f"expected 403 for non-member, got {r.status_code}: {r.text}"

    def test_unknown_club_returns_404(self, primary_headers):
        payload = {"title": "X", "note": "y"}
        r = requests.post(f"{BASE_URL}/api/clubs/cl_doesnotexist_xyz/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 404, r.text


# =========================================================
# (3) Validation errors (422)
# =========================================================
class TestRecoValidation:
    def test_empty_note_returns_422(self, primary_headers):
        payload = {"title": "Candide", "author": "Voltaire", "note": ""}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 422, r.text

    def test_missing_note_returns_422(self, primary_headers):
        payload = {"title": "Candide", "author": "Voltaire"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 422, r.text

    def test_empty_title_returns_422(self, primary_headers):
        payload = {"title": "", "note": "coucou"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/reco",
                          json=payload, headers=primary_headers)
        assert r.status_code == 422, r.text


# =========================================================
# (4) Regression: normal message posting still works
# =========================================================
class TestNormalMessageRegression:
    def test_post_normal_message_still_works(self, primary_headers):
        payload = {"text": f"TEST_it9 message normal {uuid.uuid4().hex[:5]}"}
        r = requests.post(f"{BASE_URL}/api/clubs/{CANDIDE_CLUB_ID}/messages",
                          json=payload, headers=primary_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        # Normal message should NOT be is_reco
        assert not d.get("is_reco"), "normal message should not have is_reco"
        assert d.get("text") == payload["text"]
        assert d.get("author", {}).get("pseudo")
