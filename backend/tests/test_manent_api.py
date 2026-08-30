"""Manent backend regression tests."""
import base64, io, os, uuid, requests, pytest
from PIL import Image, ImageDraw


# ---------- Helpers ----------
def make_jpeg_with_text(text: str, page_number: int | None = None) -> bytes:
    """Create a small feature-rich JPEG with visible French text."""
    img = Image.new("RGB", (600, 400), color=(245, 240, 225))
    d = ImageDraw.Draw(img)
    # decorative frame
    d.rectangle([10, 10, 590, 390], outline=(60, 40, 20), width=3)
    # text lines
    d.text((40, 60), text, fill=(20, 20, 20))
    d.text((40, 120), "Chapitre 3 — L'aube", fill=(30, 30, 30))
    d.text((40, 160), "Elle regarda l'horizon,", fill=(30, 30, 30))
    d.text((40, 190), "puis referma le livre.", fill=(30, 30, 30))
    if page_number is not None:
        d.text((520, 350), str(page_number), fill=(0, 0, 0))
    # add some noise-like pattern
    for i in range(0, 600, 20):
        d.line([(i, 300), (i + 10, 320)], fill=(150, 130, 110))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_token(self, api, base_url):
        email = f"reg_{uuid.uuid4().hex[:10]}@example.com"
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "Test1234!", "pseudo": "Léa"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_token" in d and d["session_token"].startswith("mnt_")
        assert d["user"]["email"] == email
        assert d["user"]["pseudo"] == "Léa"
        assert d["user"]["handle"] == "léa"

    def test_login_success(self, api, auth, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": auth["email"], "password": auth["password"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_token"].startswith("mnt_")
        assert d["user"]["email"] == auth["email"]

    def test_login_wrong_password(self, api, auth, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": auth["email"], "password": "wrong-pw"
        })
        assert r.status_code == 401

    def test_me_with_token(self, api, auth_headers, base_url, auth):
        r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == auth["email"]

    def test_me_without_token(self, api, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------- Themes ----------
class TestThemes:
    def test_themes_list(self, api, base_url):
        r = api.get(f"{base_url}/api/themes")
        assert r.status_code == 200
        themes = r.json()["themes"]
        assert isinstance(themes, list) and len(themes) == 12
        for t in ["résilience", "amour", "argent"]:
            assert t in themes


# ---------- Users ----------
class TestUsers:
    def test_patch_me(self, base_url, auth_headers):
        r = requests.patch(f"{base_url}/api/users/me", headers=auth_headers, json={
            "reading_mode": "both",
            "themes": ["résilience", "amour", "argent"]
        })
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["reading_mode"] == "both"
        assert u["themes"] == ["résilience", "amour", "argent"]

        # verify persistence via /auth/me
        r2 = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
        u2 = r2.json()["user"]
        assert u2["reading_mode"] == "both"
        assert u2["themes"] == ["résilience", "amour", "argent"]


# ---------- Google Books ----------
class TestBooksSearch:
    def test_search_query(self, api, base_url):
        r = api.get(f"{base_url}/api/books/search", params={"q": "Coelho"})
        assert r.status_code == 200, r.text
        results = r.json()["results"]
        assert isinstance(results, list) and len(results) > 0
        first = results[0]
        for k in ("title", "author", "pages", "cover"):
            assert k in first

    def test_search_isbn_found(self, api, base_url):
        r = api.get(f"{base_url}/api/books/search/isbn", params={"isbn": "9782290004449"})
        # accept 200 (found) or 404 (not found gracefully)
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            d = r.json()
            assert "title" in d and "author" in d and d["isbn"] == "9782290004449"

    def test_search_isbn_not_found(self, api, base_url):
        r = api.get(f"{base_url}/api/books/search/isbn", params={"isbn": "0000000000000"})
        assert r.status_code == 404


# ---------- Books CRUD ----------
@pytest.fixture(scope="module")
def created_book(base_url, auth_headers):
    r = requests.post(f"{base_url}/api/books", headers=auth_headers, json={
        "type": "papier",
        "title": "TEST_L'Alchimiste",
        "author": "Paulo Coelho",
        "pages": 208,
        "status": "en_cours",
    })
    assert r.status_code == 200, r.text
    b = r.json()
    yield b
    requests.delete(f"{base_url}/api/books/{b['book_id']}", headers=auth_headers)


class TestBooks:
    def test_create_book(self, created_book):
        assert created_book["title"] == "TEST_L'Alchimiste"
        assert created_book["status"] == "en_cours"
        assert created_book["pages"] == 208
        assert created_book["progress_page"] == 0

    def test_list_books_has_quotes_count(self, base_url, auth_headers, created_book):
        r = requests.get(f"{base_url}/api/books", headers=auth_headers)
        assert r.status_code == 200
        books = r.json()["books"]
        assert any(b["book_id"] == created_book["book_id"] for b in books)
        for b in books:
            assert "quotes_count" in b and isinstance(b["quotes_count"], int)


# ---------- Quotes ----------
@pytest.fixture(scope="module")
def created_quote(base_url, auth_headers, created_book):
    r = requests.post(f"{base_url}/api/quotes", headers=auth_headers, json={
        "text": "TEST — Quand tu veux quelque chose, tout l'univers conspire.",
        "book_id": created_book["book_id"],
        "page": 42,
        "themes": ["résilience"],
        "is_public": False,
    })
    assert r.status_code == 200, r.text
    q = r.json()
    yield q


class TestQuotes:
    def test_quote_updates_book_progress(self, base_url, auth_headers, created_book, created_quote):
        r = requests.get(f"{base_url}/api/books/{created_book['book_id']}", headers=auth_headers)
        assert r.status_code == 200
        b = r.json()
        assert b["progress_page"] == 42
        assert b["quotes_count"] >= 1

    def test_list_quotes_with_book(self, base_url, auth_headers, created_quote):
        r = requests.get(f"{base_url}/api/quotes", headers=auth_headers)
        assert r.status_code == 200
        quotes = r.json()["quotes"]
        found = next((q for q in quotes if q["quote_id"] == created_quote["quote_id"]), None)
        assert found is not None
        assert found["book"] is not None
        assert "title" in found["book"]

    def test_get_quote_detail(self, base_url, auth_headers, created_quote):
        r = requests.get(f"{base_url}/api/quotes/{created_quote['quote_id']}", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["author"]["handle"]
        assert d["book"]["title"] == "TEST_L'Alchimiste"

    def test_delete_quote(self, base_url, auth_headers):
        # create a quote and delete it
        r = requests.post(f"{base_url}/api/quotes", headers=auth_headers, json={
            "text": "TEST_ to_delete", "themes": [], "is_public": False,
        })
        qid = r.json()["quote_id"]
        r2 = requests.delete(f"{base_url}/api/quotes/{qid}", headers=auth_headers)
        assert r2.status_code == 200
        r3 = requests.get(f"{base_url}/api/quotes/{qid}", headers=auth_headers)
        assert r3.status_code == 404


# ---------- Feed ----------
class TestFeed:
    def test_seed_and_feed(self, base_url, auth_headers):
        s = requests.post(f"{base_url}/api/dev/seed", headers=auth_headers)
        assert s.status_code == 200, s.text
        r = requests.get(f"{base_url}/api/feed", headers=auth_headers)
        assert r.status_code == 200
        quotes = r.json()["quotes"]
        assert len(quotes) > 0
        first = quotes[0]
        assert "author" in first and first["author"]
        # book might be None for some feeds but usually present
        assert "is_public" in first and first["is_public"] is True

    def test_feed_by_theme(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/feed", headers=auth_headers, params={"theme": "résilience"})
        assert r.status_code == 200
        quotes = r.json()["quotes"]
        assert len(quotes) > 0
        for q in quotes:
            assert "résilience" in q["themes"]


# ---------- Boards ----------
class TestBoards:
    def test_board_flow(self, base_url, auth_headers, created_quote):
        r = requests.post(f"{base_url}/api/boards", headers=auth_headers, json={
            "name": "TEST_MyBoard", "visibility": "private"
        })
        assert r.status_code == 200, r.text
        board = r.json()
        assert board["visibility"] == "private"
        bid = board["board_id"]

        # pin
        pr = requests.post(f"{base_url}/api/boards/{bid}/pin", headers=auth_headers, json={
            "quote_id": created_quote["quote_id"]
        })
        assert pr.status_code == 200, pr.text

        # get board with quotes
        gr = requests.get(f"{base_url}/api/boards/{bid}", headers=auth_headers)
        assert gr.status_code == 200
        b = gr.json()
        assert len(b["quotes"]) >= 1
        assert b["quotes"][0]["quote_id"] == created_quote["quote_id"]

        # cleanup
        requests.delete(f"{base_url}/api/boards/{bid}", headers=auth_headers)


# ---------- Vision (Claude Sonnet 4.6) ----------
class TestVision:
    def test_vision_transcribe(self, base_url, auth_headers):
        jpeg = make_jpeg_with_text("La lumiere revenait doucement sur la ville endormie.")
        b64 = base64.b64encode(jpeg).decode()
        r = requests.post(f"{base_url}/api/vision", headers=auth_headers, json={
            "image_base64": b64, "mode": "transcribe"
        }, timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert "text" in d and isinstance(d["text"], str)

    def test_vision_page_number(self, base_url, auth_headers):
        jpeg = make_jpeg_with_text("Extrait de test.", page_number=142)
        b64 = base64.b64encode(jpeg).decode()
        r = requests.post(f"{base_url}/api/vision", headers=auth_headers, json={
            "image_base64": f"data:image/jpeg;base64,{b64}", "mode": "page_number"
        }, timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        d = r.json()
        assert "page_number" in d and isinstance(d["page_number"], int)


# ---------- Upload ----------
class TestUpload:
    def test_upload_returns_url(self, base_url, auth):
        jpeg = make_jpeg_with_text("upload test")
        files = {"file": ("test.jpg", jpeg, "image/jpeg")}
        headers = {"Authorization": f"Bearer {auth['token']}"}
        r = requests.post(f"{base_url}/api/upload", headers=headers, files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and isinstance(d["url"], str)
        assert d["url"].startswith(("http", "data:"))
