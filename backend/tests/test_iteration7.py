"""
Iteration 7 backend tests — Badges, Club Recap (manual + auto-weekly), Library store links (backend-side sanity).

Uses the fixtures in conftest.py (BASE_URL, api, auth, auth_headers) — fresh test user per session.
An additional 'primary' fixture logs in the manent primary test account (test.manent@example.com/Test1234!)
so we can exercise the pre-existing Club Candide (owner) + weekly_passage + challenge already seeded there.
"""
import os
import time
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

from conftest import BASE_URL


# =========================
# Fixtures
# =========================
@pytest.fixture(scope="module")
def primary(api):
    """Log in the primary manent test account (owner of Club Candide)."""
    email = "test.manent@example.com"
    password = "Test1234!"
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"primary login failed: {r.status_code} {r.text}"
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def primary_club(primary, api):
    """Return the primary user's first owned club (should be Club Candide)."""
    r = api.get(f"{BASE_URL}/api/clubs", headers=primary["headers"])
    assert r.status_code == 200, r.text
    clubs = r.json().get("clubs", [])
    assert clubs, "primary user has no clubs"
    # prefer one they own with weekly_passage or challenge
    owned = [c for c in clubs if c.get("is_owner") or c.get("owner_id") == primary["user"]["user_id"]]
    assert owned, "primary user does not own any club"
    # prefer Candide (or any with passage/challenge)
    with_content = [c for c in owned if c.get("weekly_passage") or c.get("challenge")]
    return (with_content or owned)[0]


def _mongo():
    url = None
    for line in open("/app/backend/.env").read().splitlines():
        if line.startswith("MONGO_URL"):
            url = line.split("=", 1)[1].strip().strip('"')
        if line.startswith("DB_NAME"):
            db = line.split("=", 1)[1].strip().strip('"')
    return AsyncIOMotorClient(url)[db]


