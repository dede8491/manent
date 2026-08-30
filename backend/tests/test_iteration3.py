"""Manent Iteration 3 tests:
- GET /api/themes/{theme}/page (public feed by theme + stats)
- GET /api/readers/{handle} (public profile)
- GET /api/quotes/{quote_id} (public quotes from other users, is_owner, author)
- DELETE/PATCH restricted to owner
"""
import uuid
import pytest
import requests


# ---------- fresh user helper ----------
@pytest.fixture(scope="module")
def user_a(base_url):
    email = f"i3a_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Test1234!", "pseudo": f"UA{uuid.uuid4().hex[:4]}"
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email,
            "h": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def user_b(base_url):
    email = f"i3b_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Test1234!", "pseudo": f"UB{uuid.uuid4().hex[:4]}"
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email,
            "h": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def seeded(base_url, user_a):
    """Trigger public seed (creates user_demo_manent with handle 'lea')."""
    r = requests.post(f"{base_url}/api/dev/seed", headers=user_a["h"])
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def a_quotes(base_url, user_a, seeded):
    """User A creates: 1 book, 1 public quote (theme=résilience), 1 private quote (theme=résilience)."""
    b = requests.post(f"{base_url}/api/books", headers=user_a["h"], json={
        "type": "papier", "title": "TEST_I3_A", "author": "Auteur A", "pages": 100, "status": "en_cours",
    }).json()
    qp = requests.post(f"{base_url}/api/quotes", headers=user_a["h"], json={
        "text": "TEST_I3 phrase publique de A.",
        "book_id": b["book_id"], "page": 12, "themes": ["résilience"], "is_public": True,
    }).json()
    qpriv = requests.post(f"{base_url}/api/quotes", headers=user_a["h"], json={
        "text": "TEST_I3 phrase privée de A.",
        "book_id": b["book_id"], "page": 44, "themes": ["résilience"], "is_public": False,
    }).json()
    yield {"book": b, "public": qp, "private": qpriv}
    # cleanup
    requests.delete(f"{base_url}/api/quotes/{qp['quote_id']}", headers=user_a["h"])
    requests.delete(f"{base_url}/api/quotes/{qpriv['quote_id']}", headers=user_a["h"])
    requests.delete(f"{base_url}/api/books/{b['book_id']}", headers=user_a["h"])


