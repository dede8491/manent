"""Migration : relie db.books, club_books, featured_books au catalogue (ISBN ou norm_key). Relançable."""
import asyncio
import os
import sys
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
import routes.catalog as catalog  # noqa: E402


async def link(col, id_field):
    n = 0
    async for b in catalog.db[col].find({"catalog_id": {"$exists": False}}, {"_id": 0, id_field: 1, "title": 1, "author": 1, "isbn": 1, "pages": 1, "year": 1, "cover": 1, "type": 1}):
        if b.get("type") == "etude" or not b.get("title"):
            continue
        cb = await catalog.upsert_catalog_book(
            {"title": b["title"], "author": b.get("author"), "isbn": b.get("isbn"),
             "pages": b.get("pages"), "year": b.get("year"), "cover": b.get("cover")},
            source="migration")
        if cb:
            await catalog.db[col].update_one({id_field: b[id_field]}, {"$set": {"catalog_id": cb["catalog_id"]}})
            if col == "books":
                await catalog.db.catalog_books.update_one({"catalog_id": cb["catalog_id"]}, {"$inc": {"popularity": 1}})
            n += 1
    return n


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    catalog.db = client[os.environ.get("DB_NAME", "manent")]
    print("books:", await link("books", "book_id"))
    print("club_books:", await link("club_books", "cb_id"))
    print("featured_books:", await link("featured_books", "title"))

if __name__ == "__main__":
    asyncio.run(main())