# =========================
# 1) Badges endpoint
# =========================
class TestBadges:
    def test_badges_returns_10(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/badges", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "badges" in d and "earned_count" in d
        badges = d["badges"]
        assert isinstance(badges, list) and len(badges) == 10, f"expected 10 badges, got {len(badges)}"
        ids = {b["id"] for b in badges}
        expected = {"first_quote", "collector", "anthologist", "streak3", "streak7", "streak30",
                    "first_book", "five_books", "challenge", "sheet"}
        assert ids == expected, f"badge ids mismatch: {ids ^ expected}"
        for b in badges:
            assert {"id", "title", "desc", "icon", "earned"}.issubset(b.keys()), f"missing keys in {b}"
            assert isinstance(b["earned"], bool)
        assert d["earned_count"] == sum(1 for b in badges if b["earned"])

    def test_badges_primary_first_quote_earned(self, api, primary):
        """Primary account has captured quotes on Candide — first_quote must be earned."""
        r = api.get(f"{BASE_URL}/api/badges", headers=primary["headers"])
        assert r.status_code == 200
        d = r.json()
        by_id = {b["id"]: b for b in d["badges"]}
        assert by_id["first_quote"]["earned"] is True, "primary should have first_quote earned"

    def test_badges_consistency_collector(self, api, primary):
        """If quotes >= 10, collector must be earned; if >=50 anthologist too."""
        # count via /me quotes or similar — use quotes endpoint if available; fallback via badges only
        rb = api.get(f"{BASE_URL}/api/badges", headers=primary["headers"])
        badges = {b["id"]: b for b in rb.json()["badges"]}
        # Fetch quotes count via /api/quotes (paginate quickly)
        rq = api.get(f"{BASE_URL}/api/quotes", headers=primary["headers"])
        if rq.status_code == 200:
            quotes = rq.json().get("quotes", [])
            n = len(quotes)
            if n >= 10:
                assert badges["collector"]["earned"] is True, f"collector should be earned with {n} quotes"
            if n >= 50:
                assert badges["anthologist"]["earned"] is True


# =========================
# 2) POST /clubs/{id}/recap — owner only, requires content
# =========================
class TestRecapManual:
    def test_recap_403_non_owner(self, api, auth_headers, primary_club):
        # fresh user is NOT a member/owner of primary_club → /api/clubs/{id} returns 404 first via _club_or_404
        # so accept either 403 or 404 (backend guards via membership)
        r = api.post(f"{BASE_URL}/api/clubs/{primary_club['club_id']}/recap", headers=auth_headers)
        assert r.status_code in (403, 404), r.text

    def test_recap_owner_creates_system_message(self, api, primary, primary_club):
        r = api.post(f"{BASE_URL}/api/clubs/{primary_club['club_id']}/recap", headers=primary["headers"])
        assert r.status_code == 200, f"recap post failed: {r.status_code} {r.text}"
        msg = r.json()
        assert msg.get("is_system") is True, f"message should be system: {msg}"
        text = msg.get("text", "")
        assert "Récap de la semaine" in text
        # Must not contain raw {user_id} placeholders
        import re as _re
        assert not _re.search(r"\{[^}]+\}", text), f"raw placeholder found in recap: {text!r}"
        # If challenge exists, ranking pseudos should appear (not IDs)
        if primary_club.get("challenge"):
            assert "Défi" in text

    def test_recap_400_when_nothing(self, api, primary):
        """Create a fresh empty club (no passage, no challenge) → recap should 400."""
        body = {"name": f"TEST_empty_club_{int(time.time())}", "description": "vide"}
        r = api.post(f"{BASE_URL}/api/clubs", headers=primary["headers"], json=body)
        assert r.status_code == 200, r.text
        club_id = r.json()["club_id"]
        try:
            r2 = api.post(f"{BASE_URL}/api/clubs/{club_id}/recap", headers=primary["headers"])
            assert r2.status_code == 400, f"expected 400 nothing_to_recap, got {r2.status_code} {r2.text}"
        finally:
            # cleanup: leave (will delete since single-member)
            api.post(f"{BASE_URL}/api/clubs/{club_id}/leave", headers=primary["headers"])


# =========================
# 3) GET /clubs/{id}/messages — auto weekly recap
# =========================
class TestRecapAuto:
    def test_auto_recap_triggers_and_is_idempotent(self, api, primary, primary_club):
        # Force last_recap_week to an old value directly in Mongo
        async def _prep():
            db = _mongo()
            await db.clubs.update_one({"club_id": primary_club["club_id"]},
                                      {"$set": {"last_recap_week": "2020-W01"}})
            # count system messages before
            before = await db.club_messages.count_documents({"club_id": primary_club["club_id"], "is_system": True})
            return before
        before = asyncio.get_event_loop().run_until_complete(_prep())

        # 1st GET — should trigger auto recap
        r1 = api.get(f"{BASE_URL}/api/clubs/{primary_club['club_id']}/messages", headers=primary["headers"])
        assert r1.status_code == 200, r1.text
        msgs1 = r1.json()["messages"]
        system1 = [m for m in msgs1 if m.get("is_system")]
        assert len(system1) >= 1, "expected at least 1 system recap message after auto trigger"
        last_system = system1[-1]
        assert "Récap de la semaine" in last_system["text"]
        # No raw placeholders
        import re as _re
        assert not _re.search(r"\{[^}]+\}", last_system["text"])
        # author label
        assert last_system.get("author", {}).get("pseudo") == "Manent"

        # 2nd GET — must NOT create another system message
        r2 = api.get(f"{BASE_URL}/api/clubs/{primary_club['club_id']}/messages", headers=primary["headers"])
        assert r2.status_code == 200
        system2 = [m for m in r2.json()["messages"] if m.get("is_system")]
        assert len(system2) == len(system1), \
            f"auto-recap not idempotent same week: before={len(system1)} after={len(system2)}"

        # Verify last_recap_week was updated to current week
        async def _check_week():
            db = _mongo()
            c = await db.clubs.find_one({"club_id": primary_club["club_id"]}, {"_id": 0, "last_recap_week": 1})
            return c.get("last_recap_week")
        week = asyncio.get_event_loop().run_until_complete(_check_week())
        assert week and week != "2020-W01", f"last_recap_week not updated: {week}"


# =========================
# 4) Regression: normal club message flow still works
# =========================
class TestClubMessageRegression:
    def test_post_regular_message(self, api, primary, primary_club):
        body = {"text": f"TEST regression msg {int(time.time())}"}
        r = api.post(f"{BASE_URL}/api/clubs/{primary_club['club_id']}/messages",
                     headers=primary["headers"], json=body)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m.get("is_system") in (None, False)
        assert m.get("text") == body["text"]
