"""Journal de lecture — cœur de la V1 « compagnon quotidien de lecture ».

Collections :
  journal_entries  : entry_id, user_id, book_id, client_id (idempotence hors ligne), date (YYYY-MM-DD), page, chapter,
                     content, mood (1..5), quote_ids, prompt_id, prompt_text, is_public, created_at, updated_at
  journal_prompts  : prompt_id, text_fr, category, active, order, created_at   (administrables sans redéploiement)
  quotes           : champ optionnel journal_entry_id (une citation rattachée à une entrée)

Règles :
  - privé par défaut ; une entrée publiée (is_public) est visible sur le profil public de son autrice ;
  - chaque entrée compte comme une activité de lecture (série de jours) ; une page atteinte fait avancer le livre ;
  - gratuit : FREE_WEEKLY_ENTRIES entrées par semaine (lundi → dimanche) ; Premium : illimité ;
  - les prompts tournent : jamais deux fois le même d'affilée, ordre stable par utilisatrice.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from deps import db, get_current_user, now_utc, new_id
import reading
from reading import compute_streak  # noqa: F401  (réexporté pour les tests et l'accueil)

logger = logging.getLogger("journal")
router = APIRouter(prefix="/api/journal")
admin_router = APIRouter(prefix="/api/journal/admin")

FREE_WEEKLY_ENTRIES = 3
FREE_BOOKS_IN_PROGRESS = 1

# Échelle d'humeur : cinq niveaux, un mot et une couleur de la palette (pas d'emoji, cohérent avec les filtres).
MOODS = [
    {"value": 1, "key": "lourd", "label": "Lourd", "color": "#957662"},
    {"value": 2, "key": "trouble", "label": "Troublé", "color": "#C9A98F"},
    {"value": 3, "key": "calme", "label": "Calme", "color": "#A9C4D6"},
    {"value": 4, "key": "porte", "label": "Porté", "color": "#79A3C3"},
    {"value": 5, "key": "ebloui", "label": "Ébloui", "color": "#3A2119"},
]
MOOD_BY_VALUE = {m["value"]: m for m in MOODS}

DEFAULT_PROMPTS = [
    ("Quelle phrase t’a marquée aujourd’hui ?", "phrase"),
    ("Quel personnage te ressemble le plus, et pourquoi ?", "personnage"),
    ("Que prédis-tu pour la suite ?", "suite"),
    ("Qu’est-ce que ce passage t’apprend sur toi ?", "soi"),
    ("Quelle émotion domine ta lecture d’aujourd’hui ?", "emotion"),
    ("À qui aurais-tu envie de lire ce passage à voix haute ?", "partage"),
    ("Qu’est-ce qui t’a fait ralentir, relire, t’arrêter ?", "phrase"),
    ("Si tu devais résumer ta session en trois mots ?", "resume"),
    ("Un détail que tu n’avais pas remarqué avant ?", "detail"),
    ("Qu’est-ce que l’autrice ou l’auteur cherche à te faire ressentir ici ?", "intention"),
    ("Ce livre te rappelle-t-il un moment de ta vie ?", "soi"),
    ("Qu’est-ce que tu aimerais garder de cette lecture dans un an ?", "memoire"),
]


# ------------------------------------------------------------------------------------------------ helpers purs (testés)
def week_start(d: datetime) -> datetime:
    """Lundi 00:00 UTC de la semaine de `d`."""
    d = d.astimezone(timezone.utc) if d.tzinfo else d.replace(tzinfo=timezone.utc)
    monday = (d - timedelta(days=d.weekday())).date()
    return datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc)


def quota_for(used_this_week: int, is_premium: bool) -> dict:
    limit = None if is_premium else FREE_WEEKLY_ENTRIES
    return {"used": used_this_week, "limit": limit, "remaining": None if limit is None else max(0, limit - used_this_week),
            "blocked": (not is_premium) and used_this_week >= FREE_WEEKLY_ENTRIES}


def pick_prompt(prompts: list, entries_count: int, last_prompt_id: Optional[str]) -> Optional[dict]:
    """Rotation stable : index = nombre d'entrées déjà écrites ; on saute le dernier prompt utilisé."""
    active = [p for p in prompts if p.get("active", True)]
    if not active:
        return None
    if len(active) == 1:
        return active[0]
    idx = entries_count % len(active)
    p = active[idx]
    if p.get("prompt_id") == last_prompt_id:
        p = active[(idx + 1) % len(active)]
    return p


