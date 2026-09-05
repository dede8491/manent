"""Nettoyage des données de test — logique partagée par scripts/cleanup_test_data.py et la route admin
DELETE /api/admin/users/{user_id} (suppression d’un compte depuis le Dashboard admin, via plan_accounts).

Détection (un compte est « de test » si l'un des critères est vrai) :
  - e-mail en @example.com, ou demo@manent.app (compte démo « Léa », user_demo_manent) ;
  - pseudo généré par les tests : Tester1a2b, NF1a2b, Reg1a2b, It13…, It14…, Carol123, BobIt4…, AliceIt5…, UA…, UB…, O1a2b,
    RegLogin, Outsider ;
  - passé explicitement dans `extra` (pseudo, handle ou e-mail).
Tout ce qui appartient à ces comptes est supprimé en cascade. Les livres, citations, clubs, tableaux nommés « TEST_… »
sont aussi supprimés même s'ils appartiennent à un compte conservé. Les orphelins sont retirés. Le catalogue n'est pas
touché, sauf les fiches « TEST_… » que plus personne ne référence. Les comptes admin et ceux de `keep` sont toujours protégés.
"""
import os
import re
import json
from datetime import datetime, timezone

TEST_EMAIL = re.compile(r"@example\.com$|^demo@manent\.app$", re.I)
TEST_PSEUDO = re.compile(r"^(Tester|NF|Reg|It1[0-9]|Carol|BobIt[0-9]|AliceIt[0-9]|UA|UB|O)[0-9a-f]{3,4}$|^(RegLogin|Outsider)$")
TEST_TITLE = re.compile(r"^TEST[_ ]", re.I)


def _json_default(o):
    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)


def _ident(u):
    return {str(u.get("email") or "").lower(), str(u.get("pseudo") or "").lower(), str(u.get("handle") or "").lower()}


async def plan_cleanup(db, extra: set, keep: set) -> dict:
    """Calcule ce qui serait supprimé. Ne modifie rien. Retourne {plan, users, test_users, uids, books, quotes}."""

    # ---------------------------------------------------------------- 1. Comptes de test
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1, "pseudo": 1, "handle": 1, "created_at": 1, "is_admin": 1}).to_list(100000)
    test_users = []
    for u in users:
        if u.get("is_admin"):
            continue
        if _ident(u) & keep:
            continue
        is_test = bool(TEST_EMAIL.search(u.get("email") or "")) or bool(TEST_PSEUDO.match(u.get("pseudo") or "")) \
            or u.get("user_id") == "user_demo_manent" or bool(_ident(u) & extra)
        if is_test:
            test_users.append(u)
    uids = [u["user_id"] for u in test_users]
    known_uids = {u["user_id"] for u in users}
    plan, books, quotes = await _collect_plan(db, uids, known_uids, residue=True)
    plan["users"] = test_users
    return {"plan": plan, "users": users, "test_users": test_users, "uids": uids, "books": books, "quotes": quotes}


async def plan_accounts(db, uids: list) -> dict:
    """Plan de suppression ciblé sur des comptes précis (aucune détection automatique, aucun résidu « TEST_ »).
    Les comptes admin sont ignorés. Même format de retour que plan_cleanup, utilisable avec report/apply_cleanup."""
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1, "pseudo": 1, "handle": 1, "created_at": 1, "is_admin": 1}).to_list(100000)
    targets = [u for u in users if u["user_id"] in set(uids) and not u.get("is_admin")]
    tuids = [u["user_id"] for u in targets]
    plan, books, quotes = await _collect_plan(db, tuids, {u["user_id"] for u in users}, residue=False)
    plan["users"] = targets
    return {"plan": plan, "users": users, "test_users": targets, "uids": tuids, "books": books, "quotes": quotes}


async def _collect_plan(db, uids: list, known_uids: set, residue: bool):
    """Tout ce qui appartient aux comptes `uids`. Avec residue=True : aussi les contenus « TEST_ » et les orphelins."""
    plan: dict = {}
    never = {"user_id": {"$in": []}}  # filtre vide : ne correspond à rien

    async def collect(name, flt):
        docs = await db[name].find(flt, {"_id": 0}).to_list(500000)
        if docs:
            plan.setdefault(name, []).extend(docs)
        return docs

    def titled(field):
        return {field: TEST_TITLE} if residue else never

    orphan = {"user_id": {"$nin": list(known_uids)}} if residue else never
    books = await collect("books", {"$or": [{"user_id": {"$in": uids}}, titled("title"), orphan]})
    book_ids = [b["book_id"] for b in books]
    quotes = await collect("quotes", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}, titled("text"), orphan]})
    quote_ids = [q["quote_id"] for q in quotes]
    await collect("quote_likes", {"$or": [{"quote_id": {"$in": quote_ids}}, {"user_id": {"$in": uids}}]})
    await collect("quote_comments", {"$or": [{"quote_id": {"$in": quote_ids}}, {"user_id": {"$in": uids}}]})
    await collect("flashcards", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}]})
    await collect("book_summaries", {"book_id": {"$in": book_ids}})
    await collect("reading_events", {"$or": [{"user_id": {"$in": uids}}, {"book_id": {"$in": book_ids}}]})
    # tableaux
    boards = await collect("boards", {"$or": [{"user_id": {"$in": uids}}, titled("name")]})
    board_ids = [b["board_id"] for b in boards]
    await collect("board_quotes", {"$or": [{"board_id": {"$in": board_ids}}, {"quote_id": {"$in": quote_ids}}, {"pinned_by": {"$in": uids}}]})
    # clubs (possédés par un compte de test ou nommés TEST_) et tout leur contenu
    clubs = await collect("clubs", {"$or": [{"owner_id": {"$in": uids}}, titled("name")]})
    club_ids = [c["club_id"] for c in clubs]
    for col in ("club_books", "club_posts", "club_comments", "club_messages", "club_polls", "club_events", "club_readers", "club_reviews"):
        await collect(col, {"$or": [{"club_id": {"$in": club_ids}}, {"user_id": {"$in": uids}}, {"author_id": {"$in": uids}}]})
    if residue:
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
    if residue:
        test_cb = await db.catalog_books.find({"title": TEST_TITLE}, {"_id": 0, "catalog_id": 1, "title": 1}).to_list(10000)
        keep_cb = set(await db.books.distinct("catalog_id", {"catalog_id": {"$in": [c["catalog_id"] for c in test_cb]}, "book_id": {"$nin": book_ids}}))
        cb_del = [c for c in test_cb if c["catalog_id"] not in keep_cb]
        if cb_del:
            plan["catalog_books"] = cb_del
            plan["catalog_tasks"] = await db.catalog_tasks.find({"catalog_id": {"$in": [c["catalog_id"] for c in cb_del]}}, {"_id": 0}).to_list(10000)
    return plan, books, quotes