# ============ /api/themes/{theme}/page ============
class TestThemePage:
    def test_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/themes/résilience/page")
        assert r.status_code == 401

    def test_returns_stats_and_quotes(self, base_url, user_a, a_quotes):
        r = requests.get(f"{base_url}/api/themes/résilience/page", headers=user_a["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["theme"] == "résilience"
        assert "stats" in d and "quotes" in d
        stats = d["stats"]
        assert set(stats.keys()) == {"quotes", "readers", "books"}
        assert isinstance(stats["quotes"], int) and stats["quotes"] >= 1
        assert isinstance(stats["readers"], int) and stats["readers"] >= 1
        assert isinstance(stats["books"], int) and stats["books"] >= 1
        # each quote must have book + author attached
        for q in d["quotes"]:
            assert q.get("is_public") is True
            assert "author" in q and q["author"] is not None
            assert "pseudo" in q["author"] and "handle" in q["author"]

    def test_excludes_private_quotes(self, base_url, user_a, a_quotes):
        r = requests.get(f"{base_url}/api/themes/résilience/page", headers=user_a["h"])
        d = r.json()
        ids = [q["quote_id"] for q in d["quotes"]]
        assert a_quotes["public"]["quote_id"] in ids
        assert a_quotes["private"]["quote_id"] not in ids

    def test_stats_coherent_with_quotes_list(self, base_url, user_a, a_quotes):
        r = requests.get(f"{base_url}/api/themes/amour/page", headers=user_a["h"])
        d = r.json()
        # readers count == distinct authors count among quotes shown (list is limited to 80)
        if d["stats"]["quotes"] <= 80:
            distinct_authors = {q["author"]["handle"] for q in d["quotes"]}
            assert d["stats"]["readers"] == len(distinct_authors)

    def test_unknown_theme_zero_stats(self, base_url, user_a):
        r = requests.get(f"{base_url}/api/themes/unknown_zzz_theme_1234/page", headers=user_a["h"])
        assert r.status_code == 200
        d = r.json()
        assert d["stats"] == {"quotes": 0, "readers": 0, "books": 0}
        assert d["quotes"] == []


# ============ /api/readers/{handle} ============
class TestReaderProfile:
    def test_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/readers/lea")
        assert r.status_code == 401

    def test_unknown_handle_404(self, base_url, user_a):
        r = requests.get(f"{base_url}/api/readers/no_such_handle_xyz_9999", headers=user_a["h"])
        assert r.status_code == 404

    def test_lea_profile(self, base_url, user_a, seeded):
        r = requests.get(f"{base_url}/api/readers/lea", headers=user_a["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["handle"] == "lea"
        assert d["user"]["pseudo"] == "Léa"
        assert d["is_me"] is False
        stats = d["stats"]
        assert set(stats.keys()) == {"public_quotes", "books", "boards"}
        assert stats["public_quotes"] >= 1
        assert stats["books"] >= 1
        # all returned quotes are public and belong to lea
        for q in d["quotes"]:
            assert q["is_public"] is True
            assert q["author"]["handle"] == "lea"

    def test_is_me_true_on_self(self, base_url, user_a):
        me = requests.get(f"{base_url}/api/auth/me", headers=user_a["h"])
        assert me.status_code == 200, me.text
        handle = me.json()["user"]["handle"]
        r = requests.get(f"{base_url}/api/readers/{handle}", headers=user_a["h"])
        assert r.status_code == 200
        assert r.json()["is_me"] is True

    def test_does_not_return_private_quotes(self, base_url, user_a, a_quotes):
        me = requests.get(f"{base_url}/api/auth/me", headers=user_a["h"]).json()["user"]
        r = requests.get(f"{base_url}/api/readers/{me['handle']}", headers=user_a["h"])
        d = r.json()
        ids = [q["quote_id"] for q in d["quotes"]]
        assert a_quotes["public"]["quote_id"] in ids
        assert a_quotes["private"]["quote_id"] not in ids


# ============ /api/quotes/{id} public-of-other-user ============
class TestQuoteDetailPublic:
    def test_own_quote_is_owner_true(self, base_url, user_a, a_quotes):
        qid = a_quotes["public"]["quote_id"]
        r = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_a["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_owner"] is True
        assert "author" in d and d["author"] is not None

    def test_public_quote_of_other_user_visible(self, base_url, user_b, a_quotes):
        """User B fetches user A's PUBLIC quote → 200, is_owner=False, author is A."""
        qid = a_quotes["public"]["quote_id"]
        r = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_b["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_owner"] is False
        assert d["author"] is not None
        assert "handle" in d["author"] and "pseudo" in d["author"]

    def test_private_quote_of_other_user_returns_404(self, base_url, user_b, a_quotes):
        qid = a_quotes["private"]["quote_id"]
        r = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_b["h"])
        assert r.status_code == 404

    def test_unknown_quote_id_404(self, base_url, user_a):
        r = requests.get(f"{base_url}/api/quotes/q_does_not_exist_zzz", headers=user_a["h"])
        assert r.status_code == 404


# ============ Regression: DELETE / PATCH restricted to owner ============
class TestOwnershipRegression:
    def test_delete_by_non_owner_does_not_remove(self, base_url, user_a, user_b, a_quotes):
        qid = a_quotes["public"]["quote_id"]
        r = requests.delete(f"{base_url}/api/quotes/{qid}", headers=user_b["h"])
        # backend returns {"ok": True} silently but must NOT delete
        assert r.status_code == 200
        # verify persistence by re-fetching as owner A
        g = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_a["h"])
        assert g.status_code == 200
        assert g.json()["quote_id"] == qid

    def test_patch_by_non_owner_does_not_modify(self, base_url, user_a, user_b, a_quotes):
        qid = a_quotes["public"]["quote_id"]
        original = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_a["h"]).json()
        r = requests.patch(f"{base_url}/api/quotes/{qid}", headers=user_b["h"],
                            json={"note": "HIJACKED"})
        # response goes through get_quote which is_owner=False (public)
        assert r.status_code == 200
        # Verify field NOT updated (owner reads back)
        g = requests.get(f"{base_url}/api/quotes/{qid}", headers=user_a["h"]).json()
        assert g.get("note", "") == original.get("note", "")