def mood_series(entries: list) -> list:
    """Frise d'humeurs d'un livre, dans l'ordre chronologique (entrées sans humeur ignorées)."""
    pts = [{"date": e.get("date"), "mood": e.get("mood"), "page": e.get("page") or e.get("chapter"), "entry_id": e.get("entry_id")}
           for e in entries if e.get("mood")]
    return sorted(pts, key=lambda p: (p["date"] or "", p["page"] or 0))


def wrapup_summary(book: dict, entries: list, quotes: list) -> dict:
    """Fiche de fin de livre : humeurs, moments forts, citations favorites, durée. Pur, sans base."""
    series = mood_series(entries)
    moods = [p["mood"] for p in series]
    avg = round(sum(moods) / len(moods), 2) if moods else None
    dominant = MOOD_BY_VALUE.get(max(set(moods), key=moods.count)) if moods else None
    dates = sorted(e["date"] for e in entries if e.get("date"))
    started = dates[0] if dates else None
    finished = book.get("finished_at")
    finished_s = finished.strftime("%Y-%m-%d") if isinstance(finished, datetime) else (dates[-1] if dates else None)
    days = None
    if started and finished_s:
        try:
            days = max(1, (datetime.strptime(finished_s, "%Y-%m-%d") - datetime.strptime(started, "%Y-%m-%d")).days + 1)
        except ValueError:
            days = None
    # moments forts : les entrées les plus intenses (humeur extrême), puis les plus longues
    with_text = [e for e in entries if (e.get("content") or "").strip()]
    highlights = sorted(with_text, key=lambda e: (-abs((e.get("mood") or 3) - 3), -len(e.get("content") or "")))[:3]
    linked = {qid for e in entries for qid in (e.get("quote_ids") or [])}
    fav = sorted(quotes, key=lambda q: (q["quote_id"] not in linked, -(q.get("likes_count") or 0), q.get("page") or 0))[:3]
    return {
        "entries_count": len(entries),
        "days": days, "started": started, "finished": finished_s,
        "mood_avg": avg, "mood_dominant": dominant, "moods": series,
        "highlights": [{"entry_id": e["entry_id"], "date": e.get("date"), "mood": e.get("mood"), "page": e.get("page"),
                        "excerpt": (e.get("content") or "").strip()[:220]} for e in highlights],
        "favorite_quotes": [{"quote_id": q["quote_id"], "text": q.get("text"), "page": q.get("page")} for q in fav],
        "rating": book.get("rating") or 0, "review": book.get("review") or "", "lessons": book.get("lessons") or [],
        "pages": book.get("pages"), "read_count": book.get("read_count") or 0,
    }


# ------------------------------------------------------------------------------------------------ accès base
async def _is_premium(user_id: str) -> bool:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "is_premium": 1})
    return bool((u or {}).get("is_premium"))


async def _week_used(user_id: str) -> int:
    return await db.journal_entries.count_documents({"user_id": user_id, "created_at": {"$gte": week_start(now_utc())}})


async def _quota(user_id: str) -> dict:
    return quota_for(await _week_used(user_id), await _is_premium(user_id))


async def _log_event(user_id: str, pages: int = 0):
    await reading.log_event(db, user_id, pages)


async def _prompts() -> list:
    return await db.journal_prompts.find({}, {"_id": 0}).sort([("order", 1), ("created_at", 1)]).to_list(500)


async def _next_prompt(user_id: str) -> Optional[dict]:
    count = await db.journal_entries.count_documents({"user_id": user_id})
    last = await db.journal_entries.find_one({"user_id": user_id, "prompt_id": {"$ne": None}}, {"_id": 0, "prompt_id": 1},
                                             sort=[("created_at", -1)])
    p = pick_prompt(await _prompts(), count, (last or {}).get("prompt_id"))
    return {"prompt_id": p["prompt_id"], "text": p["text_fr"], "category": p.get("category")} if p else None


