"""Nettoyage des données de test (comptes, livres, citations, clubs, tableaux créés par les tests automatiques
et la démo IA), en gardant tout ce que les vraies lectrices ont créé.

Usage (depuis backend/, avec MONGO_URL et DB_NAME de l'environnement) :

    python3 scripts/cleanup_test_data.py                 # répétition à blanc : liste ce qui serait supprimé, ne touche à rien
    python3 scripts/cleanup_test_data.py --apply         # supprime, après avoir écrit une sauvegarde JSON à côté du script
    python3 scripts/cleanup_test_data.py --remove @handle1,email@x.com   # ajoute des comptes à supprimer (pseudo, handle ou e-mail)
    python3 scripts/cleanup_test_data.py --keep @handle  # protège un compte qui ressemble à un compte de test

Détection (un compte est « de test » si l'un des critères est vrai) :
  - e-mail en @example.com, ou demo@manent.app (compte démo « Léa », user_demo_manent) ;
  - pseudo généré par les tests : Tester1a2b, NF1a2b, Reg1a2b, It13…, It14…, Carol123, BobIt4…, AliceIt5…, UA…, UB…, O1a2b,
    RegLogin, Outsider ;
  - passé explicitement en --remove.
Tout ce qui appartient à ces comptes est supprimé en cascade. Les livres, citations, clubs, tableaux nommés « TEST_… »
sont aussi supprimés même s'ils appartiennent à un compte conservé (résidus de tests joués avec un vrai compte).
Les orphelins (citations/livres sans compte) sont retirés. Le catalogue (catalog_books) n'est PAS touché, sauf
les fiches « TEST_… » que plus personne ne référence.
"""
import os
import re
import sys
import json
import asyncio
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "manent_db")

TEST_EMAIL = re.compile(r"@example\.com$|^demo@manent\.app$", re.I)
TEST_PSEUDO = re.compile(r"^(Tester|NF|Reg|It1[0-9]|Carol|BobIt[0-9]|AliceIt[0-9]|UA|UB|O)[0-9a-f]{3,4}$|^(RegLogin|Outsider)$")
TEST_TITLE = re.compile(r"^TEST[_ ]", re.I)


