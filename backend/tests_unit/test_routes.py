"""Tests de routes en mémoire (mongomock) : auth, quota journal, entrées, force brute, visibilité des citations.
Aucun réseau, aucune base réelle. Lancer depuis backend/ : python3 -m pytest tests_unit -q
"""
import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "manent_test")
os.environ.setdefault("EXPO_PUBLIC_BACKEND_URL", "http://test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
import httpx  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import deps  # noqa: E402
import server  # noqa: E402
import routes.journal as journal  # noqa: E402
import routes.catalog as catalog  # noqa: E402
import routes.classification as classification  # noqa: E402
import routes.club as club  # noqa: E402
import routes.share as share  # noqa: E402
import routes.push as push  # noqa: E402


@pytest.fixture
def fake_db(monkeypatch):
    db = AsyncMongoMockClient()["manent_test"]
    for mod in (deps, server, journal, catalog, classification, club, share, push):
        if hasattr(mod, "db"):
            monkeypatch.setattr(mod, "db", db)
    return db


@pytest.fixture
async def client(fake_db):
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client, email="lea@manent-tests.org", pseudo="Léa"):
    r = await client.post("/api/auth/register", json={"email": email, "password": "secret123", "pseudo": pseudo, "birthdate": "1990-05-01"})
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    return {"Authorization": f"Bearer {tok}"}, r.json()["user"]


async def test_register_login_and_bruteforce(client, fake_db):
    headers, user = await register(client)
    me = await client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["user"]["pseudo"] == "Léa"
    assert (await client.get("/api/auth/me")).status_code == 401
    for _ in range(5):
        r = await client.post("/api/auth/login", json={"email": "lea@manent-tests.org", "password": "wrong"})
        assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"email": "lea@manent-tests.org", "password": "secret123"})
    assert r.status_code == 429, "après cinq échecs, le compte est protégé même avec le bon mot de passe"
    await fake_db.login_attempts.delete_many({})
    r = await client.post("/api/auth/login", json={"email": "lea@manent-tests.org", "password": "secret123"})
    assert r.status_code == 200


async def test_journal_entry_advances_book_and_quota(client, fake_db):
    headers, user = await register(client)
    uid = user["user_id"]
    await fake_db.books.insert_one({"book_id": "bk_1", "user_id": uid, "type": "papier", "title": "Le Monde", "pages": 200, "progress_page": 10, "status": "a_lire", "read_count": 0})
    home = await client.get("/api/journal/home", headers=headers)
    assert home.status_code == 200 and home.json()["quota"] == {"used": 0, "limit": 3, "remaining": 3, "blocked": False}
    r = await client.post("/api/journal/entries", headers=headers, json={"book_id": "bk_1", "client_id": "c1", "page": 42, "mood": 4, "content": "Très beau chapitre."})
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["mood_info"]["label"] == "Porté" and e["book"]["title"] == "Le Monde"
    book = await fake_db.books.find_one({"book_id": "bk_1"})
    assert book["progress_page"] == 42 and book["status"] == "en_cours", "la page atteinte fait avancer le livre et le passe en cours"
    ev = await fake_db.reading_events.find_one({"user_id": uid})
    assert ev and ev["pages"] == 32
    # idempotence hors ligne : même client_id → même entrée
    again = await client.post("/api/journal/entries", headers=headers, json={"book_id": "bk_1", "client_id": "c1", "content": "rejoué"})
    assert again.json()["entry_id"] == e["entry_id"]
    assert await fake_db.journal_entries.count_documents({}) == 1
    # quota gratuit : trois entrées par semaine
    for i in range(2):
        assert (await client.post("/api/journal/entries", headers=headers, json={"book_id": "bk_1", "content": f"e{i}"})).status_code == 200
    r = await client.post("/api/journal/entries", headers=headers, json={"book_id": "bk_1", "content": "une de trop"})
    assert r.status_code == 402 and r.json()["detail"] == "journal_limit"
    lst = await client.get("/api/journal/entries?book_id=bk_1", headers=headers)
    assert lst.json()["total"] == 3
    # une page qui atteint le total termine le livre
    await fake_db.users.update_one({"user_id": uid}, {"$set": {"is_premium": True}})
    r = await client.post("/api/journal/entries", headers=headers, json={"book_id": "bk_1", "page": 200, "content": "fin"})
    assert r.status_code == 200
    book = await fake_db.books.find_one({"book_id": "bk_1"})
    assert book["status"] == "termine" and book["read_count"] == 1
    wrap = await client.get("/api/journal/books/bk_1/wrapup", headers=headers)
    assert wrap.status_code == 200 and wrap.json()["entries_count"] == 4 and wrap.json()["is_premium"] is True


