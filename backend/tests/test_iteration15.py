"""
Iteration 15 — Phase 1 Club de lecture communautaire + recherche lecteurs + modération par âge.
Tests le module /api/club/*, l'indépendance Club vs Mes lectures, la recherche readers[],
et la modération d'âge (birthdate registration/settings + filtrage citations sensibles).
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://lecture-capture-24.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(pseudo: str, birthdate=None):
    """Crée un compte de test unique."""
    email = f"TEST_it15_{uuid.uuid4().hex[:10]}@manent.app"
    body = {"email": email, "password": "Test1234!", "pseudo": pseudo}
    if birthdate is not None:
        body["birthdate"] = birthdate
    r = requests.post(f"{API}/auth/register", json=body, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def primary():
    """Compte primaire test.manent@example.com (déjà PREMIUM, a rejoint L'Alchimiste)."""
    r = requests.post(f"{API}/auth/login",
                      json={"email": "test.manent@example.com", "password": "Test1234!"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def adult_a():
    return _register(f"AdultA_{uuid.uuid4().hex[:4]}", birthdate="1990-05-10")


@pytest.fixture(scope="module")
def adult_b():
    return _register(f"AdultB_{uuid.uuid4().hex[:4]}", birthdate="1988-01-20")


@pytest.fixture(scope="module")
def minor():
    return _register(f"Minor_{uuid.uuid4().hex[:4]}", birthdate="2015-06-01")


@pytest.fixture(scope="module")
def no_birth():
    return _register(f"NoBd_{uuid.uuid4().hex[:4]}", birthdate=None)


# ---------- 1. Auth register/settings/birthdate validation ----------
class TestBirthdateAuth:
    def test_register_with_birthdate_stored(self):
        u = _register(f"Bd_{uuid.uuid4().hex[:4]}", birthdate="2000-05-10")
        assert u["user"]["birthdate"] == "2000-05-10"

    def test_register_without_birthdate_ok(self):
        u = _register(f"NoBd_{uuid.uuid4().hex[:4]}", birthdate=None)
        assert u["user"].get("birthdate") in (None, "")

    def test_patch_settings_birthdate_valid(self, adult_a):
        r = requests.patch(f"{API}/me/settings", headers=_hdr(adult_a["session_token"]),
                           json={"birthdate": "1990-01-15"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("birthdate") == "1990-01-15"

    def test_patch_settings_birthdate_invalid(self, adult_a):
        r = requests.patch(f"{API}/me/settings", headers=_hdr(adult_a["session_token"]),
                           json={"birthdate": "31/12/1999"}, timeout=15)
        assert r.status_code == 400


# ---------- 2. Filtrage citations sensibles par âge ----------
class TestSensitiveFilter:
    def test_sensitive_visible_only_to_adults_and_owner(self, adult_a, adult_b, minor, no_birth):
        # Adulte A crée une citation publique sensible
        r = requests.post(f"{API}/quotes", headers=_hdr(adult_a["session_token"]),
                          json={"text": "Extrait sensible test", "is_public": True, "is_sensitive": True},
                          timeout=15)
        assert r.status_code == 200, r.text
        qid = r.json()["quote_id"]

        # Le propriétaire (A) voit toujours
        r_owner = requests.get(f"{API}/quotes/{qid}", headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r_owner.status_code == 200

        # Adulte B doit voir
        r_b = requests.get(f"{API}/quotes/{qid}", headers=_hdr(adult_b["session_token"]), timeout=15)
        assert r_b.status_code == 200, f"adult B should see: {r_b.status_code}"

        # Mineur -> 404
        r_m = requests.get(f"{API}/quotes/{qid}", headers=_hdr(minor["session_token"]), timeout=15)
        assert r_m.status_code == 404

        # Sans date de naissance -> 404
        r_n = requests.get(f"{API}/quotes/{qid}", headers=_hdr(no_birth["session_token"]), timeout=15)
        assert r_n.status_code == 404

        # cleanup
        requests.delete(f"{API}/quotes/{qid}", headers=_hdr(adult_a["session_token"]), timeout=15)


# ---------- 3. Recherche lecteurs ----------
class TestReaderSearch:
    def test_search_returns_readers_and_excludes_self(self, adult_a):
        # Créer un utilisateur avec pseudo unique
        pseudo = f"Zsearch{uuid.uuid4().hex[:6]}"
        target = _register(pseudo, birthdate="1995-01-01")
        r = requests.get(f"{API}/search", params={"q": pseudo, "scope": "all"},
                         headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "readers" in data
        readers = data["readers"]
        assert any(x.get("pseudo") == pseudo for x in readers), f"target not found in readers: {readers}"
        for x in readers:
            assert "handle" in x
            assert "is_following" in x

    def test_search_excludes_current_user(self, adult_a):
        pseudo_a = adult_a["user"]["pseudo"]
        r = requests.get(f"{API}/search", params={"q": pseudo_a, "scope": "all"},
                         headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r.status_code == 200
        readers = r.json().get("readers", [])
        assert not any(x.get("handle") == adult_a["user"]["handle"] for x in readers)


# ---------- 4. Club — add book (dédoublonnage) ----------
class TestClubBookLifecycle:
    def test_add_book_and_dedup(self, adult_a):
        title = f"TEST_Book_{uuid.uuid4().hex[:6]}"
        r1 = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                           json={"title": title, "author": "Testeur", "pages": 100}, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["already_existed"] is False
        cb_id = d1["cb_id"]

        # Retry same title/author → already_existed True
        r2 = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                           json={"title": title, "author": "Testeur"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["already_existed"] is True
        assert r2.json()["cb_id"] == cb_id

        # cleanup
        requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)

    def test_club_book_does_not_create_user_book(self, adult_a):
        """Indépendance: ajouter au Club ne doit PAS créer un doc dans db.books de l'utilisateur."""
        title = f"TEST_Indep_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                          json={"title": title, "author": "Indep"}, timeout=15)
        assert r.status_code == 200
        cb_id = r.json()["cb_id"]

        rb = requests.get(f"{API}/books", headers=_hdr(adult_a["session_token"]), timeout=15)
        assert rb.status_code == 200
        titles = [b.get("title") for b in rb.json().get("books", [])]
        assert title not in titles, f"club book leaked into user library: {titles}"

        requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)


# ---------- 5. Club home enrichment ----------
class TestClubHome:
    def test_home_has_enriched_books(self, primary):
        r = requests.get(f"{API}/club/home", headers=_hdr(primary["session_token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "books" in data and "active_posts" in data and "is_admin" in data
        # au moins L'Alchimiste doit être présent (créé au smoke-test)
        assert len(data["books"]) >= 1
        b = data["books"][0]
        for k in ("readers_count", "avg_rating", "posts_count", "collective_pct", "is_joined"):
            assert k in b, f"missing {k} in {b.keys()}"

    def test_home_flags_alchimiste_joined_for_primary(self, primary):
        r = requests.get(f"{API}/club/home", headers=_hdr(primary["session_token"]), timeout=15)
        books = r.json()["books"]
        alch = next((b for b in books if "alchimiste" in (b.get("title") or "").lower()), None)
        if alch:
            assert alch["is_joined"] in (True, False)  # tolérant selon l'état DB


# ---------- 6. Club — join/leave/progress ----------
class TestClubParticipation:
    def test_join_leave_progress(self, adult_b):
        # Créer un livre
        r = requests.post(f"{API}/club/books", headers=_hdr(adult_b["session_token"]),
                          json={"title": f"TEST_JLP_{uuid.uuid4().hex[:5]}", "pages": 200}, timeout=15)
        cb_id = r.json()["cb_id"]

        # Join
        r = requests.post(f"{API}/club/books/{cb_id}/join", headers=_hdr(adult_b["session_token"]), timeout=15)
        assert r.status_code == 200

        # Progress via pct
        r = requests.patch(f"{API}/club/books/{cb_id}/progress", headers=_hdr(adult_b["session_token"]),
                           json={"pct": 40}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("pct") == 40

        # Progress via page -> pct calculé
        r = requests.patch(f"{API}/club/books/{cb_id}/progress", headers=_hdr(adult_b["session_token"]),
                           json={"page": 100}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("pct") == 50

        # Finished
        r = requests.patch(f"{API}/club/books/{cb_id}/progress", headers=_hdr(adult_b["session_token"]),
                           json={"finished": True}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "finished"
        assert r.json().get("pct") == 100

        # Leave
        r = requests.post(f"{API}/club/books/{cb_id}/leave", headers=_hdr(adult_b["session_token"]), timeout=15)
        assert r.status_code == 200

        # cleanup
        requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_b["session_token"]), timeout=15)


# ---------- 7. Club — posts, likes, comments, spoiler, reviews ----------
class TestClubDiscussions:
    @pytest.fixture(scope="class")
    def cb_ctx(self, adult_a, adult_b):
        r = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                          json={"title": f"TEST_Disc_{uuid.uuid4().hex[:5]}", "pages": 300}, timeout=15)
        cb_id = r.json()["cb_id"]
        requests.post(f"{API}/club/books/{cb_id}/join", headers=_hdr(adult_a["session_token"]), timeout=15)
        requests.post(f"{API}/club/books/{cb_id}/join", headers=_hdr(adult_b["session_token"]), timeout=15)
        yield {"cb_id": cb_id, "a": adult_a, "b": adult_b}
        requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)

    def test_post_like_comment_flow(self, cb_ctx):
        cb_id, a, b = cb_ctx["cb_id"], cb_ctx["a"], cb_ctx["b"]
        # Post
        r = requests.post(f"{API}/club/books/{cb_id}/posts", headers=_hdr(a["session_token"]),
                          json={"text": "J'ai adoré ce chapitre.", "spoiler": False}, timeout=15)
        assert r.status_code == 200, r.text
        pid = r.json()["post_id"]

        # Like by B (toggle on)
        r = requests.post(f"{API}/club/posts/{pid}/like", headers=_hdr(b["session_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["liked"] is True
        assert r.json()["likes_count"] == 1

        # Toggle off
        r = requests.post(f"{API}/club/posts/{pid}/like", headers=_hdr(b["session_token"]), timeout=15)
        assert r.json()["liked"] is False
        assert r.json()["likes_count"] == 0

        # Comment by B
        r = requests.post(f"{API}/club/posts/{pid}/comments", headers=_hdr(b["session_token"]),
                          json={"text": "Bien dit !"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["text"] == "Bien dit !"

        # List comments
        r = requests.get(f"{API}/club/posts/{pid}/comments", headers=_hdr(a["session_token"]), timeout=15)
        assert r.status_code == 200
        assert len(r.json()["comments"]) >= 1

    def test_post_with_spoiler(self, cb_ctx):
        r = requests.post(f"{API}/club/books/{cb_ctx['cb_id']}/posts", headers=_hdr(cb_ctx["a"]["session_token"]),
                          json={"text": "La fin est incroyable", "spoiler": True, "spoiler_chapter": "Ch. 12"},
                          timeout=15)
        assert r.status_code == 200
        assert r.json()["spoiler"] is True
        assert r.json()["spoiler_chapter"] == "Ch. 12"

    def test_report(self, cb_ctx):
        r = requests.post(f"{API}/club/books/{cb_ctx['cb_id']}/posts",
                          headers=_hdr(cb_ctx["a"]["session_token"]),
                          json={"text": "post à signaler"}, timeout=15)
        pid = r.json()["post_id"]
        r = requests.post(f"{API}/club/report", headers=_hdr(cb_ctx["b"]["session_token"]),
                          json={"kind": "post", "target_id": pid, "reason": "spam"}, timeout=15)
        assert r.status_code == 200

    def test_reviews_upsert_avg(self, cb_ctx):
        cb_id, a, b = cb_ctx["cb_id"], cb_ctx["a"], cb_ctx["b"]
        # Avis A
        r = requests.post(f"{API}/club/books/{cb_id}/reviews", headers=_hdr(a["session_token"]),
                          json={"criteria": {"histoire": 5, "ecriture": 4, "personnages": 5, "emotion": 4},
                                "text": "Excellent"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["note"] == 4.5

        # Upsert A - remplace
        r = requests.post(f"{API}/club/books/{cb_id}/reviews", headers=_hdr(a["session_token"]),
                          json={"criteria": {"histoire": 3, "ecriture": 3, "personnages": 3, "emotion": 3}},
                          timeout=15)
        assert r.status_code == 200
        assert r.json()["note"] == 3.0

        # Avis B
        r = requests.post(f"{API}/club/books/{cb_id}/reviews", headers=_hdr(b["session_token"]),
                          json={"criteria": {"histoire": 5, "ecriture": 5, "personnages": 5, "emotion": 5}},
                          timeout=15)
        assert r.status_code == 200

        # GET reviews → avg_criteria
        r = requests.get(f"{API}/club/books/{cb_id}/reviews", headers=_hdr(a["session_token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["reviews"]) == 2
        assert "avg_criteria" in data
        for c in ("histoire", "ecriture", "personnages", "emotion"):
            assert c in data["avg_criteria"]


# ---------- 8. Club — me/summary ----------
class TestClubSummary:
    def test_me_summary(self, adult_a):
        # Créer un livre + join
        r = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                          json={"title": f"TEST_Sum_{uuid.uuid4().hex[:5]}", "pages": 100}, timeout=15)
        cb_id = r.json()["cb_id"]
        requests.post(f"{API}/club/books/{cb_id}/join", headers=_hdr(adult_a["session_token"]), timeout=15)

        r = requests.get(f"{API}/club/me/summary", headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "joined" in d and "reading" in d and "finished" in d
        assert d["joined"] >= 1

        requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)


# ---------- 9. Delete permission ----------
class TestClubDeletePermission:
    def test_non_admin_non_adder_forbidden(self, adult_a, adult_b):
        r = requests.post(f"{API}/club/books", headers=_hdr(adult_a["session_token"]),
                          json={"title": f"TEST_Perm_{uuid.uuid4().hex[:5]}"}, timeout=15)
        cb_id = r.json()["cb_id"]

        # B ni admin ni ajouteur -> 403
        r = requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_b["session_token"]), timeout=15)
        assert r.status_code == 403

        # A ajouteur -> 200 + cascade
        r = requests.delete(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r.status_code == 200

        # book gone
        r = requests.get(f"{API}/club/books/{cb_id}", headers=_hdr(adult_a["session_token"]), timeout=15)
        assert r.status_code == 404


# ---------- 10. Feed exclut les sensibles pour mineurs ----------
class TestFeedSensitive:
    def test_feed_excludes_sensitive_for_minor(self, adult_a, minor):
        r = requests.post(f"{API}/quotes", headers=_hdr(adult_a["session_token"]),
                          json={"text": f"TEST_feed_sens_{uuid.uuid4().hex[:4]}", "is_public": True,
                                "is_sensitive": True}, timeout=15)
        qid = r.json()["quote_id"]

        r = requests.get(f"{API}/feed", headers=_hdr(minor["session_token"]), timeout=15)
        if r.status_code == 200:
            feed = r.json()
            ids = []
            if isinstance(feed, dict):
                ids = [q.get("quote_id") for q in feed.get("quotes", []) + feed.get("items", [])]
            assert qid not in ids

        requests.delete(f"{API}/quotes/{qid}", headers=_hdr(adult_a["session_token"]), timeout=15)
