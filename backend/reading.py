"""Règles de lecture partagées : une seule implémentation de la progression, des événements de lecture,
de la série de jours et de la visibilité d'une citation. Utilisé par server.py et routes/journal.py.

Avant : trois logiques de progression (fiche livre, citation, journal), deux calculs de série (profil, accueil)
et cinq contrôles de visibilité, qui pouvaient se contredire.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def day_key(d: Optional[datetime] = None) -> str:
    return (d or now_utc()).strftime("%Y-%m-%d")


# ------------------------------------------------------------------------------------------------ événements et série
async def log_event(db, user_id: str, pages: int = 0) -> None:
    """Une activité de lecture aujourd'hui (pages lues en plus, action +1). Alimente série, stats, rétrospective."""
    await db.reading_events.update_one({"user_id": user_id, "day": day_key()},
                                       {"$inc": {"pages": max(0, int(pages or 0)), "actions": 1}}, upsert=True)


def compute_streak(active_days, today) -> int:
    """Jours consécutifs d'activité ; la série tient encore si la dernière activité date d'hier."""
    streak, d = 0, today
    if d.strftime("%Y-%m-%d") not in active_days:
        d = today - timedelta(days=1)
    while d.strftime("%Y-%m-%d") in active_days:
        streak += 1
        d -= timedelta(days=1)
    return streak


# ------------------------------------------------------------------------------------------------ progression
def progress_update(book: dict, page: Optional[int] = None, chapter: Optional[int] = None) -> dict:
    """Champs à écrire pour faire avancer un livre. Pur.
    Règles : ne recule jamais ; borné au total quand il est connu ; un livre « à lire » passe « en cours » ;
    atteindre le total termine le livre (finished_at, read_count). Retourne aussi `delta` (pages lues en plus)."""
    wp = book.get("type") == "wattpad"
    key, val, total = ("progress_chapter", chapter, book.get("chapters")) if wp else ("progress_page", page, book.get("pages"))
    upd: dict = {"updated_at": now_utc()}
    delta = 0
    cur = int(book.get(key) or 0)
    if val is not None and int(val) > cur:
        val = min(int(total), int(val)) if total else int(val)
        delta = val - cur if not wp else 0
        upd[key] = val
        if total and val >= int(total) and book.get("status") != "termine":
            upd["status"] = "termine"
            upd["finished_at"] = now_utc()
            upd["read_count"] = int(book.get("read_count") or 0) + 1
            upd["is_rereading"] = False
    if "status" not in upd and book.get("status") == "a_lire":
        upd["status"] = "en_cours"
    upd["delta"] = delta
    return upd


async def advance_book(db, user_id: str, book: dict, page: Optional[int] = None, chapter: Optional[int] = None) -> dict:
    """Applique progress_update en base et journalise l'événement de lecture. Retourne les champs écrits."""
    upd = progress_update(book, page, chapter)
    delta = upd.pop("delta")
    await db.books.update_one({"book_id": book["book_id"], "user_id": user_id}, {"$set": upd})
    await log_event(db, user_id, delta)
    return upd


# ------------------------------------------------------------------------------------------------ visibilité
def is_adult(user: dict) -> bool:
    """>= 18 ans. Sans date de naissance → mineur par prudence."""
    bd = user.get("birthdate")
    if not bd:
        return False
    try:
        d = datetime.strptime(bd, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    today = now_utc()
    return (today.year - d.year - ((today.month, today.day) < (d.month, d.day))) >= 18


def quote_visible(q: dict, viewer: dict, follows_author: bool = False) -> bool:
    """Une citation est visible par `viewer` si : c'est la sienne ; ou elle est publique (ou « abonnés » et le viewer suit
    l'autrice), non masquée, et non sensible pour un mineur."""
    if q.get("user_id") == viewer.get("user_id"):
        return True
    allowed = bool(q.get("is_public")) or (q.get("visibility") == "followers" and follows_author)
    if not allowed or q.get("is_hidden"):
        return False
    if q.get("is_sensitive") and not is_adult(viewer):
        return False
    return True


async def visible_quote(db, quote_id: str, viewer: dict) -> Optional[dict]:
    """Charge la citation et applique quote_visible (avec la relation d'abonnement si nécessaire). None si invisible."""
    q = await db.quotes.find_one({"quote_id": quote_id}, {"_id": 0})
    if not q:
        return None
    follows = False
    if q.get("user_id") != viewer.get("user_id") and q.get("visibility") == "followers" and not q.get("is_public"):
        follows = await db.follows.find_one({"follower_id": viewer["user_id"], "followed_id": q["user_id"]}) is not None
    return q if quote_visible(q, viewer, follows) else None
