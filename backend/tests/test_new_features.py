"""Manent Phase 2 tests: /api/search, book.sheet PATCH, vision page_number for non-book images."""
import base64, io, uuid, pytest, requests
from PIL import Image, ImageDraw


# ---------- Helpers ----------
def blank_png(color=(200, 220, 240)) -> bytes:
    """Non-book image (solid color) — Vision must return 0 for page_number."""
    img = Image.new("RGB", (400, 300), color=color)
    d = ImageDraw.Draw(img)
    # add some shapes but no page number
    d.ellipse([50, 50, 350, 250], fill=(120, 160, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------- Session-scoped fresh user ----------
@pytest.fixture(scope="module")
def new_user(base_url):
    email = f"nf_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Test1234!", "pseudo": f"NF{uuid.uuid4().hex[:4]}"
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email}


@pytest.fixture(scope="module")
def h(new_user):
    return {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}


# ---------- Fixtures: create books + quotes for search ----------
@pytest.fixture(scope="module")
def books_and_quotes(base_url, h):
    # Book 1: Papier — L'Alchimiste — with recap mentioning "univers"
    b1 = requests.post(f"{base_url}/api/books", headers=h, json={
        "type": "papier", "title": "TEST_L'Alchimiste", "author": "Paulo Coelho", "pages": 208, "status": "en_cours",
    }).json()
    # Update recap
    requests.patch(f"{base_url}/api/books/{b1['book_id']}", headers=h, json={"recap": "Un berger cherche son trésor personnel."})

    # Book 2: Etude — Candide — with sheet
    b2 = requests.post(f"{base_url}/api/books", headers=h, json={
        "type": "etude", "title": "TEST_Candide", "author": "Voltaire", "pages": 200, "status": "en_cours",
    }).json()

    # Quotes on book 1
    q1 = requests.post(f"{base_url}/api/quotes", headers=h, json={
        "text": "Quand tu veux quelque chose, tout l'univers conspire.",
        "book_id": b1["book_id"], "page": 42, "themes": ["résilience"], "is_public": False,
    }).json()
    q2 = requests.post(f"{base_url}/api/quotes", headers=h, json={
        "text": "Écoute ton cœur, il sait tout.",
        "book_id": b1["book_id"], "page": 90, "themes": ["amour"], "is_public": False,
    }).json()
    # Quote on book 2 with note referencing "candide"
    q3 = requests.post(f"{base_url}/api/quotes", headers=h, json={
        "text": "Il faut cultiver notre jardin.",
        "book_id": b2["book_id"], "page": 180, "themes": ["résilience"], "note": "Fin du roman", "is_public": False,
    }).json()

    yield {"b1": b1, "b2": b2, "q1": q1, "q2": q2, "q3": q3}

    # cleanup
    for q in (q1, q2, q3):
        requests.delete(f"{base_url}/api/quotes/{q['quote_id']}", headers=h)
    for b in (b1, b2):
        requests.delete(f"{base_url}/api/books/{b['book_id']}", headers=h)


# ---------- /api/search ----------
class TestSearch:
    def test_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/search", params={"q": "any"})
        assert r.status_code == 401, r.text

    def test_search_empty_q_returns_all_user_content(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"scope": "all"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "quotes" in d and "books" in d
        assert len(d["books"]) >= 2
        assert len(d["quotes"]) >= 3

    def test_search_by_text_on_quote(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "univers"})
        assert r.status_code == 200, r.text
        d = r.json()
        texts = [x["text"] for x in d["quotes"]]
        assert any("univers" in t.lower() for t in texts)

    def test_search_by_text_on_book_title(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "Candide"})
        assert r.status_code == 200, r.text
        d = r.json()
        titles = [b["title"] for b in d["books"]]
        assert any("Candide" in t for t in titles)

    def test_search_by_author(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "Voltaire"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert any("Candide" in b["title"] for b in d["books"])

    def test_search_by_recap(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "berger"})
        assert r.status_code == 200
        d = r.json()
        assert any("L'Alchimiste" in b["title"] for b in d["books"])

    def test_search_note_match_on_quote(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "Fin du roman"})
        assert r.status_code == 200
        d = r.json()
        # note field matched on quotes
        assert any("cultiver" in q["text"] for q in d["quotes"])

    def test_search_case_insensitive(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "UNIVERS"})
        assert r.status_code == 200
        d = r.json()
        assert len(d["quotes"]) >= 1

    def test_search_scope_quotes_only(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"scope": "quotes"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["books"] == []
        assert len(d["quotes"]) >= 3

    def test_search_scope_books_only(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"scope": "books"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quotes"] == []
        assert len(d["books"]) >= 2

    def test_search_theme_filter(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"theme": "amour"})
        assert r.status_code == 200
        d = r.json()
        # theme filter hides books per spec
        assert d["books"] == []
        for q in d["quotes"]:
            assert "amour" in q["themes"]

    def test_search_book_id_filter(self, base_url, h, books_and_quotes):
        bid = books_and_quotes["b1"]["book_id"]
        r = requests.get(f"{base_url}/api/search", headers=h, params={"book_id": bid})
        assert r.status_code == 200
        d = r.json()
        assert d["books"] == []
        for q in d["quotes"]:
            assert q["book_id"] == bid

    def test_search_no_results(self, base_url, h, books_and_quotes):
        r = requests.get(f"{base_url}/api/search", headers=h, params={"q": "zzz_no_match_xyz_9999"})
        assert r.status_code == 200
        d = r.json()
        assert d["quotes"] == []
        assert d["books"] == []

    def test_search_user_scoped(self, base_url, h, books_and_quotes):
        """Register a second user, expect empty results (search is user-scoped)."""
        email = f"other_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "Test1234!", "pseudo": f"O{uuid.uuid4().hex[:4]}"
        })
        assert r.status_code == 200
        other_h = {"Authorization": f"Bearer {r.json()['session_token']}", "Content-Type": "application/json"}
        rr = requests.get(f"{base_url}/api/search", headers=other_h, params={"q": "Candide"})
        assert rr.status_code == 200
        d = rr.json()
        assert d["quotes"] == []
        assert d["books"] == []


