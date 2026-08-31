"""
Iteration 16 backend tests — Club events, gamification, admin dashboard, quote visibility.
Requires: MONGO_URL for granting is_admin to test users.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://lecture-capture-24.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


def register(pseudo_prefix="U"):
    email = f"TEST_it16_{uuid.uuid4().hex[:8]}@example.com"
    body = {
        "email": email,
        "password": "Test1234!",
        "pseudo": f"{pseudo_prefix}{uuid.uuid4().hex[:4]}",
        "birthdate": "1995-04-12",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    return {
        "token": d["session_token"],
        "user": d["user"],
        "email": email,
        "password": body["password"],
        "handle": d["user"]["handle"],
    }


def make_admin(user_id):
    """Uses local mongo to set is_admin=True."""
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "manent_db")
    cli = MongoClient(mongo_url)
    cli[db_name].users.update_one({"user_id": user_id}, {"$set": {"is_admin": True}})
    cli.close()


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Session-scoped fixtures ---
@pytest.fixture(scope="module")
def admin_user():
    u = register("Admin")
    make_admin(u["user"]["user_id"])
    return u


@pytest.fixture(scope="module")
def user_b():
    return register("UserB")


@pytest.fixture(scope="module")
def user_c():
    return register("UserC")


# =========================================================
# Events
# =========================================================
class TestEvents:
    def test_create_forbidden_non_admin(self, user_b):
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/club/events",
                          json={"title": "T16 Forbidden", "type": "discussion", "date": future},
                          headers=H(user_b["token"]))
        assert r.status_code == 403

    def test_admin_create_event_and_list(self, admin_user, user_b):
        future = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        r = requests.post(f"{BASE_URL}/api/club/events",
                          json={"title": "TEST_it16 Discussion", "type": "discussion",
                                "date": future, "location": "Salle A"},
                          headers=H(admin_user["token"]))
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["event_id"].startswith("ev_")
        assert ev["participants_count"] == 0
        assert ev["i_participate"] is False
        pytest.event_id = ev["event_id"]

        # list events (admin)
        r2 = requests.get(f"{BASE_URL}/api/club/events", headers=H(admin_user["token"]))
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("is_admin") is True
        ids = [e["event_id"] for e in data["events"]]
        assert pytest.event_id in ids

        # list events (non-admin)
        r3 = requests.get(f"{BASE_URL}/api/club/events", headers=H(user_b["token"]))
        assert r3.status_code == 200
        assert r3.json().get("is_admin") is False

    def test_past_events_hidden(self, admin_user):
        past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        r = requests.post(f"{BASE_URL}/api/club/events",
                          json={"title": "TEST_it16 Past", "type": "discussion", "date": past},
                          headers=H(admin_user["token"]))
        assert r.status_code == 200
        past_id = r.json()["event_id"]
        r2 = requests.get(f"{BASE_URL}/api/club/events", headers=H(admin_user["token"]))
        ids = [e["event_id"] for e in r2.json()["events"]]
        assert past_id not in ids, "past event should not be returned"

    def test_join_and_leave(self, user_b):
        eid = pytest.event_id
        r = requests.post(f"{BASE_URL}/api/club/events/{eid}/join", headers=H(user_b["token"]))
        assert r.status_code == 200
        assert r.json()["i_participate"] is True
        r2 = requests.get(f"{BASE_URL}/api/club/events", headers=H(user_b["token"]))
        ev = next(e for e in r2.json()["events"] if e["event_id"] == eid)
        assert ev["participants_count"] == 1
        assert ev["i_participate"] is True

        r3 = requests.post(f"{BASE_URL}/api/club/events/{eid}/leave", headers=H(user_b["token"]))
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE_URL}/api/club/events", headers=H(user_b["token"]))
        ev = next(e for e in r4.json()["events"] if e["event_id"] == eid)
        assert ev["participants_count"] == 0
        assert ev["i_participate"] is False

    def test_delete_forbidden_non_admin(self, user_b):
        eid = pytest.event_id
        r = requests.delete(f"{BASE_URL}/api/club/events/{eid}", headers=H(user_b["token"]))
        assert r.status_code == 403

    def test_delete_admin(self, admin_user):
        eid = pytest.event_id
        r = requests.delete(f"{BASE_URL}/api/club/events/{eid}", headers=H(admin_user["token"]))
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/club/events", headers=H(admin_user["token"]))
        assert eid not in [e["event_id"] for e in r2.json()["events"]]


# =========================================================
# Gamification
# =========================================================
class TestGamification:
    def test_empty_gamification(self, user_c):
        r = requests.get(f"{BASE_URL}/api/club/gamification", headers=H(user_c["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "me" in d and "challenge" in d and "leaderboard" in d
        assert d["challenge"]["goal"] == 12
        assert d["challenge"]["year"] == datetime.now(timezone.utc).year
        assert d["me"]["points"] == 0
        assert isinstance(d["me"]["badges"], list)

    def test_points_calculation(self):
        # Fresh user to avoid cross-test contamination when xdist shares fixtures
        u = register("Pts")
        token = u["token"]
        # 1 finished book = +100, 1 fiche = +30
        r = requests.post(f"{BASE_URL}/api/books",
                          json={"type": "papier", "title": "TEST_it16 Book1", "status": "termine", "pages": 100},
                          headers=H(token))
        assert r.status_code == 200
        book_id = r.json()["book_id"]
        # add sheet (fiche) -> +30
        r = requests.patch(f"{BASE_URL}/api/books/{book_id}",
                           json={"sheet": {"summary": "TEST_it16 fiche summary"}},
                           headers=H(token))
        assert r.status_code == 200
        # 1 club book + 1 post +10
        rcb = requests.post(f"{BASE_URL}/api/club/books",
                            json={"title": "TEST_it16 ClubBook", "author": "A"}, headers=H(token))
        assert rcb.status_code == 200
        cb_id = rcb.json()["cb_id"]
        rpost = requests.post(f"{BASE_URL}/api/club/books/{cb_id}/posts",
                              json={"text": "TEST_it16 post content"}, headers=H(token))
        assert rpost.status_code == 200
        # 1 review = +5
        rrev = requests.post(f"{BASE_URL}/api/club/books/{cb_id}/reviews",
                             json={"criteria": {"histoire": 5, "ecriture": 4}}, headers=H(token))
        assert rrev.status_code == 200

        r = requests.get(f"{BASE_URL}/api/club/gamification", headers=H(token))
        assert r.status_code == 200
        d = r.json()
        # 100 (finished) + 30 (fiche) + 10 (post) + 5 (review) = 145
        assert d["me"]["points"] == 145, f"points={d['me']['points']} not 145"
        assert d["challenge"]["progress"] >= 1
        # premier_livre badge
        badge_ids = [b["id"] for b in d["me"]["badges"]]
        assert "premier_livre" in badge_ids
        # leaderboard sorted desc
        pts = [b["points"] for b in d["leaderboard"]]
        assert pts == sorted(pts, reverse=True)
        # rank present
        assert d["me"]["rank"] is not None


# =========================================================
# Admin overview / reports
# =========================================================
class TestAdmin:
    def test_overview_forbidden_non_admin(self, user_b):
        r = requests.get(f"{BASE_URL}/api/club/admin/overview", headers=H(user_b["token"]))
        assert r.status_code == 403

    def test_overview_admin(self, admin_user):
        r = requests.get(f"{BASE_URL}/api/club/admin/overview", headers=H(admin_user["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stats" in d and "reports" in d
        for k in ["members", "club_books", "posts", "reviews", "events", "polls", "quotes_public"]:
            assert k in d["stats"], f"missing stat key: {k}"

    def test_report_ignore_flow(self, admin_user, user_b):
        # user_b creates a post, then reports it
        rcb = requests.post(f"{BASE_URL}/api/club/books",
                            json={"title": "TEST_it16 ReportBook Ignore"}, headers=H(user_b["token"]))
        cb_id = rcb.json()["cb_id"]
        rpost = requests.post(f"{BASE_URL}/api/club/books/{cb_id}/posts",
                              json={"text": "TEST_it16 to_ignore"}, headers=H(user_b["token"]))
        post_id = rpost.json()["post_id"]
        rr = requests.post(f"{BASE_URL}/api/club/report",
                           json={"kind": "post", "target_id": post_id, "reason": "test"},
                           headers=H(user_b["token"]))
        assert rr.status_code == 200

        # admin sees the report in overview
        r = requests.get(f"{BASE_URL}/api/club/admin/overview", headers=H(admin_user["token"]))
        reports = r.json()["reports"]
        match = next((rp for rp in reports if rp["target_id"] == post_id), None)
        assert match is not None, "report not visible to admin"
        assert match.get("content") == "TEST_it16 to_ignore"
        assert "reporter" in match
        report_id = match["report_id"]

        # ignore
        r2 = requests.post(f"{BASE_URL}/api/club/admin/reports/{report_id}",
                           json={"action": "ignore"}, headers=H(admin_user["token"]))
        assert r2.status_code == 200

        # post still exists
        rposts = requests.get(f"{BASE_URL}/api/club/books/{cb_id}/posts", headers=H(user_b["token"]))
        ids = [p["post_id"] for p in rposts.json()["posts"]]
        assert post_id in ids, "post should NOT be deleted for ignore action"

        # report closed → not in open list
        r3 = requests.get(f"{BASE_URL}/api/club/admin/overview", headers=H(admin_user["token"]))
        assert not any(rp["report_id"] == report_id for rp in r3.json()["reports"])

    def test_report_delete_flow(self, admin_user, user_b):
        rcb = requests.post(f"{BASE_URL}/api/club/books",
                            json={"title": "TEST_it16 ReportBook Delete"}, headers=H(user_b["token"]))
        cb_id = rcb.json()["cb_id"]
        rpost = requests.post(f"{BASE_URL}/api/club/books/{cb_id}/posts",
                              json={"text": "TEST_it16 to_delete"}, headers=H(user_b["token"]))
        post_id = rpost.json()["post_id"]
        requests.post(f"{BASE_URL}/api/club/report",
                      json={"kind": "post", "target_id": post_id},
                      headers=H(user_b["token"]))
        r = requests.get(f"{BASE_URL}/api/club/admin/overview", headers=H(admin_user["token"]))
        match = next(rp for rp in r.json()["reports"] if rp["target_id"] == post_id)
        report_id = match["report_id"]
        r2 = requests.post(f"{BASE_URL}/api/club/admin/reports/{report_id}",
                           json={"action": "delete"}, headers=H(admin_user["token"]))
        assert r2.status_code == 200
        # post deleted
        rposts = requests.get(f"{BASE_URL}/api/club/books/{cb_id}/posts", headers=H(user_b["token"]))
        ids = [p["post_id"] for p in rposts.json()["posts"]]
        assert post_id not in ids, "post SHOULD be deleted"


# =========================================================
# Quote visibility (3 levels)
# =========================================================
class TestQuoteVisibility:
    def test_followers_visibility(self, user_b, user_c):
        # user_b is author; user_c will follow, user "d" won't
        user_d = register("UserD")
        # Create quote for user_b with visibility=followers
        r = requests.post(f"{BASE_URL}/api/quotes",
                          json={"text": "TEST_it16 followers quote", "visibility": "followers"},
                          headers=H(user_b["token"]))
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["is_public"] is False
        assert q["visibility"] == "followers"
        qid = q["quote_id"]

        # user_c follows user_b
        rf = requests.post(f"{BASE_URL}/api/readers/{user_b['handle']}/follow",
                           headers=H(user_c["token"]))
        assert rf.status_code == 200 and rf.json()["following"] is True

        # user_c can GET the quote
        rc = requests.get(f"{BASE_URL}/api/quotes/{qid}", headers=H(user_c["token"]))
        assert rc.status_code == 200, f"follower should see quote, got {rc.status_code}"

        # user_d (not following) → 404
        rd = requests.get(f"{BASE_URL}/api/quotes/{qid}", headers=H(user_d["token"]))
        assert rd.status_code == 404, f"non-follower should not see quote, got {rd.status_code}"

        # Owner sees own
        ro = requests.get(f"{BASE_URL}/api/quotes/{qid}", headers=H(user_b["token"]))
        assert ro.status_code == 200

    def test_private_and_public_and_patch(self, user_b, user_c):
        # private
        rp = requests.post(f"{BASE_URL}/api/quotes",
                           json={"text": "TEST_it16 private quote", "visibility": "private"},
                           headers=H(user_b["token"]))
        assert rp.status_code == 200
        priv_id = rp.json()["quote_id"]
        assert rp.json()["is_public"] is False
        # user_c (follower) can't see private
        rc = requests.get(f"{BASE_URL}/api/quotes/{priv_id}", headers=H(user_c["token"]))
        assert rc.status_code == 404

        # public
        rpub = requests.post(f"{BASE_URL}/api/quotes",
                             json={"text": "TEST_it16 public quote", "visibility": "public"},
                             headers=H(user_b["token"]))
        pub_id = rpub.json()["quote_id"]
        assert rpub.json()["is_public"] is True
        # unrelated user can see
        stranger = register("Stranger")
        rs = requests.get(f"{BASE_URL}/api/quotes/{pub_id}", headers=H(stranger["token"]))
        assert rs.status_code == 200

        # PATCH private → public
        rpatch = requests.patch(f"{BASE_URL}/api/quotes/{priv_id}",
                                json={"visibility": "public"}, headers=H(user_b["token"]))
        assert rpatch.status_code == 200
        assert rpatch.json()["is_public"] is True
        # now stranger sees it
        rs2 = requests.get(f"{BASE_URL}/api/quotes/{priv_id}", headers=H(stranger["token"]))
        assert rs2.status_code == 200