_BOOK_FIELDS = {"_id": 0, "book_id": 1, "title": 1, "author": 1, "cover": 1, "type": 1, "pages": 1, "chapters": 1,
                "progress_page": 1, "progress_chapter": 1, "status": 1, "updated_at": 1, "finished_at": 1, "rating": 1}


async def _books_map(user_id: str, book_ids: list) -> dict:
    if not book_ids:
        return {}
    rows = await db.books.find({"user_id": user_id, "book_id": {"$in": list(set(book_ids))}}, _BOOK_FIELDS).to_list(1000)
    return {b["book_id"]: b for b in rows}


async def _decorate(user_id: str, entries: list) -> list:
    books = await _books_map(user_id, [e["book_id"] for e in entries if e.get("book_id")])
    qids = [q for e in entries for q in (e.get("quote_ids") or [])]
    quotes = {}
    if qids:
        for q in await db.quotes.find({"quote_id": {"$in": qids}}, {"_id": 0, "quote_id": 1, "text": 1, "page": 1}).to_list(1000):
            quotes[q["quote_id"]] = q
    for e in entries:
        b = books.get(e.get("book_id")) or {}
        e["book"] = {"book_id": b.get("book_id"), "title": b.get("title"), "author": b.get("author"), "cover": b.get("cover"), "type": b.get("type")}
        e["quotes"] = [quotes[q] for q in (e.get("quote_ids") or []) if q in quotes]
        e["mood_info"] = MOOD_BY_VALUE.get(e.get("mood"))
    return entries


def _progress(book: dict) -> dict:
    wp = book.get("type") == "wattpad"
    total = book.get("chapters") if wp else book.get("pages")
    cur = book.get("progress_chapter") if wp else book.get("progress_page")
    pct = round(100 * min(cur or 0, total) / total) if total else None
    return {"current": cur or 0, "total": total, "pct": pct, "unit": "chapitre" if wp else "page"}


async def _advance_book(user_id: str, book: dict, page: Optional[int], chapter: Optional[int]) -> None:
    """Règle unique (reading.advance_book) : ne recule jamais, borne au total, « à lire » → « en cours », journalise."""
    await reading.advance_book(db, user_id, book, page, chapter)


# ------------------------------------------------------------------------------------------------ modèles
class EntryCreate(BaseModel):
    book_id: str
    client_id: Optional[str] = None      # id généré par l'app : rejouer une création hors ligne ne crée pas de doublon
    date: Optional[str] = None           # YYYY-MM-DD (date locale de la lectrice)
    page: Optional[int] = Field(None, ge=0)
    chapter: Optional[int] = Field(None, ge=0)
    content: str = Field("", max_length=8000)
    mood: Optional[int] = Field(None, ge=1, le=5)
    quote_ids: List[str] = Field(default_factory=list)
    prompt_id: Optional[str] = None
    is_public: bool = False


class EntryPatch(BaseModel):
    date: Optional[str] = None
    page: Optional[int] = Field(None, ge=0)
    chapter: Optional[int] = Field(None, ge=0)
    content: Optional[str] = Field(None, max_length=8000)
    mood: Optional[int] = Field(None, ge=1, le=5)
    quote_ids: Optional[List[str]] = None
    is_public: Optional[bool] = None


def _valid_date(s: Optional[str]) -> str:
    if not s:
        return now_utc().strftime("%Y-%m-%d")
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="bad_date")


# ------------------------------------------------------------------------------------------------ routes utilisatrice
@router.get("/moods")
async def moods():
    return {"moods": MOODS}


@router.get("/prompts")
async def prompts_active(user=Depends(get_current_user)):
    """Tous les prompts actifs (l'app en fait tourner un « Un autre » sans rappeler le serveur)."""
    rows = [p for p in await _prompts() if p.get("active", True)]
    return {"prompts": [{"prompt_id": p["prompt_id"], "text": p["text_fr"], "category": p.get("category")} for p in rows]}


