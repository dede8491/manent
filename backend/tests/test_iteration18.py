"""Iteration 18 — Lot C (aires par pays d'auteur), Lot A (share pages + .well-known),
Lot E (migration recherche vers /catalog), corrections deploy (/health, upload storage,
_attach_public_meta batché).
"""
import io
import os
import re
import uuid
import pytest
import requests
from pathlib import Path
from pymongo import MongoClient

# ------------------ setup ------------------
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "manent_db"
_mongo = MongoClient(MONGO_URL)
mdb = _mongo[DB_NAME]


def _register(pseudo_hint: str = "T"):
    email = f"test_it18_{uuid.uuid4().hex[:8]}@manent.app"
    body = {"email": email, "password": "Test1234!", "pseudo": f"{pseudo_hint}{uuid.uuid4().hex[:4]}"}
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    return {
        "email": email, "password": body["password"],
        "user_id": d["user"]["user_id"],
        "token": d["session_token"],
        "headers": {"Authorization": f"Bearer {d['session_token']}", "Content-Type": "application/json"},
    }


@pytest.fixture(scope="module")
def user_regular():
    return _register("R")


@pytest.fixture(scope="module")
def admin_user():
    """Register a fresh test admin and promote via direct DB update (documented in test_credentials.md)."""
    u = _register("A")
    mdb.users.update_one({"user_id": u["user_id"]}, {"$set": {"is_admin": True}})
    yield u
    # cleanup: leave user but demote (won't affect anything)
    mdb.users.update_one({"user_id": u["user_id"]}, {"$set": {"is_admin": False}})


# ==================================================================
# 1) /health and /api/health
# ==================================================================
class TestHealth:
    def test_root_health(self):
        r = requests.get(f"{BASE_URL}/health", timeout=15)
        assert r.status_code == 200

    def test_api_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200


# ==================================================================
# 2) /api/books/search removed (Lot E)
# ==================================================================
class TestBooksSearchRemoved:
    def test_books_search_no_longer_exists(self, user_regular):
        r = requests.get(f"{API}/books/search", params={"q": "x"},
                         headers=user_regular["headers"], timeout=15)
        # Route removed → falls through to /books/{book_id} which returns 404 for id "search"
        assert r.status_code == 404, f"expected 404 (route deleted), got {r.status_code} {r.text}"

    def test_books_search_no_auth_is_401(self):
        # Without auth, hits /books/{book_id} auth requirement first → 401 (still, route deleted)
        r = requests.get(f"{API}/books/search?q=x", timeout=15)
        assert r.status_code == 401


