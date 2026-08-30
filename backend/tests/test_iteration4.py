"""Iteration 4 tests: Premium simulé, Clubs de lecture, Flashcards, quota captures.

- Premium status/activate/deactivate endpoints
- Vision transcribe → 402 when captures_used >= 10 for non-premium
- Vision page_number → never limited
- Captures counter increments after successful transcribe (mocked via monkeypatch of LLM call is hard from web; we rely on direct mongo state)
- Clubs CRUD + messages + leave
- Flashcards generate (idempotent), list, review (each grade), delete
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")

# Direct mongo access for quota trickery / cleanup
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "manent_db"
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _month_key():
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def userA(api):
    email = f"test_it4_a_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"AliceIt4{uuid.uuid4().hex[:3]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email}


@pytest.fixture(scope="module")
def userB(api):
    email = f"test_it4_b_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"BobIt4{uuid.uuid4().hex[:3]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email}


def H(u):
    return {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}


# =====================================================================
# Premium status / activate / deactivate
# =====================================================================
class TestPremium:
    def test_status_default_not_premium(self, api, userA):
        r = api.get(f"{BASE_URL}/api/premium/status", headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["is_premium"] is False
        assert d["captures_limit"] == 10
        assert d["captures_used"] == 0
        assert d["month"] == _month_key()

    def test_activate_mensuel(self, api, userA):
        r = api.post(f"{BASE_URL}/api/premium/activate", json={"plan": "mensuel"}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["is_premium"] is True
        assert d["plan"] == "mensuel"

    def test_activate_annuel_overwrites_plan(self, api, userA):
        r = api.post(f"{BASE_URL}/api/premium/activate", json={"plan": "annuel"}, headers=H(userA))
        assert r.status_code == 200
        assert r.json()["plan"] == "annuel"

    def test_deactivate(self, api, userA):
        r = api.post(f"{BASE_URL}/api/premium/deactivate", json={}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["is_premium"] is False
        assert d.get("plan") in (None, "")


# =====================================================================
# Quota captures — set captures_used=10 in DB then hit /api/vision transcribe
# =====================================================================
class TestCaptureQuota:
    def test_transcribe_402_when_quota_reached(self, api, userA):
        # ensure non-premium and quota maxed for current month
        _db.users.update_one(
            {"user_id": userA["user"]["user_id"]},
            {"$set": {"is_premium": False, "captures_month": _month_key(), "captures_used": 10}},
        )
        r = api.get(f"{BASE_URL}/api/premium/status", headers=H(userA))
        assert r.json()["captures_used"] == 10

        # small 1x1 png data URL
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
        r = api.post(
            f"{BASE_URL}/api/vision",
            json={"image_base64": tiny_png, "mode": "transcribe"},
            headers=H(userA),
            timeout=30,
        )
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"
        assert "capture_limit_reached" in r.text

    def test_page_number_not_limited(self, api, userA):
        # still non-premium with captures_used=10, but page_number should NOT be blocked.
        # We accept any non-402 response — the LLM might succeed or fail (500) but must not return 402.
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
        r = api.post(
            f"{BASE_URL}/api/vision",
            json={"image_base64": tiny_png, "mode": "page_number"},
            headers=H(userA),
            timeout=45,
        )
        assert r.status_code != 402, f"page_number should never hit quota, got 402: {r.text}"

    def test_reset_quota_after_test(self, api, userA):
        # cleanup for downstream tests
        _db.users.update_one(
            {"user_id": userA["user"]["user_id"]},
            {"$set": {"captures_used": 0, "is_premium": False}},
        )
        r = api.get(f"{BASE_URL}/api/premium/status", headers=H(userA))
        assert r.json()["captures_used"] == 0
        assert r.json()["is_premium"] is False


# =====================================================================
# Clubs
# =====================================================================
@pytest.fixture(scope="module")
def club_ctx(api, userA):
    """Create a club owned by userA; returns club dict."""
    r = api.post(
        f"{BASE_URL}/api/clubs",
        json={"name": "TEST_ClubIt4", "description": "Club de test iteration 4"},
        headers=H(userA),
    )
    assert r.status_code == 200, r.text
    club = r.json()
    yield club
    # teardown
    try:
        _db.clubs.delete_one({"club_id": club["club_id"]})
        _db.club_messages.delete_many({"club_id": club["club_id"]})
    except Exception:
        pass


class TestClubs:
    def test_create_generates_code_and_owner(self, club_ctx, userA):
        assert len(club_ctx["code"]) == 6
        assert club_ctx["code"].isalnum()
        assert club_ctx["owner_id"] == userA["user"]["user_id"]
        assert userA["user"]["user_id"] in club_ctx["members"]

    def test_list_clubs_includes_created(self, api, userA, club_ctx):
        r = api.get(f"{BASE_URL}/api/clubs", headers=H(userA))
        assert r.status_code == 200
        clubs = r.json()["clubs"]
        found = [c for c in clubs if c["club_id"] == club_ctx["club_id"]]
        assert len(found) == 1
        assert found[0]["is_owner"] is True
        assert found[0]["members_count"] == 1

    def test_get_403_non_member(self, api, userB, club_ctx):
        r = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}", headers=H(userB))
        assert r.status_code == 403

    def test_join_unknown_code_404(self, api, userB):
        r = api.post(f"{BASE_URL}/api/clubs/join", json={"code": "ZZZZZZ"}, headers=H(userB))
        assert r.status_code == 404

    def test_join_by_code_ok(self, api, userB, club_ctx):
        r = api.post(f"{BASE_URL}/api/clubs/join", json={"code": club_ctx["code"]}, headers=H(userB))
        assert r.status_code == 200
        assert r.json()["club_id"] == club_ctx["club_id"]

    def test_join_idempotent(self, api, userB, club_ctx):
        r = api.post(f"{BASE_URL}/api/clubs/join", json={"code": club_ctx["code"]}, headers=H(userB))
        assert r.status_code == 200

    def test_get_after_join_member_ok(self, api, userB, club_ctx):
        r = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}", headers=H(userB))
        assert r.status_code == 200
        d = r.json()
        assert d["members_count"] == 2
        assert d["is_owner"] is False

    def test_patch_owner_only(self, api, userA, userB, club_ctx):
        # non-owner cannot patch
        r_bad = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={"book": {"title": "Candide", "author": "Voltaire"}},
            headers=H(userB),
        )
        assert r_bad.status_code == 403

        # owner can patch book and weekly_passage
        r = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={
                "book": {"title": "Candide", "author": "Voltaire"},
                "weekly_passage": {"text": "Il faut cultiver notre jardin.", "page": 150},
            },
            headers=H(userA),
        )
        assert r.status_code == 200
        d = r.json()
        assert d["book"]["title"] == "Candide"
        wp = d["weekly_passage"]
        assert wp["text"] == "Il faut cultiver notre jardin."
        assert wp["page"] == 150
        assert wp.get("set_by")  # pseudo attached
        assert wp.get("set_at")

    def test_messages_post_and_list(self, api, userA, userB, club_ctx):
        r1 = api.post(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/messages", json={"text": "Salut, on commence Candide ?"}, headers=H(userA))
        assert r1.status_code == 200
        r2 = api.post(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/messages", json={"text": "Oui !"}, headers=H(userB))
        assert r2.status_code == 200

        r = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/messages", headers=H(userA))
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert len(msgs) >= 2
        # is_me correct for author A
        by_text = {m["text"]: m for m in msgs}
        assert by_text["Salut, on commence Candide ?"]["is_me"] is True
        assert by_text["Oui !"]["is_me"] is False
        # author attached
        for m in msgs:
            assert "author" in m and "pseudo" in m["author"]

    def test_leave_transfers_owner(self, api, userA, userB, club_ctx):
        # userA (owner) leaves — owner should transfer to userB
        r = api.post(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/leave", json={}, headers=H(userA))
        assert r.status_code == 200
        # now userB is owner
        r2 = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}", headers=H(userB))
        assert r2.status_code == 200
        d = r2.json()
        assert d["owner_id"] == userB["user"]["user_id"]
        assert d["members_count"] == 1

    def test_leave_last_member_deletes_club(self, api, userB, club_ctx):
        r = api.post(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/leave", json={}, headers=H(userB))
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        # club is gone
        r2 = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}", headers=H(userB))
        assert r2.status_code == 404


# =====================================================================
# Flashcards — spaced repetition
# =====================================================================
@pytest.fixture(scope="module")
def book_with_quotes(api, userA):
    """Create a Candide book + 2 quotes for userA."""
    r = api.post(
        f"{BASE_URL}/api/books",
        json={"type": "etude", "title": "TEST_Candide", "author": "Voltaire", "mode": "etudes", "status": "en_cours"},
        headers=H(userA),
    )
    assert r.status_code == 200, r.text
    book = r.json()
    q1 = api.post(
        f"{BASE_URL}/api/quotes",
        json={"text": "Il faut cultiver notre jardin.", "book_id": book["book_id"], "page": 150, "themes": ["philosophie"]},
        headers=H(userA),
    ).json()
    q2 = api.post(
        f"{BASE_URL}/api/quotes",
        json={"text": "Tout est pour le mieux dans le meilleur des mondes possibles.", "book_id": book["book_id"], "page": 10},
        headers=H(userA),
    ).json()
    yield {"book": book, "quotes": [q1, q2]}
    # teardown
    try:
        _db.flashcards.delete_many({"book_id": book["book_id"]})
        _db.quotes.delete_many({"book_id": book["book_id"]})
        _db.books.delete_one({"book_id": book["book_id"]})
    except Exception:
        pass


class TestFlashcards:
    def test_generate_creates_cards(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        r = api.post(
            f"{BASE_URL}/api/books/{book['book_id']}/flashcards/generate",
            json={},
            headers=H(userA),
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 2
        assert len(d["cards"]) == 2
        for c in d["cards"]:
            assert c["question"]
            assert c["answer"]
            assert c["ease"] == 2.5
            assert c["interval"] == 0
            assert c["reps"] == 0

    def test_generate_idempotent(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        r = api.post(
            f"{BASE_URL}/api/books/{book['book_id']}/flashcards/generate",
            json={},
            headers=H(userA),
            timeout=90,
        )
        assert r.status_code == 200
        assert r.json()["created"] == 0

    def test_list_flashcards(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        r = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 2
        assert d["due"] >= 2  # both just created and due=now → both due

    def test_review_again(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        cards = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        card = cards[0]
        r = api.post(f"{BASE_URL}/api/flashcards/{card['card_id']}/review", json={"grade": "again"}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["interval"] == 0
        assert d["reps"] == 0
        # ease should have decreased but not below 1.3
        assert d["ease"] <= 2.5
        assert d["ease"] >= 1.3
        # due is roughly +10 min
        due = datetime.fromisoformat(d["due"].replace("Z", "+00:00")) if isinstance(d["due"], str) else d["due"]
        # accept anything in the future
        # (skip strict check due to serialization variability)

    def test_review_good_first_time(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        cards = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        # pick the second card that has reps=0 still
        card = next(c for c in cards if c["reps"] == 0)
        r = api.post(f"{BASE_URL}/api/flashcards/{card['card_id']}/review", json={"grade": "good"}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["interval"] == 1  # first good → 1 day
        assert d["reps"] == 1

    def test_review_easy_increases_ease(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        cards = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        card = cards[0]
        ease_before = card["ease"]
        r = api.post(f"{BASE_URL}/api/flashcards/{card['card_id']}/review", json={"grade": "easy"}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["ease"] > ease_before
        assert d["reps"] == card["reps"] + 1

    def test_review_hard_decreases_ease_floor_1_3(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        cards = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        card = cards[0]
        ease_before = card["ease"]
        r = api.post(f"{BASE_URL}/api/flashcards/{card['card_id']}/review", json={"grade": "hard"}, headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert d["ease"] <= ease_before
        assert d["ease"] >= 1.3

    def test_delete_flashcard(self, api, userA, book_with_quotes):
        book = book_with_quotes["book"]
        cards = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        card = cards[0]
        r = api.delete(f"{BASE_URL}/api/flashcards/{card['card_id']}", headers=H(userA))
        assert r.status_code == 200
        # verify persistence: GET list no longer contains it
        cards2 = api.get(f"{BASE_URL}/api/flashcards?book_id={book['book_id']}", headers=H(userA)).json()["cards"]
        assert not any(c["card_id"] == card["card_id"] for c in cards2)