@router.get("/prompts/next")
async def prompt_next(user=Depends(get_current_user)):
    return {"prompt": await _next_prompt(user["user_id"])}


@router.get("/home")
async def journal_home(user=Depends(get_current_user)):
    """Tout ce qu'il faut à l'accueil en une requête : livre en cours, dernière entrée, série, prompt, quota."""
    uid = user["user_id"]
    in_progress = await db.books.find({"user_id": uid, "status": "en_cours"}, _BOOK_FIELDS).sort([("updated_at", -1), ("created_at", -1)]).to_list(20)
    current = in_progress[0] if in_progress else None
    if current:
        current["progress"] = _progress(current)
        current["entries_count"] = await db.journal_entries.count_documents({"user_id": uid, "book_id": current["book_id"]})
    latest = await db.journal_entries.find_one({"user_id": uid}, {"_id": 0}, sort=[("created_at", -1)])
    if latest:
        await _decorate(uid, [latest])
    events = await db.reading_events.find({"user_id": uid}, {"_id": 0, "day": 1, "pages": 1}).sort("day", -1).to_list(60)
    days = {e["day"] for e in events}
    today = now_utc().date()
    week_days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    active_week = sum(1 for d in week_days if d in days)
    is_premium = await _is_premium(uid)
    return {
        "current_book": current,
        "books_in_progress": len(in_progress),
        "latest_entry": latest,
        "streak": compute_streak(days, today),
        "active_days_week": active_week,
        "entries_total": await db.journal_entries.count_documents({"user_id": uid}),
        "prompt": await _next_prompt(uid),
        "quota": quota_for(await _week_used(uid), is_premium),
        "is_premium": is_premium,
        "moods": MOODS,
    }


@router.post("/entries")
async def create_entry(body: EntryCreate, user=Depends(get_current_user)):
    uid = user["user_id"]
    if body.client_id:
        existing = await db.journal_entries.find_one({"user_id": uid, "client_id": body.client_id}, {"_id": 0})
        if existing:
            return (await _decorate(uid, [existing]))[0]
    if not body.content.strip() and not body.mood and not body.quote_ids:
        raise HTTPException(status_code=400, detail="empty_entry")
    book = await db.books.find_one({"book_id": body.book_id, "user_id": uid}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="book_not_found")
    q = await _quota(uid)
    if q["blocked"]:
        raise HTTPException(status_code=402, detail="journal_limit")
    prompt = await db.journal_prompts.find_one({"prompt_id": body.prompt_id}, {"_id": 0}) if body.prompt_id else None
    quote_ids = []
    if body.quote_ids:
        quote_ids = [q_["quote_id"] for q_ in await db.quotes.find({"quote_id": {"$in": body.quote_ids}, "user_id": uid}, {"_id": 0, "quote_id": 1}).to_list(100)]
    now = now_utc()
    doc = {
        "entry_id": new_id("je"), "user_id": uid, "book_id": body.book_id,
        "date": _valid_date(body.date), "page": body.page, "chapter": body.chapter,
        "content": body.content.strip(), "mood": body.mood, "quote_ids": quote_ids,
        "prompt_id": prompt["prompt_id"] if prompt else None, "prompt_text": prompt["text_fr"] if prompt else None,
        "is_public": body.is_public, "created_at": now, "updated_at": now,
    }
    if body.client_id:
        doc["client_id"] = body.client_id
    try:
        await db.journal_entries.insert_one(doc.copy())
    except DuplicateKeyError:  # même client_id rejoué en parallèle : on renvoie l'entrée déjà créée
        existing = await db.journal_entries.find_one({"user_id": uid, "client_id": body.client_id}, {"_id": 0})
        return (await _decorate(uid, [existing]))[0]
    if quote_ids:
        await db.quotes.update_many({"quote_id": {"$in": quote_ids}}, {"$set": {"journal_entry_id": doc["entry_id"]}})
    await _advance_book(uid, book, body.page, body.chapter)
    out = (await _decorate(uid, [doc]))[0]
    out["quota"] = quota_for(q["used"] + 1, q["limit"] is None)
    return out