def _json_default(o):
    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="supprime réellement (sinon répétition à blanc)")
    ap.add_argument("--remove", default="", help="comptes supplémentaires à supprimer : pseudos, @handles ou e-mails, séparés par des virgules")
    ap.add_argument("--keep", default="", help="comptes à protéger : pseudos, @handles ou e-mails, séparés par des virgules")
    args = ap.parse_args()
    extra = {x.strip().lstrip("@").lower() for x in args.remove.split(",") if x.strip()}
    keep = {x.strip().lstrip("@").lower() for x in args.keep.split(",") if x.strip()}

    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

    # ---------------------------------------------------------------- 1. Comptes de test
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1, "pseudo": 1, "handle": 1, "created_at": 1, "is_admin": 1}).to_list(100000)
    def ident(u):
        return {str(u.get("email") or "").lower(), str(u.get("pseudo") or "").lower(), str(u.get("handle") or "").lower()}
    test_users = []
    for u in users:
        if u.get("is_admin"):
            continue
        if ident(u) & keep:
            continue
        is_test = bool(TEST_EMAIL.search(u.get("email") or "")) or bool(TEST_PSEUDO.match(u.get("pseudo") or "")) \
            or u.get("user_id") == "user_demo_manent" or bool(ident(u) & extra)
        if is_test:
            test_users.append(u)
    uids = [u["user_id"] for u in test_users]
    known_uids = {u["user_id"] for u in users}

    # ---------------------------------------------------------------- 2. Contenus à supprimer
    plan: dict = {}

    async def collect(name, flt):
        docs = await db[name].find(flt, {"_id": 0}).to_list(500000)
        if docs:
            plan.setdefault(name, []).extend(docs)
        return docs

    # livres et citations des comptes de test + résidus « TEST_ » + orphelins
    books = await collect("books", {"$or": [{"user_id": {"$in": uids}}, {"title": TEST_TITLE}, {"user_id": {"$nin": list(known_uids)}}]})
    book_ids = [b["book_id"] for b in books]
    quotes = await collect("quotes", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}, {"text": TEST_TITLE},
                                             {"user_id": {"$nin": list(known_uids)}}]})
    quote_ids = [q["quote_id"] for q in quotes]
    await collect("quote_likes", {"$or": [{"quote_id": {"$in": quote_ids}}, {"user_id": {"$in": uids}}]})
    await collect("quote_comments", {"$or": [{"quote_id": {"$in": quote_ids}}, {"user_id": {"$in": uids}}]})
    await collect("flashcards", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}]})
    await collect("book_summaries", {"book_id": {"$in": book_ids}})
    await collect("reading_events", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}]})
    # tableaux
    boards = await collect("boards", {"$or": [{"user_id": {"$in": uids}}, {"name": TEST_TITLE}]})
    board_ids = [b["board_id"] for b in boards]
    await collect("board_quotes", {"$or": [{"board_id": {"$in": board_ids}}, {"quote_id": {"$in": quote_ids}}, {"pinned_by": {"$in": uids}}]})
    # clubs (possédés par un compte de test ou nommés TEST_) et tout leur contenu
    clubs = await collect("clubs", {"$or": [{"owner_id": {"$in": uids}}, {"name": TEST_TITLE}]})
    club_ids = [c["club_id"] for c in clubs]
    for col in ("club_books", "club_posts", "club_comments", "club_messages", "club_polls", "club_events", "club_readers", "club_reviews"):
        await collect(col, {"$or": [{"club_id": {"$in": club_ids}}, {"user_id": {"$in": uids}}, {"author_id": {"$in": uids}}]})
    await collect("club_books", {"title": TEST_TITLE})
    # relations sociales, recommandations, invitations, signalements, sessions
    await collect("follows", {"$or": [{"follower_id": {"$in": uids}}, {"followed_id": {"$in": uids}}]})
    await collect("recommendations", {"$or": [{"from_id": {"$in": uids}}, {"to_id": {"$in": uids}}]})
    await collect("invitations", {"$or": [{"from_id": {"$in": uids}}, {"to_id": {"$in": uids}}, {"target_id": {"$in": board_ids + club_ids}}]})
    await collect("reports", {"$or": [{"reporter_id": {"$in": uids}}, {"user_id": {"$in": uids}}]})
    await collect("user_sessions", {"user_id": {"$in": uids}})
    await collect("sessions", {"user_id": {"$in": uids}})
    await collect("user_recos", {"user_id": {"$in": uids}})
    await collect("reco_dismissed", {"user_id": {"$in": uids}})
    await collect("llm_usage", {"user_id": {"$in": uids}})
    # fiches catalogue « TEST_ » que plus aucun vrai livre ne référence
    test_cb = await db.catalog_books.find({"title": TEST_TITLE}, {"_id": 0, "catalog_id": 1, "title": 1}).to_list(10000)
    keep_cb = set(await db.books.distinct("catalog_id", {"catalog_id": {"$in": [c["catalog_id"] for c in test_cb]}, "book_id": {"$nin": book_ids}}))
    cb_del = [c for c in test_cb if c["catalog_id"] not in keep_cb]
    if cb_del:
        plan["catalog_books"] = cb_del
        plan["catalog_tasks"] = await db.catalog_tasks.find({"catalog_id": {"$in": [c["catalog_id"] for c in cb_del]}}, {"_id": 0}).to_list(10000)
    plan["users"] = test_users

    # ---------------------------------------------------------------- 3. Rapport
    print(f"Base : {DB_NAME}  —  {'SUPPRESSION' if args.apply else 'RÉPÉTITION À BLANC (rien n’est supprimé)'}\n")
    print(f"Comptes de test détectés : {len(test_users)}")
    for u in sorted(test_users, key=lambda x: str(x.get("created_at"))):
        nb = sum(1 for b in books if b.get("user_id") == u["user_id"])
        nq = sum(1 for q in quotes if q.get("user_id") == u["user_id"])
        print(f"  - {u.get('pseudo','?'):<16} @{u.get('handle','?'):<16} {u.get('email','?'):<36} {str(u.get('created_at'))[:10]}  {nb} livres, {nq} citations")
    print("\nComptes CONSERVÉS :")
    for u in users:
        if u["user_id"] not in uids:
            print(f"  · {u.get('pseudo','?'):<16} @{u.get('handle','?'):<16} {u.get('email','?')}{'  (admin)' if u.get('is_admin') else ''}")
    print("\nÀ supprimer, par collection :")
    for name, docs in sorted(plan.items()):
        print(f"  {name:<22} {len(docs)}")
    residual = [b for b in books if b.get("user_id") not in uids]
    if residual:
        print("\nLivres « TEST_ » ou orphelins sur des comptes conservés :")
        for b in residual[:40]:
            print(f"  - {b.get('title')}  (user {b.get('user_id')})")

    if not args.apply:
        print("\nRelance avec --apply pour supprimer. Ajoute --keep @handle pour protéger un compte, --remove pour en ajouter.")
        return

    # ---------------------------------------------------------------- 4. Sauvegarde puis suppression
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"cleanup_backup_{stamp}.json")
    with open(backup, "w", encoding="utf-8") as f:
        json.dump(plan, f, default=_json_default, ensure_ascii=False)
    print(f"\nSauvegarde écrite : {backup}")
    keys = {"users": "user_id", "books": "book_id", "quotes": "quote_id", "boards": "board_id", "clubs": "club_id",
            "catalog_books": "catalog_id", "quote_comments": "comment_id", "invitations": "invite_id", "recommendations": "reco_id",
            "club_books": "cb_id", "club_posts": "post_id", "club_polls": "poll_id", "club_events": "event_id", "flashcards": "flashcard_id"}
    total = 0
    for name, docs in plan.items():
        key = keys.get(name)
        if key and all(key in d for d in docs):
            r = await db[name].delete_many({key: {"$in": [d[key] for d in docs]}})
        else:
            # collections sans identifiant unique : suppression document par document sur tous les champs
            n = 0
            for d in docs:
                flt = {k: v for k, v in d.items() if isinstance(v, (str, int, float, bool)) or v is None}
                n += (await db[name].delete_one(flt)).deleted_count
            class R: deleted_count = n
            r = R()
        total += r.deleted_count
        print(f"  {name:<22} supprimés : {r.deleted_count}")
    # compteurs des citations conservées
    for q in await db.quotes.find({}, {"_id": 0, "quote_id": 1}).to_list(500000):
        lk = await db.quote_likes.count_documents({"quote_id": q["quote_id"]})
        cm = await db.quote_comments.count_documents({"quote_id": q["quote_id"]})
        await db.quotes.update_one({"quote_id": q["quote_id"]}, {"$set": {"likes_count": lk, "comments_count": cm}})
    # membres fantômes dans les tableaux et clubs conservés
    await db.boards.update_many({}, {"$pull": {"members": {"$in": uids}}})
    await db.clubs.update_many({}, {"$pull": {"members": {"$in": uids}}})
    print(f"\nTerminé : {total} documents supprimés. Sauvegarde : {backup}")


if __name__ == "__main__":
    asyncio.run(main())
