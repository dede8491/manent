"""Iteration 5 backend tests

Covers:
- GET /api/books/search (Google Books live) — max 8, fields
- GET /api/books/search/isbn (Google + Open Library fallback + 404)
- POST /api/books accepts year
- Clubs challenge: PATCH /api/clubs/{id} challenge (owner-only, 400 invalid),
  POST /api/clubs/{id}/challenge/progress, leaderboard sort + my_pages
- GET /api/stats/reading — streak/week(7)/week_pages/active_days_month
  and effect of creating a quote / progressing pages
"""
import os
import uuid
from datetime import datetime, timezone

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

_mongo = MongoClient("mongodb://localhost:27017")
_db = _mongo["manent_db"]


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# -------- fixtures --------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def userA(api):
    email = f"test_it5_a_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"AliceIt5{uuid.uuid4().hex[:3]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"]}


@pytest.fixture(scope="module")
def userB(api):
    email = f"test_it5_b_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"BobIt5{uuid.uuid4().hex[:3]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"]}


def H(u):
    return {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}


# ================================================================
# BOOKS SEARCH — Google Books live
# ================================================================
class TestBooksSearch:
    def test_search_alchimiste_shape(self, api, userA):
        r = api.get(f"{BASE_URL}/api/books/search", params={"q": "alchimiste"}, headers=H(userA), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "results" in j, f"expected 'results' key, got {list(j.keys())}"
        results = j["results"]
        assert isinstance(results, list)
        assert len(results) <= 8, f"expected <=8, got {len(results)}"
        # NOTE: Google Books may rate-limit this container (429) → results can be empty.
        # We validate the shape if any result returned.
        if results:
            first = results[0]
            for key in ("title", "author", "year", "cover"):
                assert key in first, f"missing field {key}"
            assert first["title"], "first result must have a title"

    def test_search_empty_q_returns_empty(self, api, userA):
        r = api.get(f"{BASE_URL}/api/books/search", params={"q": "zzxqwv123nonsense_xyz9871"}, headers=H(userA), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json().get("results", []), list)


class TestISBNSearch:
    def test_isbn_google_or_openlibrary_alchimiste(self, api):
        # 9782070368228 — known ISBN. Google Books can rate-limit (429) from this container,
        # in which case Open Library fallback should return the book. Retry once on 404.
        last = None
        for _ in range(3):
            r = api.get(f"{BASE_URL}/api/books/search/isbn", params={"isbn": "9782070368228"}, timeout=60)
            last = r
            if r.status_code == 200:
                break
        r = last
        assert r.status_code == 200, r.text
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("title"), "title missing"
        assert d.get("isbn") == "9782070368228"
        # source field should exist and be either 'google' or 'openlibrary'
        # (server sets source in both branches)
        assert d.get("source") in ("google", "openlibrary"), f"unexpected source: {d.get('source')}"

    def test_isbn_not_found_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/books/search/isbn", params={"isbn": "9789999999999"}, timeout=25)
        assert r.status_code == 404
        assert "isbn_not_found" in r.text


class TestBookCreateWithYear:
    def test_post_books_accepts_year(self, api, userA):
        payload = {
            "type": "papier",
            "title": "TEST_YearBook",
            "author": "Auteur Test",
            "year": "1988",
            "status": "a_lire",
            "mode": "perso",
        }
        r = api.post(f"{BASE_URL}/api/books", json=payload, headers=H(userA))
        assert r.status_code == 200, r.text
        book = r.json()
        assert book.get("year") == "1988"
        # verify persistence via GET
        r2 = api.get(f"{BASE_URL}/api/books/{book['book_id']}", headers=H(userA))
        assert r2.status_code == 200
        assert r2.json().get("year") == "1988"
        # cleanup
        api.delete(f"{BASE_URL}/api/books/{book['book_id']}", headers=H(userA))


# ================================================================
# CLUBS CHALLENGE
# ================================================================
@pytest.fixture(scope="module")
def club_ctx(api, userA, userB):
    r = api.post(
        f"{BASE_URL}/api/clubs",
        json={"name": "TEST_ClubIt5", "description": "Club it5"},
        headers=H(userA),
    )
    assert r.status_code == 200, r.text
    club = r.json()
    # userB joins
    rj = api.post(f"{BASE_URL}/api/clubs/join", json={"code": club["code"]}, headers=H(userB))
    assert rj.status_code == 200
    yield club
    try:
        _db.clubs.delete_one({"club_id": club["club_id"]})
        _db.club_messages.delete_many({"club_id": club["club_id"]})
    except Exception:
        pass


class TestChallenge:
    def test_patch_challenge_missing_title_400(self, api, userA, club_ctx):
        r = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={"challenge": {"title": "", "goal_pages": 100}},
            headers=H(userA),
        )
        assert r.status_code == 400
        assert "challenge_invalid" in r.text

    def test_patch_challenge_missing_goal_400(self, api, userA, club_ctx):
        r = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={"challenge": {"title": "Objectif", "goal_pages": 0}},
            headers=H(userA),
        )
        assert r.status_code == 400
        assert "challenge_invalid" in r.text

    def test_patch_challenge_non_owner_403(self, api, userB, club_ctx):
        r = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={"challenge": {"title": "Objectif", "goal_pages": 200}},
            headers=H(userB),
        )
        assert r.status_code == 403

    def test_patch_challenge_owner_ok(self, api, userA, club_ctx):
        r = api.patch(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}",
            json={"challenge": {"title": "Objectif Candide", "goal_pages": 150}},
            headers=H(userA),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        ch = d.get("challenge")
        assert ch is not None
        assert ch["title"] == "Objectif Candide"
        assert ch["goal_pages"] == 150
        assert "leaderboard" in ch
        assert "my_pages" in ch
        assert ch["my_pages"] == 0

    def test_progress_403_non_member(self, api, club_ctx):
        # register a fresh 3rd user, not member
        email = f"test_it5_c_{uuid.uuid4().hex[:8]}@example.com"
        rc = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"Carol{uuid.uuid4().hex[:3]}"})
        assert rc.status_code == 200
        tok = rc.json()["session_token"]
        r = api.post(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/challenge/progress",
            json={"pages": 10},
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        )
        assert r.status_code == 403

    def test_progress_owner_and_member(self, api, userA, userB, club_ctx):
        # userA logs 90 pages
        r1 = api.post(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/challenge/progress",
            json={"pages": 90},
            headers=H(userA),
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["challenge"]["my_pages"] == 90
        # userB logs 42 pages
        r2 = api.post(
            f"{BASE_URL}/api/clubs/{club_ctx['club_id']}/challenge/progress",
            json={"pages": 42},
            headers=H(userB),
        )
        assert r2.status_code == 200
        # GET club as userA -> leaderboard sorted desc, userA first
        r = api.get(f"{BASE_URL}/api/clubs/{club_ctx['club_id']}", headers=H(userA))
        assert r.status_code == 200
        board = r.json()["challenge"]["leaderboard"]
        assert len(board) == 2
        assert board[0]["pages"] >= board[1]["pages"]
        assert board[0]["pages"] == 90
        assert board[1]["pages"] == 42
        # is_me correct for userA
        me = [b for b in board if b["is_me"]]
        assert len(me) == 1 and me[0]["pages"] == 90
        # pct = 90/150 = 60
        assert me[0]["pct"] == 60

    def test_progress_no_challenge_400(self, api, userA, userB):
        # Create a fresh club with no challenge
        rc = api.post(f"{BASE_URL}/api/clubs", json={"name": "TEST_NoCh", "description": "x"}, headers=H(userA))
        assert rc.status_code == 200
        cid = rc.json()["club_id"]
        try:
            r = api.post(f"{BASE_URL}/api/clubs/{cid}/challenge/progress", json={"pages": 5}, headers=H(userA))
            assert r.status_code == 400
            assert "no_challenge" in r.text
        finally:
            _db.clubs.delete_one({"club_id": cid})


# ================================================================
# STATS / READING
# ================================================================
class TestReadingStats:
    def test_shape(self, api, userA):
        r = api.get(f"{BASE_URL}/api/stats/reading", headers=H(userA))
        assert r.status_code == 200
        d = r.json()
        assert "streak" in d
        assert isinstance(d["week"], list) and len(d["week"]) == 7
        for item in d["week"]:
            assert "day" in item and "label" in item and "pages" in item and "active" in item
        assert "week_pages" in d
        assert "active_days_month" in d

    def test_quote_creation_marks_today_active(self, api, userA):
        # Create book + quote for userA (fresh module user has no events yet from this run only)
        rb = api.post(
            f"{BASE_URL}/api/books",
            json={"type": "papier", "title": "TEST_StatsBook", "author": "A", "status": "en_cours", "mode": "perso"},
            headers=H(userA),
        )
        assert rb.status_code == 200
        book_id = rb.json()["book_id"]
        try:
            rq = api.post(
                f"{BASE_URL}/api/quotes",
                json={"text": "Une citation de test.", "book_id": book_id, "page": 5},
                headers=H(userA),
            )
            assert rq.status_code == 200
            # verify stats: today active
            r = api.get(f"{BASE_URL}/api/stats/reading", headers=H(userA))
            assert r.status_code == 200
            week = r.json()["week"]
            today_entry = week[-1]  # last is today
            assert today_entry["day"] == _today()
            assert today_entry["active"] is True
        finally:
            api.delete(f"{BASE_URL}/api/books/{book_id}", headers=H(userA))

    def test_progress_pages_increases_week_pages(self, api, userA):
        rb = api.post(
            f"{BASE_URL}/api/books",
            json={"type": "papier", "title": "TEST_ProgBook", "author": "A", "status": "en_cours", "mode": "perso", "progress_page": 0},
            headers=H(userA),
        )
        assert rb.status_code == 200
        book_id = rb.json()["book_id"]
        try:
            before = api.get(f"{BASE_URL}/api/stats/reading", headers=H(userA)).json()["week_pages"]
            # PATCH progress +25
            rp = api.patch(f"{BASE_URL}/api/books/{book_id}", json={"progress_page": 25}, headers=H(userA))
            assert rp.status_code == 200
            after = api.get(f"{BASE_URL}/api/stats/reading", headers=H(userA)).json()["week_pages"]
            assert after - before == 25, f"expected +25 week_pages, got {after - before}"
        finally:
            api.delete(f"{BASE_URL}/api/books/{book_id}", headers=H(userA))
