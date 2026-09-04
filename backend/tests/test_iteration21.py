"""Iteration 21 — post-merge c2dda1d checklist.

Focus:
- Follows: GET /me/follows, GET /readers/{handle}/follows, POST /readers/{handle}/follow toggle.
- Catalog browse regression: chips + exact_total + match_score/match_of ("Proches de ta recherche").
- Catalog search: "Adichie" returns online catalog books.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "Missing EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

LOTC = ("test_lotc@manent.app", "Test1234!")
RECO = ("test_reco@manent.app", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["session_token"], r.json()["user"]


@pytest.fixture(scope="module")
def lotc():
    tok, u = _login(*LOTC)
    return {"tok": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def reco():
    tok, u = _login(*RECO)
    return {"tok": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


# ================= FOLLOWS =================
class TestFollows:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200

    def test_me_follows_shape(self, lotc):
        r = requests.get(f"{API}/me/follows", headers=lotc["h"], timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("followers", "following", "followers_count", "following_count"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["followers"], list)
        assert isinstance(d["following"], list)

    def test_reader_follows_public(self, lotc, reco):
        # Read someone else's follows
        r = requests.get(f"{API}/readers/{reco['user']['handle']}/follows", headers=lotc["h"], timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("pseudo")
        assert "followers_count" in d and "following_count" in d

    def test_reader_follows_404(self, lotc):
        r = requests.get(f"{API}/readers/no_such_user_xxx/follows", headers=lotc["h"], timeout=15)
        assert r.status_code == 404

    def test_follow_toggle_end_to_end(self, lotc, reco):
        target = reco["user"]["handle"]
        # Baseline
        b0 = requests.get(f"{API}/me/follows", headers=lotc["h"], timeout=15).json()
        rec0 = requests.get(f"{API}/readers/{target}/follows", headers=lotc["h"], timeout=15).json()
        base_following = b0["following_count"]
        base_followers = rec0["followers_count"]

        # FOLLOW
        r = requests.post(f"{API}/readers/{target}/follow", headers=lotc["h"], timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # If already following (from previous test run), toggle back first
        if d.get("following") is False:
            r = requests.post(f"{API}/readers/{target}/follow", headers=lotc["h"], timeout=15)
            assert r.status_code == 200
            d = r.json()
            base_following = b0["following_count"] - 1  # we just decreased
            base_followers = rec0["followers_count"] - 1
        assert d["following"] is True
        assert d["followers"] >= 1

        # Verify /me/follows count went up by 1
        b1 = requests.get(f"{API}/me/follows", headers=lotc["h"], timeout=15).json()
        assert b1["following_count"] == base_following + 1, (b0, b1)
        # And reco appears
        handles = [x["handle"] for x in b1["following"]]
        assert target in handles

        # Verify target's followers went up (viewed by lotc so is_following=True should show)
        rec1 = requests.get(f"{API}/readers/{target}/follows", headers=lotc["h"], timeout=15).json()
        assert rec1["followers_count"] == base_followers + 1
        me_in_followers = [x for x in rec1["followers"] if x["handle"] == lotc["user"]["handle"]]
        assert me_in_followers, "current user should appear in target's followers list"

        # UNFOLLOW
        r = requests.post(f"{API}/readers/{target}/follow", headers=lotc["h"], timeout=15)
        assert r.status_code == 200
        assert r.json()["following"] is False
        b2 = requests.get(f"{API}/me/follows", headers=lotc["h"], timeout=15).json()
        assert b2["following_count"] == base_following, (b1, b2)

    def test_follow_self_forbidden(self, lotc):
        r = requests.post(f"{API}/readers/{lotc['user']['handle']}/follow", headers=lotc["h"], timeout=15)
        assert r.status_code == 400
        assert "self_follow" in r.text

    def test_public_profile_has_followers_stats(self, lotc, reco):
        r = requests.get(f"{API}/readers/{reco['user']['handle']}", headers=lotc["h"], timeout=15)
        assert r.status_code == 200
        stats = r.json().get("stats") or {}
        assert "followers" in stats and "following" in stats


# ================= CATALOG BROWSE (chips + Proches de ta recherche) =================
class TestCatalogBrowseRegression:
    def test_browse_chips_returned(self, lotc):
        r = requests.get(f"{API}/catalog/browse?continent=afrique&type=fiction", headers=lotc["h"], timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "results" in d and "total" in d and "exact_total" in d
        assert "chips" in d
        # chips have dim/key/label
        for c in d["chips"]:
            assert "dim" in c and "key" in c and "label" in c
            assert not any(e in c["label"] for e in ("🌍", "🌎", "🌏", "🌐"))
        assert d["total"] >= 1

    def test_browse_partial_matches(self, lotc):
        # Combine 2 dims → should return exact + partial with match_score/match_of
        r = requests.get(
            f"{API}/catalog/browse?continent=afrique&theme=deuil&type=fiction",
            headers=lotc["h"], timeout=25,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= d["exact_total"], (d["total"], d["exact_total"])
        # If total > exact_total then results should carry match_score / match_of
        if d["total"] > d["exact_total"] and d["results"]:
            has_partial = any(
                (b.get("match_of") and b.get("match_score") is not None and b["match_score"] < b["match_of"])
                for b in d["results"]
            )
            has_exact = any(
                (b.get("match_of") and b.get("match_score") == b.get("match_of"))
                for b in d["results"]
            )
            assert has_partial or has_exact, "expected match_score/match_of on partial-match browse"

    def test_browse_pagination_see_more(self, lotc):
        r1 = requests.get(f"{API}/catalog/browse?continent=afrique&size=10&page=1", headers=lotc["h"], timeout=20).json()
        r2 = requests.get(f"{API}/catalog/browse?continent=afrique&size=10&page=2", headers=lotc["h"], timeout=20).json()
        assert r1["total"] >= 11
        ids1 = {b.get("catalog_id") for b in r1["results"]}
        ids2 = {b.get("catalog_id") for b in r2["results"]}
        assert ids1 and ids2 and not ids1.intersection(ids2), "pagination should return disjoint sets"


# ================= CATALOG SEARCH (Adichie) =================
class TestCatalogSearch:
    def test_search_adichie(self, lotc):
        r = requests.get(f"{API}/catalog/search?q=Adichie&page=1&size=10", headers=lotc["h"], timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 3, d
        titles = " | ".join([b.get("title", "") for b in d["results"]]).lower()
        # At least one Adichie work
        assert any(w in titles for w in ("hibiscus", "yellow sun", "americanah", "half of")), titles


# ================= SEARCH (unified /api/search) =================
class TestUnifiedSearch:
    def test_search_scope_all(self, lotc):
        r = requests.get(f"{API}/search?q=roman&scope=all", headers=lotc["h"], timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("quotes", "books", "readers"):
            assert k in d, f"missing {k}"