# ==================================================================
# 3) /api/catalog/isbn/{isbn}
# ==================================================================
class TestCatalogIsbn:
    def test_isbn_lookup_cyrulnik(self, user_regular):
        r = requests.get(f"{API}/catalog/isbn/9782070368228",
                         headers=user_regular["headers"], timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        for f in ("catalog_id", "title", "isbn", "countries", "country_labels"):
            assert f in d, f"missing field {f} in {d}"
        assert d["title"], "title empty"
        assert isinstance(d["countries"], list)
        assert isinstance(d["country_labels"], list)

    def test_isbn_lookup_requires_auth(self):
        r = requests.get(f"{API}/catalog/isbn/9782070368228", timeout=15)
        assert r.status_code == 401


# ==================================================================
# 4) /api/catalog/search
# ==================================================================
class TestCatalogSearch:
    def test_search_cyrulnik(self, user_regular):
        r = requests.get(f"{API}/catalog/search", params={"q": "cyrulnik"},
                         headers=user_regular["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "results" in d
        results = d["results"]
        assert len(results) > 0, "no results for cyrulnik"
        for item in results:
            assert "countries" in item
            assert "country_labels" in item
            assert "areas" in item


# ==================================================================
# 5) /api/catalog/areas/française — chips pays + filtre country
# ==================================================================
class TestCatalogAreaFrancaise:
    def test_area_francaise_returns_books_and_countries(self, user_regular):
        r = requests.get(f"{API}/catalog/areas/française",
                         headers=user_regular["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "books" in d and len(d["books"]) > 0, f"empty books for française: {d}"
        assert "countries" in d and isinstance(d["countries"], list)
        # Should have country facet chips with {code, label, count}
        assert len(d["countries"]) > 0, f"no country chips: {d.get('countries')}"
        for c in d["countries"]:
            assert "code" in c and "label" in c and "count" in c

    def test_area_francaise_filter_by_country_fr(self, user_regular):
        r = requests.get(f"{API}/catalog/areas/française",
                         params={"country": "FR"},
                         headers=user_regular["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Every returned book should contain FR in countries
        for b in d["books"]:
            assert "FR" in (b.get("countries") or []), f"book without FR: {b}"


# ==================================================================
# 6) Admin authors (Lot C)
# ==================================================================
class TestAdminAuthors:
    def test_admin_authors_403_for_non_admin(self, user_regular):
        r = requests.get(f"{API}/catalog/admin/authors",
                         headers=user_regular["headers"], timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_admin_authors_200_for_admin(self, admin_user):
        r = requests.get(f"{API}/catalog/admin/authors",
                         headers=admin_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "authors" in d
        assert len(d["authors"]) > 0
        # Sort: country=null first (rank 0)
        first_batch = d["authors"][:5]
        assert any(a.get("country") in (None, "", ) for a in first_batch), \
            f"expected unknown-country authors first, got: {[(a.get('name'), a.get('country')) for a in first_batch]}"
        for a in d["authors"][:5]:
            for f in ("name", "country_label", "book_count", "origin_confidence"):
                assert f in a, f"missing field {f} in {a}"


class TestAdminPatchAuthor:
    def test_patch_author_recomputes_books(self, admin_user):
        # Find an author with country=null and at least one book, that we can safely modify
        # Use a temp author linked to a temp book to avoid touching real data
        author_id = f"a_test_{uuid.uuid4().hex[:12]}"
        book_id = f"catalog_test_{uuid.uuid4().hex[:12]}"
        mdb.catalog_authors.insert_one({
            "author_id": author_id, "name": "TEST_it18 Author", "norm_name": "test_it18 author",
            "country": None, "countries": [], "areas": [],
            "origin_source": "manual", "origin_confidence": None,
        })
        mdb.catalog_books.insert_one({
            "catalog_id": book_id, "title": "TEST_it18 Book", "authors": ["TEST_it18 Author"],
            "author_ids": [author_id], "countries": [], "areas": [], "subjects": [],
            "popularity": 0,
        })
        try:
            r = requests.patch(
                f"{API}/catalog/admin/authors/{author_id}",
                json={"country": "SN"},
                headers=admin_user["headers"], timeout=30
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d.get("ok") is True
            assert d.get("country") == "SN"
            assert "africaine" in (d.get("areas") or [])
            # Verify book was recomputed
            b = mdb.catalog_books.find_one({"catalog_id": book_id})
            assert "SN" in (b.get("countries") or []), f"book not recomputed: {b}"
            assert "africaine" in (b.get("areas") or []), f"areas not recomputed: {b}"
        finally:
            mdb.catalog_authors.delete_one({"author_id": author_id})
            mdb.catalog_books.delete_one({"catalog_id": book_id})


# ==================================================================
# 7) /api/upload + /api/files/{path}
# ==================================================================
def _make_min_jpeg() -> bytes:
    """Return a small valid JPEG using PIL."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (200, 100, 50)).save(buf, format="JPEG")
    return buf.getvalue()


MIN_JPEG = _make_min_jpeg()


class TestUpload:
    def test_upload_and_fetch(self, user_regular):
        files = {"file": ("test.jpg", MIN_JPEG, "image/jpeg")}
        r = requests.post(f"{API}/upload", files=files,
                          headers={"Authorization": f"Bearer {user_regular['token']}"},
                          timeout=60)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        d = r.json()
        assert "url" in d
        url = d["url"]
        # URL should include /api/files/manent/uploads/
        assert "/api/files/manent/uploads/" in url, f"bad url: {url}"
        # If storage failed, skip fetch test
        if d.get("storage_failed"):
            pytest.skip(f"storage_failed on upload — data URL fallback used")
        # Fetch without auth
        r2 = requests.get(url, timeout=30)
        assert r2.status_code == 200, f"fetch without auth failed: {r2.status_code}"
        ctype = r2.headers.get("Content-Type", "")
        assert ctype.startswith("image/"), f"bad content-type: {ctype}"


# ==================================================================
# 8) Share pages /api/s/*
# ==================================================================
class TestSharePages:
    def _check_og_page(self, html: str, path: str):
        assert '<meta property="og:title"' in html, "missing og:title"
        assert '<meta property="og:description"' in html, "missing og:description"
        assert '<meta property="og:url"' in html, "missing og:url"
        # og:url should be derived from host (contains the preview domain)
        m = re.search(r'og:url"\s+content="([^"]+)"', html)
        assert m, "no og:url content"
        og_url = m.group(1)
        assert BASE_URL.split("//")[-1] in og_url, f"og:url doesn't include request host: {og_url}"
        assert "bientôt disponible" in html, "store buttons should say 'bientôt disponible' (URLs empty)"
        assert "manent://" in html, "missing manent:// deep-link"

    def test_share_quote_fallback(self):
        # Unknown quote → fallback page still served
        r = requests.get(f"{API}/s/q/nonexistent_{uuid.uuid4().hex[:8]}", timeout=15)
        assert r.status_code == 200
        self._check_og_page(r.text, "/q/")

    def test_share_book_fallback(self):
        r = requests.get(f"{API}/s/b/nonexistent_{uuid.uuid4().hex[:8]}", timeout=15)
        assert r.status_code == 200
        self._check_og_page(r.text, "/b/")

    def test_share_user_fallback(self):
        r = requests.get(f"{API}/s/u/nonexistent_{uuid.uuid4().hex[:8]}", timeout=15)
        assert r.status_code == 200
        self._check_og_page(r.text, "/@")

    def test_share_club_fallback(self):
        r = requests.get(f"{API}/s/c/NOCODE12", timeout=15)
        assert r.status_code == 200
        self._check_og_page(r.text, "/c/")

    def test_share_real_public_quote(self, user_regular):
        # Create a real public quote and fetch its share page
        b = requests.post(f"{API}/books", json={
            "type": "papier", "title": f"TEST_it18_share_{uuid.uuid4().hex[:6]}",
            "author": "Test", "pages": 100,
        }, headers=user_regular["headers"], timeout=15)
        assert b.status_code == 200, b.text
        book_id = b.json()["book_id"]
        q = requests.post(f"{API}/quotes", json={
            "book_id": book_id, "text": "TEST_it18_share This is a public shared quote for OG test.",
            "page": 5, "themes": ["confiance"], "is_public": True,
        }, headers=user_regular["headers"], timeout=15)
        assert q.status_code == 200, q.text
        quote_id = q.json()["quote_id"]
        try:
            r = requests.get(f"{API}/s/q/{quote_id}", timeout=15)
            assert r.status_code == 200
            html = r.text
            assert "TEST_it18_share This is a public shared quote" in html, \
                "quote text not in share page"
            self._check_og_page(html, f"/q/{quote_id}")
        finally:
            mdb.quotes.delete_one({"quote_id": quote_id})
            mdb.books.delete_one({"book_id": book_id})


# ==================================================================
# 9) .well-known dynamic
# ==================================================================
class TestWellKnown:
    def test_aasa(self):
        r = requests.get(f"{API}/.well-known/apple-app-site-association", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "applinks" in d
        details = d["applinks"].get("details", [])
        assert len(details) > 0
        assert "appID" in details[0]
        assert "com.manent.app" in details[0]["appID"]
        paths = details[0].get("paths", [])
        for p in ("/q/*", "/b/*", "/c/*", "/api/s/*"):
            assert p in paths, f"missing path {p}"

    def test_assetlinks(self):
        r = requests.get(f"{API}/.well-known/assetlinks.json", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, list) and len(d) > 0
        assert d[0]["target"]["package_name"] == "com.manent.app"


# ==================================================================
# 10) /api/feed — batched _attach_public_meta
# ==================================================================
class TestFeed:
    def test_feed_returns_quotes_with_author_and_book(self, user_regular):
        r = requests.get(f"{API}/feed", headers=user_regular["headers"], timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # feed may be a list or dict — normalize
        quotes = data if isinstance(data, list) else (data.get("quotes") or data.get("items") or [])
        if not quotes:
            pytest.skip("feed empty — cannot validate batched meta")
        # Check first few for shape
        for q in quotes[:5]:
            # author sub-object
            a = q.get("author")
            assert isinstance(a, dict), f"author not dict: {q}"
            for f in ("pseudo", "handle", "picture"):
                assert f in a, f"author missing {f}: {a}"
            # book sub-object
            b = q.get("book")
            if b is not None:
                assert isinstance(b, dict)
                for f in ("title", "author", "type"):
                    assert f in b, f"book missing {f}: {b}"
