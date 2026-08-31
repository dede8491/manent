"""Iteration 13 tests — Fiche de lecture, Carnet, Recherche catalogue online."""
import os, uuid, pytest, requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or ""
if not BASE:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE = line.split("=", 1)[1].strip().strip('"'); break
BASE = BASE.rstrip("/")


@pytest.fixture(scope="module")
def user():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_it13_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"It13{uuid.uuid4().hex[:4]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    s.headers["Authorization"] = f"Bearer {d['session_token']}"
    return {"s": s, "user": d["user"], "email": email}


@pytest.fixture(scope="module")
def book(user):
    s = user["s"]
    r = s.post(f"{BASE}/api/books", json={"title": "TEST_it13 Candide", "author": "Voltaire", "year": "1759", "pages": 150, "type": "papier"})
    assert r.status_code == 200, r.text
    b = r.json()
    return b


# ============ Fiche section ============
class TestFiche:
    def test_get_fiche_prefills_passages_from_quotes(self, user, book):
        s = user["s"]; bid = book["book_id"]
        # Create 2 quotes on the book
        for txt in ["Il faut cultiver notre jardin.", "Tout est pour le mieux dans le meilleur des mondes."]:
            rq = s.post(f"{BASE}/api/quotes", json={"book_id": bid, "text": txt, "themes": []})
            assert rq.status_code == 200, rq.text
        r = s.get(f"{BASE}/api/books/{bid}/fiche")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["book"]["book_id"] == bid
        assert d["book"]["title"] == "TEST_it13 Candide"
        assert d["rating"] == 0
        # passages must be pre-filled from quotes since fiche is empty
        passages = d["fiche"]["passages"]
        assert isinstance(passages, list) and len(passages) == 2
        texts = [p["text"] for p in passages]
        assert "Il faut cultiver notre jardin." in texts

    def test_put_fiche_persists_and_reflects_rating_on_book(self, user, book):
        s = user["s"]; bid = book["book_id"]
        payload = {
            "summary": "Un conte philosophique.",
            "ideas": ["Optimisme critiqué", "Cultiver son jardin"],
            "rating": 4,
        }
        r = s.put(f"{BASE}/api/books/{bid}/fiche", json=payload)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # GET fiche should reflect the values
        g = s.get(f"{BASE}/api/books/{bid}/fiche")
        assert g.status_code == 200
        d = g.json()
        assert d["fiche"]["summary"] == "Un conte philosophique."
        assert d["fiche"]["ideas"] == ["Optimisme critiqué", "Cultiver son jardin"]
        assert d["rating"] == 4
        # rating also on GET /books/{id}
        gb = s.get(f"{BASE}/api/books/{bid}")
        assert gb.status_code == 200
        assert gb.json().get("rating") == 4

    def test_put_fiche_updates_passages_and_does_not_refill(self, user, book):
        s = user["s"]; bid = book["book_id"]
        r = s.put(f"{BASE}/api/books/{bid}/fiche", json={"passages": [{"text": "custom", "note": "mine"}]})
        assert r.status_code == 200
        g = s.get(f"{BASE}/api/books/{bid}/fiche").json()
        assert g["fiche"]["passages"] == [{"text": "custom", "note": "mine"}]

    def test_get_fiche_404_when_unknown(self, user):
        s = user["s"]
        r = s.get(f"{BASE}/api/books/not_a_real_id/fiche")
        assert r.status_code == 404
        assert r.json().get("detail") == "not_found"

    def test_put_fiche_404_when_unknown(self, user):
        s = user["s"]
        r = s.put(f"{BASE}/api/books/not_a_real_id/fiche", json={"summary": "x"})
        assert r.status_code == 404

    def test_fiche_isolation_between_users(self, book):
        # a different user must get 404 for another user's book
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        email = f"TEST_it13_other_{uuid.uuid4().hex[:8]}@example.com"
        r = s2.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test1234!", "pseudo": f"O{uuid.uuid4().hex[:4]}"})
        assert r.status_code == 200
        s2.headers["Authorization"] = f"Bearer {r.json()['session_token']}"
        rg = s2.get(f"{BASE}/api/books/{book['book_id']}/fiche")
        assert rg.status_code == 404
        rp = s2.put(f"{BASE}/api/books/{book['book_id']}/fiche", json={"summary": "hack"})
        assert rp.status_code == 404


# ============ List /fiches ============
class TestFichesList:
    def test_list_sorted_desc_by_updated_at(self, user, book):
        s = user["s"]
        # Create a second book with fiche
        r = s.post(f"{BASE}/api/books", json={"title": "TEST_it13 Zadig", "author": "Voltaire", "type": "papier"})
        assert r.status_code == 200
        bid2 = r.json()["book_id"]
        s.put(f"{BASE}/api/books/{bid2}/fiche", json={"summary": "Un autre conte.", "rating": 3})
        # touch first book fiche again to make it most recent
        s.put(f"{BASE}/api/books/{book['book_id']}/fiche", json={"review": "excellent"})
        r = s.get(f"{BASE}/api/fiches")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "fiches" in d
        titles = [f["title"] for f in d["fiches"] if f["title"].startswith("TEST_it13")]
        assert titles[0] == "TEST_it13 Candide", f"expected Candide first, got {titles}"
        # Contains required keys
        f0 = d["fiches"][0]
        for k in ("book_id", "title", "author", "rating", "updated_at"):
            assert k in f0


# ============ Search /books/search (catalog) ============
class TestCatalogSearch:
    def test_books_search_returns_results(self):
        # public endpoint (no auth required by design)
        r = requests.get(f"{BASE}/api/books/search?q=jacaranda")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "results" in d and isinstance(d["results"], list)
        # Jacaranda by Gaël Faye is a well-known book — external providers should return >=1 hit
        # but if all 3 providers fail we don't want a hard failure, so just check shape
        for it in d["results"][:3]:
            assert "title" in it


# ============ Local search regression ============
class TestLocalSearchRegression:
    def test_local_search_candide(self, user, book):
        s = user["s"]
        r = s.get(f"{BASE}/api/search?q=candide")
        assert r.status_code == 200
        d = r.json()
        book_ids = [b["book_id"] for b in d.get("books", [])]
        assert book["book_id"] in book_ids