@router.get("/entries")
async def list_entries(book_id: Optional[str] = None, before: Optional[str] = None, size: int = Query(30, ge=1, le=100),
                       user=Depends(get_current_user)):
    """Entrées les plus récentes d'abord ; `before` = created_at ISO de la dernière entrée reçue (pagination)."""
    flt: dict = {"user_id": user["user_id"]}
    if book_id:
        flt["book_id"] = book_id
    if before:
        try:
            flt["created_at"] = {"$lt": datetime.fromisoformat(before.replace("Z", "+00:00"))}
        except ValueError:
            pass
    rows = await db.journal_entries.find(flt, {"_id": 0}).sort("created_at", -1).to_list(size + 1)
    more = len(rows) > size
    rows = rows[:size]
    return {"entries": await _decorate(user["user_id"], rows), "has_more": more,
            "total": await db.journal_entries.count_documents({k: v for k, v in flt.items() if k != "created_at"})}


@router.get("/entries/latest")
async def latest_entry(user=Depends(get_current_user)):
    e = await db.journal_entries.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    return {"entry": (await _decorate(user["user_id"], [e]))[0] if e else None}


@router.get("/entries/{entry_id}")
async def get_entry(entry_id: str, user=Depends(get_current_user)):
    e = await db.journal_entries.find_one({"entry_id": entry_id, "user_id": user["user_id"]}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="not_found")
    return (await _decorate(user["user_id"], [e]))[0]


@router.patch("/entries/{entry_id}")
async def patch_entry(entry_id: str, body: EntryPatch, user=Depends(get_current_user)):
    uid = user["user_id"]
    e = await db.journal_entries.find_one({"entry_id": entry_id, "user_id": uid}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="not_found")
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if "date" in upd:
        upd["date"] = _valid_date(upd["date"])
    if "content" in upd:
        upd["content"] = upd["content"].strip()
    if "quote_ids" in upd:
        upd["quote_ids"] = [q["quote_id"] for q in await db.quotes.find({"quote_id": {"$in": upd["quote_ids"]}, "user_id": uid}, {"_id": 0, "quote_id": 1}).to_list(100)]
        await db.quotes.update_many({"journal_entry_id": entry_id}, {"$unset": {"journal_entry_id": ""}})
        if upd["quote_ids"]:
            await db.quotes.update_many({"quote_id": {"$in": upd["quote_ids"]}}, {"$set": {"journal_entry_id": entry_id}})
    upd["updated_at"] = now_utc()
    await db.journal_entries.update_one({"entry_id": entry_id}, {"$set": upd})
    if ("page" in upd or "chapter" in upd):
        book = await db.books.find_one({"book_id": e["book_id"], "user_id": uid}, {"_id": 0})
        if book:
            await _advance_book(uid, book, upd.get("page"), upd.get("chapter"))
    return await get_entry(entry_id, user)


@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user=Depends(get_current_user)):
    r = await db.journal_entries.delete_one({"entry_id": entry_id, "user_id": user["user_id"]})
    if r.deleted_count:
        await db.quotes.update_many({"journal_entry_id": entry_id}, {"$unset": {"journal_entry_id": ""}})
    return {"ok": True}


