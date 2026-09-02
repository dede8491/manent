"""Fusion des doublons du catalogue après la nouvelle clé tolérante (B4). Relançable."""
import asyncio
import os
import sys
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))
from routes.book_search import _norm_key  # noqa: E402

COLS = ["books", "club_books", "featured_books"]


def score(b):
    return sum(bool(b.get(f)) for f in ["cover", "summary", "isbn13", "pages", "year", "publisher"]) + len(b.get("subjects") or [])


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "manent")]
    groups = {}
    async for b in db.catalog_books.find({}, {"_id": 0}):
        nk = _norm_key(b.get("title"), ", ".join(b.get("authors") or []))
        key = b.get("isbn13") or nk
        groups.setdefault(key, []).append(b)
        await db.catalog_books.update_one({"catalog_id": b["catalog_id"]}, {"$set": {"norm_key": nk}})
    merged = 0
    for key, docs in groups.items():
        if len(docs) < 2:
            continue
        docs.sort(key=score, reverse=True)
        keep, losers = docs[0], docs[1:]
        upd, subjects, areas = {}, set(keep.get("subjects") or []), set(keep.get("areas") or [])
        for l in losers:
            for f in ["cover", "summary", "isbn13", "isbn10", "pages", "year", "publisher", "language"]:
                if l.get(f) and not keep.get(f) and f not in upd:
                    upd[f] = l[f]
            subjects |= set(l.get("subjects") or [])
            areas |= set(l.get("areas") or [])
            for col in COLS:
                await db[col].update_many({"catalog_id": l["catalog_id"]}, {"$set": {"catalog_id": keep["catalog_id"]}})
            await db.catalog_tasks.delete_many({"catalog_id": l["catalog_id"]})
            await db.catalog_books.delete_one({"catalog_id": l["catalog_id"]})
            merged += 1
        upd["subjects"] = sorted(subjects)
        upd["areas"] = sorted(areas)
        await db.catalog_books.update_one({"catalog_id": keep["catalog_id"]}, {"$set": upd})
    print("doublons fusionnés:", merged, "| catalogue:", await db.catalog_books.count_documents({}))

if __name__ == "__main__":
    asyncio.run(main())