# ---------- Book.sheet PATCH ----------
class TestBookSheet:
    def test_create_book_initializes_empty_sheet(self, base_url, h):
        r = requests.post(f"{base_url}/api/books", headers=h, json={
            "type": "etude", "title": "TEST_SHEET_INIT", "author": "X", "pages": 100,
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert "sheet" in b
        assert b["sheet"] == {}
        requests.delete(f"{base_url}/api/books/{b['book_id']}", headers=h)

    def test_patch_sheet_full_persists(self, base_url, h):
        # Create etude book
        r = requests.post(f"{base_url}/api/books", headers=h, json={
            "type": "etude", "title": "TEST_SHEET_FULL", "author": "Voltaire", "pages": 200,
        })
        bid = r.json()["book_id"]
        try:
            sheet = {
                "author_bio": "Philosophe des Lumières, 1694-1778.",
                "characters": [
                    {"name": "Candide", "description": "Jeune naïf"},
                    {"name": "Pangloss", "description": "Philosophe optimiste"},
                ],
                "summary": "Un jeune homme découvre le monde et ses maux.",
                "themes": ["optimisme", "destin", "voyage"],
            }
            pr = requests.patch(f"{base_url}/api/books/{bid}", headers=h, json={"sheet": sheet})
            assert pr.status_code == 200, pr.text
            got = pr.json()
            assert got["sheet"]["author_bio"] == sheet["author_bio"]
            assert got["sheet"]["summary"] == sheet["summary"]
            assert got["sheet"]["themes"] == sheet["themes"]
            assert len(got["sheet"]["characters"]) == 2
            assert got["sheet"]["characters"][0]["name"] == "Candide"

            # Verify persistence via GET
            g = requests.get(f"{base_url}/api/books/{bid}", headers=h)
            assert g.status_code == 200
            assert g.json()["sheet"]["author_bio"] == sheet["author_bio"]
        finally:
            requests.delete(f"{base_url}/api/books/{bid}", headers=h)

    def test_patch_sheet_partial_replaces(self, base_url, h):
        r = requests.post(f"{base_url}/api/books", headers=h, json={
            "type": "etude", "title": "TEST_SHEET_PART", "author": "A", "pages": 100,
        })
        bid = r.json()["book_id"]
        try:
            # First: set full sheet
            requests.patch(f"{base_url}/api/books/{bid}", headers=h, json={
                "sheet": {"author_bio": "bio v1", "summary": "sum v1", "characters": [], "themes": []}
            })
            # Then: replace with sheet with just summary
            pr = requests.patch(f"{base_url}/api/books/{bid}", headers=h, json={
                "sheet": {"summary": "sum v2"}
            })
            assert pr.status_code == 200
            assert pr.json()["sheet"] == {"summary": "sum v2"}
        finally:
            requests.delete(f"{base_url}/api/books/{bid}", headers=h)


# ---------- Vision page_number on non-book image ----------
class TestVisionPageNumber:
    def test_vision_page_number_no_book(self, base_url, h):
        png = blank_png()
        b64 = base64.b64encode(png).decode()
        r = requests.post(f"{base_url}/api/vision", headers=h, json={
            "image_base64": b64, "mode": "page_number"
        }, timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert "page_number" in d
        assert isinstance(d["page_number"], int)
        # Non-book image should return 0 (per spec) — but Claude may occasionally hallucinate;
        # accept anything <= 10 or 0 as a safe upper bound
        assert d["page_number"] == 0, f"Expected 0 for non-book image, got {d['page_number']}"
