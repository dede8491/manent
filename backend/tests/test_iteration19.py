"""Iteration 19 — Post-merge checklist (share boards/clubs, invitations, quote actions, share pages)."""
import os, uuid, time
import requests
import pytest


def _base_url():
    v = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not v:
        from pathlib import Path
        for line in Path("/app/frontend/.env").read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                v = line.split("=", 1)[1].strip().strip('"')
                break
    return v.rstrip("/")


BASE = _base_url()
API = f"{BASE}/api"


def _register(hint: str = "T"):
    email = f"test_it19_{hint}_{uuid.uuid4().hex[:8]}@manent.app"
    body = {"email": email, "password": "Test1234!", "pseudo": f"It19{hint}{uuid.uuid4().hex[:4]}", "birthdate": "1990-01-01"}
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email, "pseudo": body["pseudo"], "handle": d["user"].get("handle")}


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def userA():
    return _register("A")


@pytest.fixture(scope="module")
def userB():
    return _register("B")


# ---------- health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200


# ---------- BOARDS: create, get share_slug + invite_code ----------
class TestBoardShareInvite:
    def test_create_board_returns_share_slug_and_invite_code(self, userA):
        r = requests.post(f"{API}/boards", json={"name": f"TEST_it19 board {uuid.uuid4().hex[:5]}", "visibility": "private"}, headers=_headers(userA["token"]))
        assert r.status_code in (200, 201), r.text
        b = r.json()
        assert "board_id" in b
        # GET returns share_slug + invite_code + members_info + is_owner
        g = requests.get(f"{API}/boards/{b['board_id']}", headers=_headers(userA["token"]))
        assert g.status_code == 200
        gd = g.json()
        assert gd.get("share_slug"), "share_slug missing"
        assert gd.get("invite_code"), "invite_code missing"
        assert isinstance(gd.get("members_info"), list)
        assert gd.get("is_owner") is True
        pytest.board = gd  # stash

    def test_board_by_slug_lookup(self, userA):
        b = pytest.board
        r = requests.get(f"{API}/boards/by-slug/{b['share_slug']}", headers=_headers(userA["token"]))
        assert r.status_code == 200
        assert r.json()["board_id"] == b["board_id"]

    def test_board_join_via_code(self, userA, userB):
        b = pytest.board
        r = requests.post(f"{API}/boards/join", json={"code": b["invite_code"]}, headers=_headers(userB["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["board_id"] == b["board_id"]
        # verify userB is now member
        g = requests.get(f"{API}/boards/{b['board_id']}", headers=_headers(userB["token"]))
        assert g.status_code == 200
        assert userB["user"]["user_id"] in (g.json().get("members") or [])

    def test_board_regenerate_invite_code(self, userA):
        b = pytest.board
        r = requests.post(f"{API}/boards/{b['board_id']}/invite-code", headers=_headers(userA["token"]))
        assert r.status_code == 200
        assert r.json()["invite_code"] != b["invite_code"]


# ---------- SHARE PAGES (/api/s/t/{slug}) ----------
class TestSharePages:
    def test_board_share_page_private_without_code(self, userA):
        # create private board
        r = requests.post(f"{API}/boards", json={"name": f"TEST_it19 priv {uuid.uuid4().hex[:5]}", "visibility": "private"}, headers=_headers(userA["token"]))
        b_id = r.json()["board_id"]
        g = requests.get(f"{API}/boards/{b_id}", headers=_headers(userA["token"]))
        slug = g.json()["share_slug"]
        page = requests.get(f"{API}/s/t/{slug}", timeout=15)
        assert page.status_code == 200
        assert "text/html" in page.headers.get("content-type", "")
        assert "Un tableau privé sur Manent" in page.text

    def test_board_share_page_with_code_returns_join(self, userA):
        r = requests.post(f"{API}/boards", json={"name": f"TEST_it19 join {uuid.uuid4().hex[:5]}", "visibility": "private"}, headers=_headers(userA["token"]))
        b_id = r.json()["board_id"]
        g = requests.get(f"{API}/boards/{b_id}", headers=_headers(userA["token"])).json()
        slug, code = g["share_slug"], g["invite_code"]
        page = requests.get(f"{API}/s/t/{slug}?code={code}", timeout=15)
        assert page.status_code == 200
        # Should be the join page (not the "privé" one) and contain the manent://t/... scheme with code
        assert "Un tableau privé sur Manent" not in page.text
        assert "Rejoindre le tableau" in page.text
        assert f"code={code}" in page.text

    def test_board_share_page_public_no_code(self, userA):
        r = requests.post(f"{API}/boards", json={"name": f"TEST_it19 pub {uuid.uuid4().hex[:5]}", "visibility": "public"}, headers=_headers(userA["token"]))
        b_id = r.json()["board_id"]
        g = requests.get(f"{API}/boards/{b_id}", headers=_headers(userA["token"])).json()
        page = requests.get(f"{API}/s/t/{g['share_slug']}", timeout=15)
        assert page.status_code == 200
        assert "Un tableau privé" not in page.text


# ---------- CLUB invitations ----------
class TestClubInvitations:
    def test_create_club_and_invite(self, userA, userB):
        # userA follows userB so invitation is allowed
        requests.post(f"{API}/follow/{userB['user']['user_id']}", headers=_headers(userA["token"]))
        # Club creation requires premium — elevate userA in DB
        import subprocess
        subprocess.run(["mongosh", "--quiet", "manent_db", "--eval",
                        f"db.users.updateOne({{user_id:'{userA['user']['user_id']}'}},{{$set:{{is_premium:true}}}})"], check=False, capture_output=True)
        r = requests.post(f"{API}/clubs", json={"name": f"TEST_it19 club {uuid.uuid4().hex[:5]}"}, headers=_headers(userA["token"]))
        assert r.status_code in (200, 201), r.text
        club = r.json()
        assert club.get("club_id")
        # invite userB
        inv = requests.post(f"{API}/invitations", json={"kind": "club", "target_id": club["club_id"], "to_handle": userB["handle"]}, headers=_headers(userA["token"]))
        assert inv.status_code == 200, inv.text
        d = inv.json()
        assert d.get("ok") is True
        # userB sees pending invitation
        blist = requests.get(f"{API}/invitations", headers=_headers(userB["token"]))
        assert blist.status_code == 200
        invs = blist.json()["invitations"]
        assert any(x.get("target_id") == club["club_id"] for x in invs), f"invitation not visible: {invs}"

    def test_invite_board(self, userA, userB):
        r = requests.post(f"{API}/boards", json={"name": f"TEST_it19 boardinv {uuid.uuid4().hex[:5]}", "visibility": "collaborative"}, headers=_headers(userA["token"]))
        assert r.status_code == 200, r.text
        b_id = r.json()["board_id"]
        inv = requests.post(f"{API}/invitations", json={"kind": "board", "target_id": b_id, "to_handle": userB["handle"]}, headers=_headers(userA["token"]))
        assert inv.status_code == 200
        # badge
        bg = requests.get(f"{API}/invitations/badge", headers=_headers(userB["token"]))
        assert bg.status_code == 200
        # (badge may be 0 if userB just read invitations in previous test — read status is per-marker)


# ---------- QUOTE actions: like, comments, pin ----------
class TestQuoteActions:
    def _mkquote(self, u):
        # create book + public quote
        b = requests.post(f"{API}/books", json={"type": "papier", "title": f"TEST_it19 {uuid.uuid4().hex[:4]}", "author": "Anon"}, headers=_headers(u["token"]))
        assert b.status_code == 200, b.text
        book_id = b.json()["book_id"]
        q = requests.post(f"{API}/quotes", json={"book_id": book_id, "text": "TEST_it19 quote content", "is_public": True}, headers=_headers(u["token"]))
        assert q.status_code == 200, q.text
        return q.json()["quote_id"], book_id

    def test_like_toggle_and_notify(self, userA, userB):
        qid, _ = self._mkquote(userA)
        # userB likes it
        r1 = requests.post(f"{API}/quotes/{qid}/like", headers=_headers(userB["token"]))
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["liked"] is True and d1["likes_count"] >= 1
        # unlike
        r2 = requests.post(f"{API}/quotes/{qid}/like", headers=_headers(userB["token"]))
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["liked"] is False
        assert d2["likes_count"] == d1["likes_count"] - 1

    def test_comment_add_and_delete_own(self, userA, userB):
        qid, _ = self._mkquote(userA)
        c = requests.post(f"{API}/quotes/{qid}/comments", json={"text": "test comment from B"}, headers=_headers(userB["token"]))
        assert c.status_code == 200, c.text
        cid = c.json().get("comment_id") or c.json().get("id")
        assert cid, c.text
        # userB deletes own comment
        d = requests.delete(f"{API}/quotes/{qid}/comments/{cid}", headers=_headers(userB["token"]))
        assert d.status_code == 200, d.text

    def test_author_can_delete_others_comment(self, userA, userB):
        qid, _ = self._mkquote(userA)
        c = requests.post(f"{API}/quotes/{qid}/comments", json={"text": "another test"}, headers=_headers(userB["token"]))
        cid = c.json().get("comment_id") or c.json().get("id")
        # userA (quote author) deletes userB's comment
        d = requests.delete(f"{API}/quotes/{qid}/comments/{cid}", headers=_headers(userA["token"]))
        assert d.status_code == 200, d.text

    def test_pin_to_board(self, userA):
        qid, _ = self._mkquote(userA)
        b = requests.post(f"{API}/boards", json={"name": f"TEST_it19 pinboard {uuid.uuid4().hex[:5]}", "visibility": "private"}, headers=_headers(userA["token"]))
        board_id = b.json()["board_id"]
        p = requests.post(f"{API}/boards/{board_id}/pin", json={"quote_id": qid}, headers=_headers(userA["token"]))
        assert p.status_code == 200, p.text


# ---------- FEED cœur direct ----------
def test_feed_returns_quotes_with_like_state(userA):
    r = requests.get(f"{API}/feed", headers=_headers(userA["token"]))
    assert r.status_code == 200
    d = r.json()
    assert "quotes" in d
    # If any quote is present, verify shape
    for q in d["quotes"][:3]:
        assert "quote_id" in q
        assert "likes_count" in q
        assert "liked_by_me" in q


# ---------- Comments listing ----------
def test_comments_list_shape(userA, userB):
    b = requests.post(f"{API}/books", json={"type": "papier", "title": f"TEST_it19 clist {uuid.uuid4().hex[:4]}"}, headers=_headers(userA["token"]))
    q = requests.post(f"{API}/quotes", json={"book_id": b.json()["book_id"], "text": "TEST comments", "is_public": True}, headers=_headers(userA["token"]))
    qid = q.json()["quote_id"]
    requests.post(f"{API}/quotes/{qid}/comments", json={"text": "hello"}, headers=_headers(userB["token"]))
    r = requests.get(f"{API}/quotes/{qid}/comments", headers=_headers(userA["token"]))
    assert r.status_code == 200
    d = r.json()
    assert "comments" in d
    assert len(d["comments"]) >= 1
