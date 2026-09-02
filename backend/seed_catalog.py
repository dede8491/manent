"""Amorçage du catalogue Manent — relançable sans doublons (upsert norm_key/ISBN).

Croisement sujet × aire : chaque sujet et chaque aire visent ≥ 50 titres.
Sources : Open Library (subject + language:fre), BnF, Google Books (si quota dispo).
Usage : cd /app/backend && python3 seed_catalog.py [--min-per-subject 50]
"""
import asyncio
import os
import sys
import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

import routes.catalog as catalog  # noqa: E402
from routes.book_search import _search_google, _search_openlibrary, _search_bnf  # noqa: E402

MIN_PER = int(sys.argv[sys.argv.index("--min-per-subject") + 1]) if "--min-per-subject" in sys.argv else 50


async def seed_subject(http, subject: str):
    inserted = 0
    sources = catalog.SUBJECT_MAPPING.get(subject, [subject])
    for src_subj in sources:
        if await count_subject(subject) >= MIN_PER:
            break
        ol = await _search_openlibrary(http, f'subject:"{src_subj}" language:fre', 40)
        for b in ol:
            if b.get("title"):
                await catalog.upsert_catalog_book(b | {"raw_subjects": [src_subj]}, source="openlibrary", subjects=[subject])
                inserted += 1
        # BnF par mot-sujet (riche en éditions françaises)
        bnf = await _search_bnf(http, src_subj if src_subj.isascii() else subject)
        for b in bnf:
            if b.get("title"):
                await catalog.upsert_catalog_book(b, source="bnf", subjects=[subject])
                inserted += 1
        # Google en complément (tolère le 429)
        g = await _search_google(http, f'subject:"{src_subj}"', 20)
        for b in g:
            if b.get("title"):
                await catalog.upsert_catalog_book(b | {"raw_subjects": [src_subj]}, source="google", subjects=[subject])
                inserted += 1
    return inserted


async def count_subject(subject: str) -> int:
    return await catalog.db.catalog_books.count_documents({"subjects": subject})


async def count_area_sugg(area: str) -> int:
    accepted = await catalog.db.catalog_books.count_documents({"areas": area})
    pending = await catalog.db.area_suggestions.count_documents({"area": area})
    return accepted + pending


async def seed_area(http, area: str):
    """Les requêtes par aire créent des SUGGESTIONS (à valider dans l'admin), jamais d'aire directe."""
    inserted = 0
    for q in catalog.AREA_QUERIES.get(area, []):
        if await count_area_sugg(area) >= MIN_PER:
            break
        ol = await _search_openlibrary(http, f'subject:"{q}" language:fre', 30)
        if len(ol) < 5:
            ol += await _search_openlibrary(http, f'subject:"{q}"', 30)
        for b in ol:
            if b.get("title"):
                await catalog.upsert_catalog_book(b | {"raw_subjects": [q]}, source="openlibrary", area_suggestion=area)
                inserted += 1
        g = await _search_google(http, f'subject:"{q}"', 20)
        for b in g:
            if b.get("title"):
                await catalog.upsert_catalog_book(b, source="google", area_suggestion=area)
                inserted += 1
    return inserted


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    catalog.db = client[os.environ.get("DB_NAME", "manent")]
    async with httpx.AsyncClient(timeout=15) as http:
        for s in catalog.SUBJECTS:
            n = await seed_subject(http, s)
            print(f"[sujet] {s}: +{n} traités, total={await count_subject(s)}")
        for a in [x["key"] for x in catalog.AREAS]:
            n = await seed_area(http, a)
            print(f"[aire]  {a}: +{n} traités, suggestions+validés={await count_area_sugg(a)}")
    total = await catalog.db.catalog_books.count_documents({})
    pending = await catalog.db.catalog_tasks.count_documents({"status": "pending"})
    print(f"\nCatalogue : {total} livres | tâches d'enrichissement en file : {pending}")

if __name__ == "__main__":
    asyncio.run(main())