def report(db_name: str, res: dict, apply: bool) -> dict:
    """Rapport lisible (texte + données) : comptes de test, comptes conservés, compteurs par collection."""
    plan, users, test_users, uids, books, quotes = res["plan"], res["users"], res["test_users"], res["uids"], res["books"], res["quotes"]
    lines = [f"Base : {db_name}  —  {'SUPPRESSION' if apply else 'RÉPÉTITION À BLANC (rien n’est supprimé)'}", "",
             f"Comptes de test détectés : {len(test_users)}"]
    detected = []
    for u in sorted(test_users, key=lambda x: str(x.get("created_at"))):
        nb = sum(1 for b in books if b.get("user_id") == u["user_id"])
        nq = sum(1 for q in quotes if q.get("user_id") == u["user_id"])
        detected.append({"pseudo": u.get("pseudo"), "handle": u.get("handle"), "email": u.get("email"), "created_at": str(u.get("created_at"))[:10], "books": nb, "quotes": nq})
        lines.append(f"  - {u.get('pseudo','?'):<16} @{u.get('handle','?'):<16} {u.get('email','?'):<36} {str(u.get('created_at'))[:10]}  {nb} livres, {nq} citations")
    lines += ["", "Comptes CONSERVÉS :"]
    kept = []
    for u in users:
        if u["user_id"] not in uids:
            kept.append({"pseudo": u.get("pseudo"), "handle": u.get("handle"), "email": u.get("email"), "is_admin": bool(u.get("is_admin"))})
            lines.append(f"  · {u.get('pseudo','?'):<16} @{u.get('handle','?'):<16} {u.get('email','?')}{'  (admin)' if u.get('is_admin') else ''}")
    lines += ["", "À supprimer, par collection :"]
    counts = {name: len(docs) for name, docs in sorted(plan.items())}
    for name, n in counts.items():
        lines.append(f"  {name:<22} {n}")
    residual = [{"title": b.get("title"), "user_id": b.get("user_id")} for b in books if b.get("user_id") not in uids]
    if residual:
        lines += ["", "Livres « TEST_ » ou orphelins sur des comptes conservés :"] + [f"  - {b['title']}  (user {b['user_id']})" for b in residual[:40]]
    return {"db": db_name, "apply": apply, "text": "\n".join(lines), "test_accounts": detected, "kept_accounts": kept,
            "counts": counts, "residual_books": residual}


async def apply_cleanup(db, res: dict, backup_dir: str) -> dict:
    """Sauvegarde JSON puis suppression. Retourne {backup, deleted, per_collection}."""
    plan, uids = res["plan"], res["uids"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    os.makedirs(backup_dir, exist_ok=True)
    backup = os.path.join(backup_dir, f"cleanup_backup_{stamp}.json")
    with open(backup, "w", encoding="utf-8") as f:
        json.dump(plan, f, default=_json_default, ensure_ascii=False)
    keys = {"users": "user_id", "books": "book_id", "quotes": "quote_id", "boards": "board_id", "clubs": "club_id",
            "catalog_books": "catalog_id", "quote_comments": "comment_id", "invitations": "invite_id", "recommendations": "reco_id",
            "club_books": "cb_id", "club_posts": "post_id", "club_polls": "poll_id", "club_events": "event_id", "flashcards": "flashcard_id"}
    total, per = 0, {}
    for name, docs in plan.items():
        key = keys.get(name)
        if key and all(key in d for d in docs):
            n = (await db[name].delete_many({key: {"$in": [d[key] for d in docs]}})).deleted_count
        else:
            n = 0
            for d in docs:
                flt = {k: v for k, v in d.items() if isinstance(v, (str, int, float, bool)) or v is None}
                n += (await db[name].delete_one(flt)).deleted_count
        per[name] = n
        total += n
    for q in await db.quotes.find({}, {"_id": 0, "quote_id": 1}).to_list(500000):
        lk = await db.quote_likes.count_documents({"quote_id": q["quote_id"]})
        cm = await db.quote_comments.count_documents({"quote_id": q["quote_id"]})
        await db.quotes.update_one({"quote_id": q["quote_id"]}, {"$set": {"likes_count": lk, "comments_count": cm}})
    if uids:
        await db.boards.update_many({}, {"$pull": {"members": {"$in": uids}}})
        await db.clubs.update_many({}, {"$pull": {"members": {"$in": uids}}})
    return {"backup": backup, "deleted": total, "per_collection": per}