@router.get("/books/{book_id}")
async def book_journal(book_id: str, user=Depends(get_current_user)):
    """Frise des humeurs et entrées d'un livre (fiche livre)."""
    uid = user["user_id"]
    book = await db.books.find_one({"book_id": book_id, "user_id": uid}, _BOOK_FIELDS)
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    entries = await db.journal_entries.find({"user_id": uid, "book_id": book_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"book": {**book, "progress": _progress(book)}, "moods": mood_series(entries), "entries": await _decorate(uid, entries),
            "moods_scale": MOODS}


@router.get("/books/{book_id}/wrapup")
async def book_wrapup(book_id: str, user=Depends(get_current_user)):
    """Fiche de fin de livre. Disponible dès qu'il y a au moins une entrée ou que le livre est terminé."""
    uid = user["user_id"]
    book = await db.books.find_one({"book_id": book_id, "user_id": uid}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    entries = await db.journal_entries.find({"user_id": uid, "book_id": book_id}, {"_id": 0}).to_list(500)
    quotes = await db.quotes.find({"user_id": uid, "book_id": book_id}, {"_id": 0, "quote_id": 1, "text": 1, "page": 1, "likes_count": 1}).to_list(500)
    summary = wrapup_summary(book, entries, quotes)
    return {"book": {k: book.get(k) for k in ("book_id", "title", "author", "cover", "status", "type", "pages", "chapters")},
            "is_premium": await _is_premium(uid), "moods_scale": MOODS, **summary}


@router.get("/readers/{handle}/entries")
async def public_entries(handle: str, size: int = Query(20, ge=1, le=50), user=Depends(get_current_user)):
    """Entrées publiées d'une lectrice (profil public)."""
    u = await db.users.find_one({"handle": handle}, {"_id": 0, "user_id": 1, "profile_public": 1})
    if not u or (u.get("profile_public") is False and u["user_id"] != user["user_id"]):
        return {"entries": []}
    rows = await db.journal_entries.find({"user_id": u["user_id"], "is_public": True}, {"_id": 0}).sort("created_at", -1).to_list(size)
    return {"entries": await _decorate(u["user_id"], rows)}


@router.get("/retrospective")
async def retrospective(year: Optional[int] = None, user=Depends(get_current_user)):
    """Rétrospective annuelle (Premium) : livres terminés, pages, entrées, humeurs, auteurs de l'année.
    En gratuit : les compteurs seulement (aperçu), le détail est verrouillé."""
    uid = user["user_id"]
    now = now_utc()
    y = year or now.year
    start, end = datetime(y, 1, 1, tzinfo=timezone.utc), datetime(y + 1, 1, 1, tzinfo=timezone.utc)
    premium = await _is_premium(uid)
    books = await db.books.find({"user_id": uid, "status": "termine", "finished_at": {"$gte": start, "$lt": end}},
                                {**_BOOK_FIELDS, "author": 1, "pages": 1}).sort("finished_at", 1).to_list(500)
    entries = await db.journal_entries.find({"user_id": uid, "date": {"$gte": f"{y}-01-01", "$lte": f"{y}-12-31"}},
                                            {"_id": 0, "mood": 1, "book_id": 1, "date": 1}).to_list(10000)
    quotes_count = await db.quotes.count_documents({"user_id": uid, "created_at": {"$gte": start, "$lt": end}})
    events = await db.reading_events.find({"user_id": uid, "day": {"$gte": f"{y}-01-01", "$lte": f"{y}-12-31"}},
                                          {"_id": 0, "day": 1, "pages": 1}).to_list(400)
    days = sorted(e["day"] for e in events)
    longest, run, prev = 0, 0, None
    for d in days:
        cur = datetime.strptime(d, "%Y-%m-%d").date()
        run = run + 1 if prev and (cur - prev).days == 1 else 1
        longest = max(longest, run)
        prev = cur
    out = {
        "year": y, "is_premium": premium, "locked": not premium,
        "books_count": len(books), "entries_count": len(entries), "quotes_count": quotes_count,
        "pages_total": sum(e.get("pages", 0) for e in events), "active_days": len(days), "longest_streak": longest,
        "years": sorted({int(b["finished_at"].year) for b in await db.books.find({"user_id": uid, "status": "termine", "finished_at": {"$exists": True}}, {"_id": 0, "finished_at": 1}).to_list(2000) if isinstance(b.get("finished_at"), datetime)} | {now.year}, reverse=True),
    }
    if not premium:
        return out
    moods = [e["mood"] for e in entries if e.get("mood")]
    dist = {str(v): moods.count(v) for v in range(1, 6)}
    authors: dict = {}
    for b in books:
        for a in [x.strip() for x in (b.get("author") or "").split(",") if x.strip()]:
            authors[a] = authors.get(a, 0) + 1
    months = [0] * 12
    for e in entries:
        try:
            months[int(e["date"][5:7]) - 1] += 1
        except (ValueError, TypeError):
            pass
    best = max(books, key=lambda b: (b.get("rating") or 0, b.get("finished_at") or start), default=None)
    out.update({
        "books": [{"book_id": b["book_id"], "title": b.get("title"), "author": b.get("author"), "cover": b.get("cover"),
                   "rating": b.get("rating") or 0, "finished_at": b["finished_at"].strftime("%Y-%m-%d") if isinstance(b.get("finished_at"), datetime) else None} for b in books],
        "mood_distribution": dist,
        "mood_dominant": MOOD_BY_VALUE.get(max(set(moods), key=moods.count)) if moods else None,
        "top_authors": [{"name": a, "count": n} for a, n in sorted(authors.items(), key=lambda x: (-x[1], x[0]))[:5]],
        "months": months,
        "best_book": {"book_id": best["book_id"], "title": best.get("title"), "author": best.get("author"), "cover": best.get("cover"), "rating": best.get("rating") or 0} if best and (best.get("rating") or 0) > 0 else None,
        "moods_scale": MOODS,
    })
    return out


@router.get("/quota")
async def journal_quota(user=Depends(get_current_user)):
    return await _quota(user["user_id"])


# ------------------------------------------------------------------------------------------------ admin : prompts
class PromptBody(BaseModel):
    text_fr: str = Field(..., min_length=5, max_length=300)
    category: Optional[str] = None
    active: bool = True
    order: Optional[int] = None


@admin_router.get("/prompts")
async def admin_prompts():
    rows = await _prompts()
    usage = {r["_id"]: r["n"] for r in await db.journal_entries.aggregate(
        [{"$match": {"prompt_id": {"$ne": None}}}, {"$group": {"_id": "$prompt_id", "n": {"$sum": 1}}}]).to_list(1000)}
    for p in rows:
        p["uses"] = usage.get(p["prompt_id"], 0)
    return {"prompts": rows}


@admin_router.post("/prompts")
async def admin_prompt_create(body: PromptBody):
    n = await db.journal_prompts.count_documents({})
    doc = {"prompt_id": new_id("jp"), "text_fr": body.text_fr.strip(), "category": body.category, "active": body.active,
           "order": body.order if body.order is not None else n, "created_at": now_utc()}
    await db.journal_prompts.insert_one(doc.copy())
    return doc


@admin_router.patch("/prompts/{prompt_id}")
async def admin_prompt_patch(prompt_id: str, body: PromptBody):
    upd = {"text_fr": body.text_fr.strip(), "category": body.category, "active": body.active}
    if body.order is not None:
        upd["order"] = body.order
    r = await db.journal_prompts.update_one({"prompt_id": prompt_id}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="not_found")
    return await db.journal_prompts.find_one({"prompt_id": prompt_id}, {"_id": 0})


@admin_router.delete("/prompts/{prompt_id}")
async def admin_prompt_delete(prompt_id: str):
    await db.journal_prompts.delete_one({"prompt_id": prompt_id})
    return {"ok": True}


# ------------------------------------------------------------------------------------------------ démarrage
async def init():
    """Index + prompts initiaux (seulement si la collection est vide : l'admin garde la main ensuite)."""
    await db.journal_entries.create_index([("user_id", 1), ("created_at", -1)])
    await db.journal_entries.create_index([("user_id", 1), ("book_id", 1)])
    await db.journal_entries.create_index([("user_id", 1), ("client_id", 1)], unique=True,
                                          partialFilterExpression={"client_id": {"$type": "string"}})
    await db.journal_prompts.create_index("prompt_id", unique=True)
    if await db.journal_prompts.count_documents({}) == 0:
        now = now_utc()
        await db.journal_prompts.insert_many([
            {"prompt_id": new_id("jp"), "text_fr": text, "category": cat, "active": True, "order": i, "created_at": now}
            for i, (text, cat) in enumerate(DEFAULT_PROMPTS)])
        logger.info("journal: %s prompts initiaux insérés", len(DEFAULT_PROMPTS))