async def test_quote_visibility_and_free_book_limit(client, fake_db):
    h1, u1 = await register(client, "a@manent-tests.org", "Anna")
    h2, u2 = await register(client, "b@manent-tests.org", "Bruno")
    await fake_db.quotes.insert_one({"quote_id": "q_priv", "user_id": u1["user_id"], "text": "secret", "is_public": False, "visibility": "private", "created_at": server.now_utc()})
    await fake_db.quotes.insert_one({"quote_id": "q_pub", "user_id": u1["user_id"], "text": "ouvert", "is_public": True, "visibility": "public", "created_at": server.now_utc()})
    assert (await client.get("/api/quotes/q_priv", headers=h2)).status_code == 404
    assert (await client.get("/api/quotes/q_priv", headers=h1)).status_code == 200
    r = await client.get("/api/quotes/q_pub", headers=h2)
    assert r.status_code == 200 and r.json()["is_owner"] is False
    # gratuit : un seul nouveau livre en cours, les autres restent possibles « à lire »
    await fake_db.books.insert_one({"book_id": "bk_a", "user_id": u2["user_id"], "type": "papier", "title": "A", "status": "en_cours"})
    r = await client.patch("/api/books/bk_a", headers=h2, json={"progress_page": 5})
    assert r.status_code in (200, 404)  # patch sur un livre en cours reste permis
    await fake_db.books.insert_one({"book_id": "bk_b", "user_id": u2["user_id"], "type": "papier", "title": "B", "status": "a_lire", "pages": 100, "progress_page": 0})
    r = await client.patch("/api/books/bk_b", headers=h2, json={"status": "en_cours"})
    assert r.status_code == 402 and r.json()["detail"] == "books_in_progress_limit"


async def test_upload_rejects_non_images(client):
    headers, _ = await register(client)
    r = await client.post("/api/upload", headers=headers, files={"file": ("x.jpg", b"not an image at all", "image/jpeg")})
    assert r.status_code == 415
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    r = await client.post("/api/upload", headers=headers, files={"file": ("x.bin", png, "application/octet-stream")})
    assert r.status_code == 200 and r.json()["url"].startswith("data:image/png")


async def test_notification_center(client, fake_db):
    headers, user = await register(client, "n@manent-tests.org", "Nora")
    await push.store_notifications([user["user_id"]], {"title": "Léa", "message": "a aimé ta citation", "data": {"type": "quote_like", "quote_id": "q1"}}, idempotency_key="like_q1_x")
    await push.store_notifications([user["user_id"]], {"title": "Léa", "message": "a aimé ta citation", "data": {"type": "quote_like", "quote_id": "q1"}}, idempotency_key="like_q1_x")
    b = await client.get("/api/notifications/badge", headers=headers)
    assert b.status_code == 200 and b.json()["unread"] == 1, "idempotent : une seule notification pour la même clé"
    r = await client.get("/api/notifications", headers=headers)
    assert r.status_code == 200 and r.json()["notifications"][0]["action_url"] == "/quote/q1"
    assert (await client.get("/api/notifications/badge", headers=headers)).json()["unread"] == 0, "lue une fois la liste ouverte"


async def test_notification_preferences_filter(client, fake_db):
    headers, user = await register(client, "p@manent-tests.org", "Paule")
    r = await client.get("/api/me/notifications", headers=headers)
    assert r.status_code == 200 and all(k["enabled"] for k in r.json()["kinds"]) and len(r.json()["kinds"]) == 8
    r = await client.patch("/api/me/notifications", headers=headers, json={"prefs": {"quote_like": False, "bogus": False}})
    assert {k["key"]: k["enabled"] for k in r.json()["kinds"]}["quote_like"] is False
    like = {"title": "Manent", "message": "Léa a aimé ta citation", "data": {"type": "quote_like", "quote_id": "q1"}}
    assert await push.filter_recipients([user["user_id"]], push.notif_kind(like)) == []
    follow = {"title": "Manent", "message": "Léa suit maintenant tes lectures", "action_url": "/reader/lea"}
    assert push.notif_kind(follow) == "new_follower"
    assert await push.filter_recipients([user["user_id"]], "new_follower") == [user["user_id"]]
    assert push.notif_kind({"title": "Léa", "message": "« … »", "action_url": "/quote/q9"}) == "followed_quote"
    assert push.notif_kind({"title": "Mon club", "message": "x", "action_url": "/club/c1"}) == "club"
