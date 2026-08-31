"""
Iteration 12 — Suivi des lecteurs (Follow system)
Tests:
- POST /api/readers/{handle}/follow toggle behavior
- Auto-follow self returns 400
- Unknown handle returns 404
- GET /api/readers/{handle} contains is_following and stats.followers
- GET /api/feed marks followed authors and puts them on top
- POST /api/quotes with is_public succeeds despite push placeholder
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to the same var name the tests report expects
    BASE_URL = os.environ.get('EXPO_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

API = f"{BASE_URL}/api"


def _register(email_suffix: str, pseudo: str) -> dict:
    email = f"TEST_it12_{email_suffix}_{uuid.uuid4().hex[:8]}@manent.app"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "pseudo": pseudo,
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()  # {session_token, user}


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def follower():
    return _register("follower", f"Fol{uuid.uuid4().hex[:4]}")


@pytest.fixture(scope="module")
def author():
    """Author user with at least one public quote."""
    a = _register("author", f"Aut{uuid.uuid4().hex[:4]}")
    h = _auth_headers(a["session_token"])
    # Create a book
    rb = requests.post(f"{API}/books", headers=h, json={
        "type": "papier", "title": "TEST_it12 Book", "author": "T", "status": "en_cours", "mode": "perso",
    }, timeout=15)
    assert rb.status_code == 200, rb.text
    book_id = rb.json()["book_id"]
    # Create a public quote
    rq = requests.post(f"{API}/quotes", headers=h, json={
        "text": "TEST_it12 public quote for feed follow test",
        "book_id": book_id, "page": 1, "themes": ["résilience"], "is_public": True,
    }, timeout=15)
    assert rq.status_code == 200, rq.text  # non-blocking push should not affect
    a["book_id"] = book_id
    a["quote_id"] = rq.json()["quote_id"]
    return a


# --- Follow tests ---
class TestFollow:
    def test_follow_toggles(self, follower, author):
        h = _auth_headers(follower["session_token"])
        handle = author["user"]["handle"]
        # 1st call → following=True, followers>=1
        r1 = requests.post(f"{API}/readers/{handle}/follow", headers=h, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["following"] is True
        assert d1["followers"] >= 1
        # 2nd call → following=False
        r2 = requests.post(f"{API}/readers/{handle}/follow", headers=h, timeout=15)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["following"] is False
        # re-follow for downstream tests
        r3 = requests.post(f"{API}/readers/{handle}/follow", headers=h, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["following"] is True

    def test_self_follow_400(self, follower):
        h = _auth_headers(follower["session_token"])
        my_handle = follower["user"]["handle"]
        r = requests.post(f"{API}/readers/{my_handle}/follow", headers=h, timeout=15)
        assert r.status_code == 400
        assert r.json().get("detail") == "self_follow"

    def test_unknown_handle_404(self, follower):
        h = _auth_headers(follower["session_token"])
        r = requests.post(f"{API}/readers/does_not_exist_zzz_{uuid.uuid4().hex[:6]}/follow", headers=h, timeout=15)
        assert r.status_code == 404


class TestPublicProfile:
    def test_profile_contains_is_following_and_followers(self, follower, author):
        h = _auth_headers(follower["session_token"])
        handle = author["user"]["handle"]
        r = requests.get(f"{API}/readers/{handle}", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "is_following" in d and isinstance(d["is_following"], bool)
        assert d["is_following"] is True  # depends on TestFollow having re-followed
        assert "stats" in d and "followers" in d["stats"]
        assert isinstance(d["stats"]["followers"], int)
        assert d["stats"]["followers"] >= 1
        assert d["is_me"] is False

    def test_own_profile_is_me(self, follower):
        h = _auth_headers(follower["session_token"])
        r = requests.get(f"{API}/readers/{follower['user']['handle']}", headers=h, timeout=15)
        assert r.status_code == 200
        assert r.json()["is_me"] is True


class TestFeedFollowed:
    def test_feed_marks_followed_author_and_sorts_first(self, follower, author):
        h = _auth_headers(follower["session_token"])
        r = requests.get(f"{API}/feed", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        quotes = r.json()["quotes"]
        assert len(quotes) > 0
        # find our specific quote
        target = next((q for q in quotes if q.get("quote_id") == author["quote_id"]), None)
        assert target is not None, "Author's public quote must be in feed"
        assert target.get("is_followed_author") is True
        # It should be sorted first (all followed authors appear before non-followed)
        # Check first quote is followed
        assert quotes[0].get("is_followed_author") is True
        # Verify stable partitioning: no non-followed before a followed
        seen_non_followed = False
        for q in quotes:
            if not q.get("is_followed_author"):
                seen_non_followed = True
            elif seen_non_followed:
                pytest.fail("Followed author quote appeared after non-followed one — sort broken")


class TestQuoteCreationNonBlocking:
    def test_public_quote_creation_succeeds_despite_push_placeholder(self, author):
        """POST /api/quotes with is_public should succeed even if push relay fails."""
        h = _auth_headers(author["session_token"])
        r = requests.post(f"{API}/quotes", headers=h, json={
            "text": f"TEST_it12 non-blocking push {uuid.uuid4().hex[:6]}",
            "book_id": author["book_id"],
            "themes": [], "is_public": True,
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("quote_id")
