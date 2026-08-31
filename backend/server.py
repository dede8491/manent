"""
Manent — backend
FastAPI + MongoDB + Emergent LLM (Claude Sonnet 4.6 vision) + Emergent Google Auth
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, base64, re, io, asyncio, unicodedata
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx
from bs4 import BeautifulSoup

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'manent_db')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
SUPABASE_BUCKET = os.environ.get('SUPABASE_BUCKET', 'manent-photos')

from routes.book_search import router as book_search_router
from routes.push import router as push_router, send_push
from routes.club import router as club_router

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Manent API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("manent")


# ============ Helpers ============
def now_utc():
    return datetime.now(timezone.utc)

def new_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:16]}"

def clean_doc(d):
    if d is None:
        return None
    d.pop('_id', None)
    return d


# ============ Auth ============
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="not_authenticated")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="invalid_session")
    expires = session.get("expires_at")
    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now_utc():
            raise HTTPException(status_code=401, detail="session_expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    pseudo: str = Field(min_length=2, max_length=30)
    birthdate: Optional[str] = None  # ISO YYYY-MM-DD


def _valid_birthdate(bd: Optional[str]) -> Optional[str]:
    """Valide et normalise une date de naissance ISO. Renvoie None si invalide."""
    if not bd:
        return None
    try:
        d = datetime.strptime(bd.strip(), "%Y-%m-%d")
    except ValueError:
        return None
    if d.year < 1900 or d > datetime.now():
        return None
    return d.strftime("%Y-%m-%d")


def _is_adult(user: dict) -> bool:
    """>= 18 ans. Sans date de naissance → considéré mineur par prudence."""
    bd = user.get("birthdate")
    if not bd:
        return False
    try:
        d = datetime.strptime(bd, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return (now_utc() - d).days >= 18 * 365.25


def sensitive_filter(user: dict) -> dict:
    """Filtre Mongo excluant les contenus sensibles pour les mineurs."""
    return {} if _is_adult(user) else {"is_sensitive": {"$ne": True}}


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionExchange(BaseModel):
    session_id: str


async def create_session(user_id: str) -> dict:
    token = f"mnt_{uuid.uuid4().hex}{uuid.uuid4().hex[:16]}"
    session = {
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    }
    await db.user_sessions.insert_one(session.copy())
    return {"session_token": token}


@api.post("/auth/register")
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="email_taken")
    user_id = new_id("user")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    base_handle = body.pseudo.lower().replace(" ", "_") or "lecteur"
    handle = base_handle
    while await db.users.find_one({"handle": handle}, {"_id": 1}):
        handle = f"{base_handle}{uuid.uuid4().hex[:4]}"
    user = {
        "user_id": user_id,
        "email": body.email.lower(),
        "pseudo": body.pseudo,
        "handle": handle,
        "password_hash": pw_hash,
        "birthdate": _valid_birthdate(body.birthdate),
        "picture": None,
        "reading_mode": None,  # 'plaisir' | 'etudes' | 'both'
        "themes": [],
        "premium": False,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    sess = await create_session(user_id)
    return {"session_token": sess["session_token"], "user": clean_doc({**user, "password_hash": None})}


@api.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    sess = await create_session(user["user_id"])
    user.pop("_id", None); user.pop("password_hash", None)
    return {"session_token": sess["session_token"], "user": user}


@api.post("/auth/session")
async def emergent_session(body: SessionExchange):
    """Emergent Google Auth exchange."""
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="invalid_session_id")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("emergent auth failed")
        raise HTTPException(status_code=401, detail="auth_failed")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=401, detail="no_email")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        if picture and existing.get("picture") != picture:
            await db.users.update_one({"user_id": user_id}, {"$set": {"picture": picture}})
    else:
        user_id = new_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "pseudo": name,
            "handle": re.sub(r'[^a-z0-9_]', '', name.lower().replace(" ", "_"))[:24] or "lecteur",
            "picture": picture,
            "password_hash": None,
            "reading_mode": None,
            "themes": [],
            "premium": False,
            "created_at": now_utc(),
        })
    sess = await create_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": sess["session_token"], "user": user}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============ Users ============
class UserPatch(BaseModel):
    reading_mode: Optional[Literal['plaisir', 'etudes', 'both']] = None
    themes: Optional[List[str]] = None
    pseudo: Optional[str] = None
    picture: Optional[str] = None


@api.patch("/users/me")
async def patch_me(body: UserPatch, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": u}


THEMES = [
    "résilience", "argent", "amour", "entrepreneuriat", "foi",
    "leadership", "deuil", "confiance", "famille", "spiritualité",
    "santé", "voyage",
]


@api.get("/themes")
async def get_themes():
    return {"themes": THEMES}


@api.get("/themes/mine")
async def get_my_themes(user=Depends(get_current_user)):
    mine = await db.quotes.distinct("themes", {"user_id": user["user_id"]})
    custom = [t for t in mine if t and t not in THEMES]
    return {"themes": THEMES + sorted(custom)}


async def _attach_public_meta(quotes: list):
    for qd in quotes:
        if qd.get("book_id"):
            qd["book"] = await db.books.find_one({"book_id": qd["book_id"]}, {"_id": 0, "title": 1, "author": 1, "type": 1})
        u = await db.users.find_one({"user_id": qd["user_id"]}, {"_id": 0, "pseudo": 1, "handle": 1, "picture": 1})
        qd["author"] = u


@api.get("/themes/{theme}/page")
async def theme_page(theme: str, user=Depends(get_current_user)):
    q = {"is_public": True, "themes": theme, "is_hidden": {"$ne": True}, **sensitive_filter(user)}
    total = await db.quotes.count_documents(q)
    readers = len(await db.quotes.distinct("user_id", q))
    books = len([b for b in await db.quotes.distinct("book_id", q) if b])
    quotes = await db.quotes.find(q, {"_id": 0}).sort("created_at", -1).limit(80).to_list(80)
    await _attach_public_meta(quotes)
    # livres à découvrir pour ce thème (issus des citations publiques)
    book_ids = [b for b in await db.quotes.distinct("book_id", q) if b]
    suggestions = []
    if book_ids:
        bl = await db.books.find(
            {"book_id": {"$in": book_ids}},
            {"_id": 0, "book_id": 1, "title": 1, "author": 1, "cover": 1, "user_id": 1, "type": 1},
        ).to_list(30)
        seen = set()
        for b in bl:
            k = (b.get("title") or "").strip().lower()
            if not k or k in seen:
                continue
            seen.add(k)
            suggestions.append({
                "book_id": b["book_id"],
                "title": b["title"],
                "author": b.get("author"),
                "cover": b.get("cover"),
                "is_mine": b["user_id"] == user["user_id"],
            })
        suggestions = suggestions[:10]
    return {"theme": theme, "stats": {"quotes": total, "readers": readers, "books": books}, "quotes": quotes, "suggested_books": suggestions}


@api.get("/readers/suggestions")
async def reader_suggestions(user=Depends(get_current_user)):
    """Lecteurs aux goûts proches : thèmes partagés + activité publique, hors soi-même et déjà suivis."""
    followed = {f["followed_id"] for f in await db.follows.find(
        {"follower_id": user["user_id"]}, {"_id": 0, "followed_id": 1}).to_list(1000)}
    my_themes = set(user.get("themes") or [])
    candidates = await db.users.find(
        {"user_id": {"$ne": user["user_id"]}},
        {"_id": 0, "user_id": 1, "pseudo": 1, "handle": 1, "picture": 1, "themes": 1, "profile_public": 1},
    ).to_list(300)
    out = []
    for c in candidates:
        if c["user_id"] in followed or not c.get("handle") or c.get("profile_public") is False:
            continue
        shared = sorted(my_themes & set(c.get("themes") or []))
        pub = await db.quotes.count_documents({"user_id": c["user_id"], "is_public": True})
        if not shared and pub == 0:
            continue
        out.append({
            "pseudo": c["pseudo"], "handle": c["handle"], "picture": c.get("picture"),
            "shared_themes": shared[:3], "public_quotes": pub,
            "_score": 3 * len(shared) + min(pub, 10),
        })
    out.sort(key=lambda x: -x["_score"])
    for o in out:
        o.pop("_score")
    return {"readers": out[:10]}


@api.post("/readers/{handle}/follow")
async def toggle_follow(handle: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"handle": handle}, {"_id": 0, "user_id": 1, "pseudo": 1})
    if not target:
        raise HTTPException(status_code=404, detail="not_found")
    if target["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="self_follow")
    key = {"follower_id": user["user_id"], "followed_id": target["user_id"]}
    existing = await db.follows.find_one(key)
    if existing:
        await db.follows.delete_one(key)
        following = False
    else:
        await db.follows.insert_one({**key, "created_at": now_utc()})
        following = True
        try:
            await send_push([target["user_id"]], {
                "title": "Manent",
                "message": f"{user['pseudo']} suit maintenant tes lectures",
                "action_url": f"/reader/{user['handle']}",
            })
        except Exception as e:
            logger.warning("push follow failed (non-blocking): %s", e)
    followers = await db.follows.count_documents({"followed_id": target["user_id"]})
    return {"following": following, "followers": followers}


@api.get("/readers/{handle}")
async def public_profile(handle: str, user=Depends(get_current_user)):
    u = await db.users.find_one(
        {"handle": handle},
        {"_id": 0, "user_id": 1, "pseudo": 1, "handle": 1, "picture": 1, "created_at": 1, "profile_public": 1},
    )
    if not u:
        raise HTTPException(status_code=404, detail="not_found")
    profile_public = u.pop("profile_public", True)
    if not profile_public and u["user_id"] != user["user_id"]:
        return {"user": {"pseudo": u["pseudo"], "handle": u["handle"], "picture": u.get("picture")},
                "is_me": False, "private": True}
    vis_or = [{"is_public": True}]
    if u["user_id"] != user["user_id"]:
        if await db.follows.find_one({"follower_id": user["user_id"], "followed_id": u["user_id"]}):
            vis_or.append({"visibility": "followers"})
    q = {"user_id": u["user_id"], "$or": vis_or, "is_hidden": {"$ne": True}, **sensitive_filter(user)}
    total = await db.quotes.count_documents(q)
    books = len([b for b in await db.quotes.distinct("book_id", q) if b])
    boards = await db.boards.count_documents({"user_id": u["user_id"], "visibility": "public"})
    quotes = await db.quotes.find(q, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    await _attach_public_meta(quotes)
    uid = u.pop("user_id")
    followers = await db.follows.count_documents({"followed_id": uid})
    is_following = bool(await db.follows.find_one({"follower_id": user["user_id"], "followed_id": uid}))
    # Bibliothèque visible publiquement (titres/couvertures/statut)
    library = await db.books.find(
        {"user_id": uid},
        {"_id": 0, "book_id": 1, "title": 1, "author": 1, "cover": 1, "status": 1, "rating": 1, "fiche.summary": 1, "isbn": 1},
    ).sort("created_at", -1).limit(30).to_list(30)
    fiches = []
    for b in library:
        f = b.pop("fiche", None) or {}
        if b.get("rating") or f.get("summary"):
            fiches.append({"title": b["title"], "author": b.get("author"), "cover": b.get("cover"),
                           "rating": b.get("rating") or 0,
                           "summary": (f.get("summary") or "")[:220]})
    return {
        "user": u,
        "is_me": uid == user["user_id"],
        "private": False,
        "is_following": is_following,
        "stats": {"public_quotes": total, "books": books, "boards": boards, "followers": followers},
        "quotes": quotes,
        "library": library,
        "fiches": fiches[:10],
    }


# ============ Books ============
class BookCreate(BaseModel):
    type: Literal['papier', 'wattpad', 'etude']
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    wattpad_url: Optional[str] = None
    cover: Optional[str] = None
    pages: Optional[int] = None
    year: Optional[str] = None
    chapters: Optional[int] = None
    status: Literal['a_lire', 'en_cours', 'termine'] = 'a_lire'
    mode: Literal['perso', 'etudes'] = 'perso'
    level: Optional[str] = None  # scolaire
    exam_date: Optional[str] = None


class BookPatch(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    cover: Optional[str] = None
    pages: Optional[int] = None
    chapters: Optional[int] = None
    status: Optional[Literal['a_lire', 'en_cours', 'termine']] = None
    rating: Optional[int] = None
    recap: Optional[str] = None
    lessons: Optional[List[str]] = None
    progress_page: Optional[int] = None
    progress_chapter: Optional[int] = None
    exam_date: Optional[str] = None
    level: Optional[str] = None
    sheet: Optional[dict] = None  # fiche d'études: author_bio, characters, summary, themes


# ---- Couvertures : récupération automatique + migration ----
async def _find_cover(title: Optional[str], author: Optional[str], isbn: Optional[str]) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10) as http:
        if isbn:
            url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"
            try:
                r = await http.head(url, follow_redirects=True)
                if r.status_code == 200:
                    return url
            except Exception:
                pass
        try:
            q = f"isbn:{isbn}" if isbn else f"{title or ''} {author or ''}".strip()
            if q:
                r = await http.get("https://www.googleapis.com/books/v1/volumes", params={"q": q, "maxResults": 3})
                if r.status_code == 200:
                    for it in (r.json().get("items") or []):
                        th = (it.get("volumeInfo", {}).get("imageLinks") or {}).get("thumbnail")
                        if th:
                            return th.replace("http://", "https://") + "&zoom=1"
        except Exception:
            pass
        # Repli : recherche Open Library par titre + auteur (utile quand Google est en quota)
        try:
            if title:
                r = await http.get("https://openlibrary.org/search.json",
                                   params={"title": title, "author": author or "", "limit": 3, "fields": "cover_i"})
                if r.status_code == 200:
                    for d in (r.json().get("docs") or []):
                        if d.get("cover_i"):
                            return f"https://covers.openlibrary.org/b/id/{d['cover_i']}-L.jpg"
        except Exception:
            pass
        # Dernier repli : couverture de la librairie partenaire (leslibraires.fr)
        try:
            q = isbn or f"{title or ''} {author or ''}".strip()
            if q:
                r = await http.get("https://www.leslibraires.fr/recherche/", params={"q": q},
                                   headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
                if r.status_code == 200:
                    m = re.search(r'itemprop="image"\s+src="(//[^"]+)"', r.text)
                    if m:
                        return "https:" + m.group(1)
        except Exception:
            pass
    return None


async def _backfill_cover(book_id: str, title, author, isbn):
    try:
        c = await _find_cover(title, author, isbn)
        if c:
            await db.books.update_one({"book_id": book_id, "cover": {"$in": [None, ""]}}, {"$set": {"cover": c}})
    except Exception as e:
        logger.warning("cover backfill failed: %s", e)


async def _migrate_covers():
    """Migration ponctuelle : récupère les couvertures manquantes de toute la base."""
    if await db.meta.find_one({"key": "covers_migrated_v1"}):
        return
    books = await db.books.find(
        {"$or": [{"cover": None}, {"cover": ""}]},
        {"_id": 0, "book_id": 1, "title": 1, "author": 1, "isbn": 1},
    ).to_list(1000)
    found = 0
    for b in books:
        c = await _find_cover(b.get("title"), b.get("author"), b.get("isbn"))
        if c:
            await db.books.update_one({"book_id": b["book_id"]}, {"$set": {"cover": c}})
            found += 1
    cb_books = await db.club_books.find(
        {"$or": [{"cover": None}, {"cover": ""}]},
        {"_id": 0, "cb_id": 1, "title": 1, "author": 1, "isbn": 1},
    ).to_list(500)
    for b in cb_books:
        c = await _find_cover(b.get("title"), b.get("author"), b.get("isbn"))
        if c:
            await db.club_books.update_one({"cb_id": b["cb_id"]}, {"$set": {"cover": c}})
            found += 1
    await db.meta.insert_one({"key": "covers_migrated_v1", "at": now_utc(), "found": found})
    logger.info("cover migration done: %s covers found", found)


@api.post("/books")
async def create_book(body: BookCreate, user=Depends(get_current_user)):
    book_id = new_id("bk")
    doc = {
        "book_id": book_id,
        "user_id": user["user_id"],
        **body.dict(),
        "rating": 0,
        "recap": "",
        "lessons": [],
        "sheet": {},
        "progress_page": 0,
        "progress_chapter": 0,
        "read_count": 0,
        "created_at": now_utc(),
    }
    # Cohérence : un livre ajouté « Terminé » entre à 100 % sans passer par « En cours »
    if body.status == "termine":
        if body.type == "wattpad" and body.chapters:
            doc["progress_chapter"] = body.chapters
        elif body.pages:
            doc["progress_page"] = body.pages
        doc["finished_at"] = now_utc()
        doc["read_count"] = 1
    await db.books.insert_one(doc.copy())
    # Récupération de couverture en arrière-plan si absente
    if not doc.get("cover"):
        asyncio.create_task(_backfill_cover(book_id, doc.get("title"), doc.get("author"), doc.get("isbn")))
    return clean_doc(doc)


@api.get("/books")
async def list_books(status: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if status:
        q["status"] = status
    cur = db.books.find(q, {"_id": 0}).sort("created_at", -1)
    books = await cur.to_list(500)
    # attach quote counts
    for b in books:
        b["quotes_count"] = await db.quotes.count_documents({"book_id": b["book_id"]})
    return {"books": books}


@api.get("/books/{book_id}")
async def get_book(book_id: str, user=Depends(get_current_user)):
    b = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    b["quotes_count"] = await db.quotes.count_documents({"book_id": book_id})
    return b


def today_key():
    return now_utc().strftime("%Y-%m-%d")


async def log_reading_event(user_id: str, pages: int = 0):
    await db.reading_events.update_one(
        {"user_id": user_id, "day": today_key()},
        {"$inc": {"pages": max(0, pages), "actions": 1}},
        upsert=True,
    )


@api.patch("/books/{book_id}")
async def patch_book(book_id: str, body: BookPatch, user=Depends(get_current_user)):
    book = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    upd = {k: v for k, v in body.dict().items() if v is not None}
    is_wattpad = book.get("type") == "wattpad"
    prog_key = "progress_chapter" if is_wattpad else "progress_page"
    total = (upd.get("chapters") or book.get("chapters")) if is_wattpad else (upd.get("pages") or book.get("pages"))
    # La progression ne dépasse jamais le total
    if prog_key in upd and total:
        upd[prog_key] = max(0, min(int(total), upd[prog_key]))
    if "progress_page" in upd:
        delta = upd["progress_page"] - (book.get("progress_page") or 0)
        await log_reading_event(user["user_id"], delta)
    # Cohérence statut ↔ progression (source de vérité unique)
    new_status = upd.get("status")
    if new_status == "termine":
        if total:
            upd[prog_key] = int(total)
        if book.get("status") != "termine":
            upd["finished_at"] = now_utc()
            upd["read_count"] = (book.get("read_count") or 0) + 1
            upd["is_rereading"] = False
    elif new_status == "a_lire":
        upd[prog_key] = 0
        upd["is_rereading"] = False
    elif new_status == "en_cours" and book.get("status") == "termine":
        # Relecture : l'historique (finished_at, read_count) est conservé, on repart de 0
        upd["is_rereading"] = True
        upd.setdefault(prog_key, 0)
    if upd:
        await db.books.update_one({"book_id": book_id, "user_id": user["user_id"]}, {"$set": upd})
    return await get_book(book_id, user)


@api.get("/books/{book_id}/impact")
async def book_delete_impact(book_id: str, user=Depends(get_current_user)):
    """Ce qui sera perdu si le livre est supprimé (pour la confirmation)."""
    quote_ids = [q["quote_id"] for q in await db.quotes.find(
        {"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0, "quote_id": 1}).to_list(1000)]
    pins = await db.board_quotes.count_documents({"quote_id": {"$in": quote_ids}}) if quote_ids else 0
    clubs = await db.clubs.count_documents({"book.book_id": book_id})
    return {"quotes": len(quote_ids), "pins": pins, "clubs": clubs}


@api.delete("/books/{book_id}")
async def delete_book(book_id: str, user=Depends(get_current_user)):
    quote_ids = [q["quote_id"] for q in await db.quotes.find(
        {"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0, "quote_id": 1}).to_list(1000)]
    await db.books.delete_one({"book_id": book_id, "user_id": user["user_id"]})
    await db.quotes.delete_many({"book_id": book_id, "user_id": user["user_id"]})
    if quote_ids:
        await db.board_quotes.delete_many({"quote_id": {"$in": quote_ids}})
    # Retire la référence de lecture commune dans les cercles
    await db.clubs.update_many({"book.book_id": book_id}, {"$unset": {"book": ""}})
    return {"ok": True}


# ---- Wattpad metadata scrape ----
@api.get("/wattpad/scrape")
async def scrape_wattpad(url: str):
    if "wattpad.com" not in url:
        raise HTTPException(status_code=400, detail="invalid_url")
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as http:
            r = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(r.text, "html.parser")
        og = lambda p: (soup.find("meta", property=p) or {}).get("content") if soup.find("meta", property=p) else None
        title = og("og:title") or (soup.title.string if soup.title else "")
        cover = og("og:image")
        desc = og("og:description")
        author_tag = soup.find("meta", attrs={"name": "twitter:label1"})
        author = None
        author_data = soup.find("a", class_=re.compile("author-name|username")) if soup else None
        if author_data:
            author = author_data.get_text(strip=True)
        # chapters guess
        chap_count = None
        cm = re.search(r'"numParts":(\d+)', r.text)
        if cm:
            chap_count = int(cm.group(1))
        return {
            "title": title,
            "author": author,
            "cover": cover,
            "description": desc,
            "chapters": chap_count,
            "wattpad_url": url,
        }
    except Exception as e:
        logger.exception("wattpad scrape failed")
        raise HTTPException(status_code=500, detail="scrape_failed")


# ============ Premium (activation simulée) ============
FREE_CAPTURE_LIMIT = 10


def month_key():
    return now_utc().strftime("%Y-%m")


async def premium_status_for(user_id: str) -> dict:
    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "is_premium": 1, "premium_plan": 1, "captures_month": 1, "captures_used": 1},
    ) or {}
    mk = month_key()
    used = u.get("captures_used", 0) if u.get("captures_month") == mk else 0
    return {
        "is_premium": bool(u.get("is_premium")),
        "plan": u.get("premium_plan"),
        "captures_used": used,
        "captures_limit": FREE_CAPTURE_LIMIT,
        "month": mk,
    }


class PremiumActivate(BaseModel):
    plan: Literal['mensuel', 'annuel'] = 'mensuel'


@api.get("/premium/status")
async def premium_status(user=Depends(get_current_user)):
    return await premium_status_for(user["user_id"])


@api.post("/premium/activate")
async def premium_activate(body: PremiumActivate, user=Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"is_premium": True, "premium_plan": body.plan, "premium_since": now_utc()}},
    )
    return await premium_status_for(user["user_id"])


@api.post("/premium/deactivate")
async def premium_deactivate(user=Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"is_premium": False}, "$unset": {"premium_plan": "", "premium_since": ""}},
    )
    return await premium_status_for(user["user_id"])


# ============ Vision (Claude Sonnet 4.6) ============
class VisionBody(BaseModel):
    image_base64: str  # data URL or plain base64
    mode: Literal['transcribe', 'page_number'] = 'transcribe'


def _strip_data_url(b64: str) -> str:
    if b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64


@api.post("/vision")
async def vision(body: VisionBody, user=Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    if body.mode == 'transcribe':
        status = await premium_status_for(user["user_id"])
        if not status["is_premium"] and status["captures_used"] >= FREE_CAPTURE_LIMIT:
            raise HTTPException(status_code=402, detail="capture_limit_reached")

    if body.mode == 'page_number':
        system = (
            "Tu es un lecteur qui identifie le numéro de page visible sur une photo de livre. "
            "Ne réponds QUE par le numéro (ex: 142). Si aucun numéro n'est visible, réponds 0."
        )
        prompt = "Quel est le numéro de page visible sur cette photo ? Réponds uniquement par le nombre."
    else:
        system = (
            "Tu transcris fidèlement un extrait de livre photographié. Rends uniquement le texte "
            "de la citation, sans introduction, sans guillemets ajoutés, sans commentaire. Corrige "
            "les coupures de ligne pour rendre un texte fluide en français."
        )
        prompt = "Transcris fidèlement le passage encadré sur cette photo, en français."

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vision_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")

    raw_b64 = _strip_data_url(body.image_base64)
    img = ImageContent(image_base64=raw_b64)
    msg = UserMessage(text=prompt, file_contents=[img])
    try:
        text = await chat.send_message(msg)
    except Exception as e:
        logger.exception("vision call failed")
        raise HTTPException(status_code=500, detail=f"vision_failed: {e}")

    text = (text or "").strip()
    if body.mode == 'page_number':
        m = re.search(r'\d+', text)
        page = int(m.group(0)) if m else 0
        return {"page_number": page, "raw": text}
    # incrémente le compteur mensuel de captures IA
    mk = month_key()
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "captures_month": 1})
    if u and u.get("captures_month") == mk:
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"captures_used": 1}})
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"captures_month": mk, "captures_used": 1}})
    return {"text": text}


# ============ Quotes ============
class QuoteCreate(BaseModel):
    text: str
    book_id: Optional[str] = None
    page: Optional[int] = None
    chapter: Optional[int] = None
    note: Optional[str] = None
    themes: List[str] = []
    is_public: bool = False
    is_sensitive: bool = False
    visibility: Optional[Literal['private', 'followers', 'public']] = None


class QuotePatch(BaseModel):
    text: Optional[str] = None
    page: Optional[int] = None
    chapter: Optional[int] = None
    note: Optional[str] = None
    themes: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_sensitive: Optional[bool] = None
    is_hidden: Optional[bool] = None
    visibility: Optional[Literal['private', 'followers', 'public']] = None


class QuotesBulkBody(BaseModel):
    ids: List[str]
    action: Literal['delete', 'hide', 'show', 'public', 'private']


async def _ai_sensitivity_check(quote_id: str, text: str):
    """Filet de sécurité IA : marque is_sensitive=True si le passage est inadapté aux mineurs. Non bloquant."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"sens_{quote_id}",
            system_message=(
                "Tu classes des extraits littéraires pour la protection des mineurs. "
                "Réponds uniquement OUI si l'extrait contient du contenu sexuellement explicite, "
                "une violence graphique détaillée, ou une valorisation de drogues/automutilation/suicide. "
                "Sinon réponds NON. Les thèmes sombres traités avec pudeur restent NON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-6")
        r = await chat.send_message(UserMessage(text=text[:1500]))
        if (r or "").strip().upper().startswith("OUI"):
            await db.quotes.update_one({"quote_id": quote_id}, {"$set": {"is_sensitive": True}})
            logger.info("quote %s flagged sensitive by AI", quote_id)
    except Exception as e:
        logger.warning("sensitivity check failed (non-blocking): %s", e)


@api.post("/quotes")
async def create_quote(body: QuoteCreate, user=Depends(get_current_user)):
    quote_id = new_id("q")
    doc = {
        "quote_id": quote_id,
        "user_id": user["user_id"],
        **body.dict(),
        "created_at": now_utc(),
    }
    # Cohérence visibilité à trois niveaux
    if body.visibility:
        doc["is_public"] = body.visibility == "public"
    else:
        doc["visibility"] = "public" if body.is_public else "private"
    await db.quotes.insert_one(doc.copy())
    await log_reading_event(user["user_id"], 0)
    # Filet de sécurité IA sur les citations visibles par d'autres, non marquées sensibles
    if doc["visibility"] != "private" and not body.is_sensitive:
        asyncio.create_task(_ai_sensitivity_check(quote_id, body.text))
    # Notifier les abonnés quand une citation devient publique
    if doc["is_public"] or doc["visibility"] == "followers":
        try:
            followers = [f["follower_id"] for f in await db.follows.find(
                {"followed_id": user["user_id"]}, {"_id": 0, "follower_id": 1}).to_list(500)]
            await send_push(followers, {
                "title": user["pseudo"],
                "message": f"« {body.text.strip()[:110]} »",
                "action_url": f"/quote/{quote_id}",
            }, idempotency_key=f"quote-{quote_id}")
        except Exception as e:
            logger.warning("push new quote failed (non-blocking): %s", e)
    # auto-progress
    if body.book_id and body.page:
        book = await db.books.find_one({"book_id": body.book_id, "user_id": user["user_id"]}, {"_id": 0})
        if book and (book.get("progress_page") or 0) < body.page:
            await db.books.update_one(
                {"book_id": body.book_id, "user_id": user["user_id"]},
                {"$set": {"progress_page": body.page, "status": "en_cours" if book.get("status") == "a_lire" else book.get("status")}},
            )
    return clean_doc(doc)


@api.get("/quotes")
async def list_quotes(book_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if book_id:
        q["book_id"] = book_id
    cur = db.quotes.find(q, {"_id": 0}).sort("created_at", -1)
    quotes = await cur.to_list(500)
    # attach book info (title/author) minimal
    for qd in quotes:
        if qd.get("book_id"):
            b = await db.books.find_one({"book_id": qd["book_id"]}, {"_id": 0, "title": 1, "author": 1, "type": 1})
            qd["book"] = b
    return {"quotes": quotes}


@api.post("/quotes/bulk")
async def quotes_bulk(body: QuotesBulkBody, user=Depends(get_current_user)):
    q = {"quote_id": {"$in": body.ids}, "user_id": user["user_id"]}
    if body.action == "delete":
        await db.quotes.delete_many(q)
        await db.board_quotes.delete_many({"quote_id": {"$in": body.ids}})
    elif body.action == "hide":
        await db.quotes.update_many(q, {"$set": {"is_hidden": True}})
    elif body.action == "show":
        await db.quotes.update_many(q, {"$set": {"is_hidden": False}})
    elif body.action == "public":
        await db.quotes.update_many(q, {"$set": {"is_public": True}})
    elif body.action == "private":
        await db.quotes.update_many(q, {"$set": {"is_public": False}})
    return {"ok": True, "count": len(body.ids)}


# IMPORTANT : routes fixes déclarées AVANT /quotes/{quote_id}
@api.get("/quotes/daily")
async def daily_quote(user=Depends(get_current_user)):
    quotes = await db.quotes.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    if not quotes:
        return {"quote": None}
    idx = int(now_utc().strftime("%Y%m%d")) % len(quotes)
    q = quotes[idx]
    if q.get("book_id"):
        q["book"] = await db.books.find_one({"book_id": q["book_id"]}, {"_id": 0, "title": 1, "author": 1, "type": 1})
    return {"quote": q}


@api.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"quote_id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="not_found")
    is_owner = q["user_id"] == user["user_id"]
    if not is_owner:
        allowed = q.get("is_public")
        if not allowed and q.get("visibility") == "followers":
            allowed = await db.follows.find_one({"follower_id": user["user_id"], "followed_id": q["user_id"]}) is not None
        if not allowed or q.get("is_hidden"):
            raise HTTPException(status_code=404, detail="not_found")
    if not is_owner and q.get("is_sensitive") and not _is_adult(user):
        raise HTTPException(status_code=404, detail="not_found")
    if q.get("book_id"):
        q["book"] = await db.books.find_one({"book_id": q["book_id"]}, {"_id": 0})
    owner = await db.users.find_one({"user_id": q["user_id"]}, {"_id": 0, "pseudo": 1, "handle": 1, "picture": 1})
    q["author"] = owner or {"pseudo": "Lecteur", "handle": "lecteur"}
    q["is_owner"] = is_owner
    return q


@api.patch("/quotes/{quote_id}")
async def patch_quote(quote_id: str, body: QuotePatch, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if "visibility" in upd:
        upd["is_public"] = upd["visibility"] == "public"
    elif "is_public" in upd:
        upd["visibility"] = "public" if upd["is_public"] else "private"
    if upd:
        await db.quotes.update_one({"quote_id": quote_id, "user_id": user["user_id"]}, {"$set": upd})
        # Filet IA quand la citation devient/reste publique et non marquée sensible
        if upd.get("is_public") and not upd.get("is_sensitive"):
            q = await db.quotes.find_one({"quote_id": quote_id, "user_id": user["user_id"]}, {"_id": 0, "text": 1, "is_sensitive": 1})
            if q and not q.get("is_sensitive"):
                asyncio.create_task(_ai_sensitivity_check(quote_id, q.get("text") or ""))
    return await get_quote(quote_id, user)


@api.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user=Depends(get_current_user)):
    await db.quotes.delete_one({"quote_id": quote_id, "user_id": user["user_id"]})
    await db.board_quotes.delete_many({"quote_id": quote_id})
    return {"ok": True}


class SettingsBody(BaseModel):
    language: Optional[Literal['fr', 'en']] = None
    default_public: Optional[bool] = None
    profile_public: Optional[bool] = None
    birthdate: Optional[str] = None


@api.patch("/me/settings")
async def update_settings(body: SettingsBody, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if "birthdate" in upd:
        bd = _valid_birthdate(upd["birthdate"])
        if not bd:
            raise HTTPException(status_code=400, detail="invalid_birthdate")
        upd["birthdate"] = bd
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "language": 1, "default_public": 1, "profile_public": 1, "birthdate": 1})
    return {"language": (u or {}).get("language", "fr"), "default_public": (u or {}).get("default_public", False),
            "profile_public": (u or {}).get("profile_public", True), "birthdate": (u or {}).get("birthdate")}


@api.get("/me/export")
async def export_my_data(user=Depends(get_current_user)):
    uid = user["user_id"]
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    data = {
        "exported_at": now_utc().isoformat(),
        "user": u,
        "books": await db.books.find({"user_id": uid}, {"_id": 0}).to_list(1000),
        "quotes": await db.quotes.find({"user_id": uid}, {"_id": 0}).to_list(5000),
        "boards": await db.boards.find({"user_id": uid}, {"_id": 0}).to_list(500),
        "flashcards": await db.flashcards.find({"user_id": uid}, {"_id": 0}).to_list(2000),
        "clubs": await db.clubs.find({"members": uid}, {"_id": 0, "challenge.progress": 0}).to_list(100),
        "reading_events": await db.reading_events.find({"user_id": uid}, {"_id": 0}).to_list(1000),
    }
    return data


@api.delete("/me")
async def delete_my_account(user=Depends(get_current_user)):
    uid = user["user_id"]
    quote_ids = await db.quotes.distinct("quote_id", {"user_id": uid})
    if quote_ids:
        await db.board_quotes.delete_many({"quote_id": {"$in": quote_ids}})
    await db.quotes.delete_many({"user_id": uid})
    await db.books.delete_many({"user_id": uid})
    board_ids = await db.boards.distinct("board_id", {"user_id": uid})
    if board_ids:
        await db.board_quotes.delete_many({"board_id": {"$in": board_ids}})
    await db.boards.delete_many({"user_id": uid})
    await db.flashcards.delete_many({"user_id": uid})
    await db.reading_events.delete_many({"user_id": uid})
    # clubs : quitter proprement (transfert ou suppression si seul membre)
    clubs = await db.clubs.find({"members": uid}, {"_id": 0}).to_list(200)
    for c in clubs:
        members = [m for m in c.get("members", []) if m != uid]
        if not members:
            await db.clubs.delete_one({"club_id": c["club_id"]})
            await db.club_messages.delete_many({"club_id": c["club_id"]})
        else:
            upd = {"members": members}
            if c["owner_id"] == uid:
                upd["owner_id"] = members[0]
            await db.clubs.update_one({"club_id": c["club_id"]}, {"$set": upd})
    await db.club_messages.delete_many({"user_id": uid})
    await db.sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True, "deleted": True}


# ============ Recherche fine ============
@api.get("/search")
async def search_all(
    q: str = "",
    theme: Optional[str] = None,
    book_id: Optional[str] = None,
    scope: str = "all",
    user=Depends(get_current_user),
):
    uid = user["user_id"]
    rx = {"$regex": re.escape(q.strip()), "$options": "i"} if q.strip() else None
    out = {"quotes": [], "books": []}

    if scope in ("all", "quotes"):
        qq: dict = {"user_id": uid}
        if rx:
            qq["$or"] = [{"text": rx}, {"note": rx}]
        if theme:
            qq["themes"] = theme
        if book_id:
            qq["book_id"] = book_id
        quotes = await db.quotes.find(qq, {"_id": 0}).sort("created_at", -1).to_list(200)
        book_ids = list({x["book_id"] for x in quotes if x.get("book_id")})
        bmap = {}
        if book_ids:
            bl = await db.books.find(
                {"book_id": {"$in": book_ids}},
                {"_id": 0, "book_id": 1, "title": 1, "author": 1, "type": 1},
            ).to_list(200)
            bmap = {b["book_id"]: b for b in bl}
        for x in quotes:
            x["book"] = bmap.get(x.get("book_id"))
        out["quotes"] = quotes

    if scope in ("all", "books") and not theme and not book_id:
        bq: dict = {"user_id": uid}
        if rx:
            bq["$or"] = [{"title": rx}, {"author": rx}, {"recap": rx}]
        out["books"] = await db.books.find(bq, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Lecteurs : recherche par pseudo ou handle
    if scope in ("all", "readers") and rx and not theme and not book_id:
        users = await db.users.find(
            {"user_id": {"$ne": uid}, "$or": [{"pseudo": rx}, {"handle": rx}]},
            {"_id": 0, "user_id": 1, "pseudo": 1, "handle": 1, "picture": 1},
        ).limit(15).to_list(15)
        followed = {f["followed_id"] for f in await db.follows.find(
            {"follower_id": uid}, {"_id": 0, "followed_id": 1}).to_list(1000)}
        out["readers"] = [
            {"pseudo": x["pseudo"], "handle": x["handle"], "picture": x.get("picture"),
             "is_following": x["user_id"] in followed}
            for x in users if x.get("handle")
        ]
    else:
        out["readers"] = []

    return out


# ============ Boards ============
class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    visibility: Literal['private', 'public', 'collaborative'] = 'private'


@api.post("/boards")
async def create_board(body: BoardCreate, user=Depends(get_current_user)):
    board_id = new_id("bd")
    slug = re.sub(r'[^a-z0-9-]', '', body.name.lower().replace(" ", "-"))[:32]
    doc = {
        "board_id": board_id,
        "user_id": user["user_id"],
        "name": body.name,
        "description": body.description,
        "visibility": body.visibility,
        "share_slug": f"{slug}-{board_id[-6:]}",
        "members": [user["user_id"]],
        "created_at": now_utc(),
    }
    await db.boards.insert_one(doc.copy())
    return clean_doc(doc)


@api.get("/boards")
async def list_boards(user=Depends(get_current_user)):
    cur = db.boards.find({"members": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    boards = await cur.to_list(500)
    for b in boards:
        b["pins_count"] = await db.board_quotes.count_documents({"board_id": b["board_id"]})
        # get preview quote
        bq = await db.board_quotes.find_one({"board_id": b["board_id"]}, {"_id": 0}, sort=[("created_at", -1)])
        if bq:
            q = await db.quotes.find_one({"quote_id": bq["quote_id"]}, {"_id": 0, "text": 1})
            b["preview_quote"] = (q or {}).get("text")
    return {"boards": boards}


@api.get("/boards/{board_id}")
async def get_board(board_id: str, user=Depends(get_current_user)):
    b = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    if user["user_id"] not in b.get("members", []) and b["visibility"] == "private":
        raise HTTPException(status_code=403, detail="forbidden")
    pins = await db.board_quotes.find({"board_id": board_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    quotes = []
    for p in pins:
        q = await db.quotes.find_one({"quote_id": p["quote_id"]}, {"_id": 0})
        if q:
            if q.get("book_id"):
                q["book"] = await db.books.find_one({"book_id": q["book_id"]}, {"_id": 0, "title": 1, "author": 1, "type": 1})
            q["pinned_by"] = p.get("pinned_by")
            quotes.append(q)
    b["quotes"] = quotes
    return b


class PinBody(BaseModel):
    quote_id: str


@api.post("/boards/{board_id}/pin")
async def pin_quote(board_id: str, body: PinBody, user=Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="board_not_found")
    if user["user_id"] not in board.get("members", []):
        raise HTTPException(status_code=403, detail="forbidden")
    existing = await db.board_quotes.find_one({"board_id": board_id, "quote_id": body.quote_id}, {"_id": 0})
    if existing:
        return {"ok": True, "already_pinned": True}
    await db.board_quotes.insert_one({
        "board_id": board_id,
        "quote_id": body.quote_id,
        "pinned_by": user["user_id"],
        "created_at": now_utc(),
    })
    return {"ok": True}


@api.delete("/boards/{board_id}/pin/{quote_id}")
async def unpin(board_id: str, quote_id: str, user=Depends(get_current_user)):
    await db.board_quotes.delete_one({"board_id": board_id, "quote_id": quote_id})
    return {"ok": True}


@api.delete("/boards/{board_id}")
async def delete_board(board_id: str, user=Depends(get_current_user)):
    await db.boards.delete_one({"board_id": board_id, "user_id": user["user_id"]})
    await db.board_quotes.delete_many({"board_id": board_id})
    return {"ok": True}


# ============ Clubs de lecture ============
class ClubCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ClubPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    book: Optional[dict] = None  # {book_id?, title, author?}
    weekly_passage: Optional[dict] = None  # {text, page?, book_title?}
    challenge: Optional[dict] = None  # {title, goal_pages}


class ClubJoin(BaseModel):
    code: str


class ClubMessageBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ChallengeProgress(BaseModel):
    pages: int = Field(ge=0, le=100000)


class RecoBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: Optional[str] = None
    note: str = Field(min_length=1, max_length=500)


def _club_code():
    import random, string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def _club_or_404(club_id: str, user_id: str, member_required: bool = True) -> dict:
    club = await db.clubs.find_one({"club_id": club_id}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="not_found")
    if member_required and user_id not in club.get("members", []):
        raise HTTPException(status_code=403, detail="not_a_member")
    return club


@api.post("/clubs")
async def create_club(body: ClubCreate, user=Depends(get_current_user)):
    club_id = new_id("cl")
    code = _club_code()
    while await db.clubs.find_one({"code": code}):
        code = _club_code()
    doc = {
        "club_id": club_id,
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "code": code,
        "owner_id": user["user_id"],
        "members": [user["user_id"]],
        "book": None,
        "weekly_passage": None,
        "created_at": now_utc(),
    }
    await db.clubs.insert_one(doc.copy())
    return clean_doc(doc)


@api.get("/clubs")
async def list_clubs(user=Depends(get_current_user)):
    clubs = await db.clubs.find({"members": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for c in clubs:
        c["members_count"] = len(c.get("members", []))
        c["messages_count"] = await db.club_messages.count_documents({"club_id": c["club_id"]})
        c["is_owner"] = c["owner_id"] == user["user_id"]
        c.pop("members", None)
    return {"clubs": clubs}


@api.post("/clubs/join")
async def join_club(body: ClubJoin, user=Depends(get_current_user)):
    club = await db.clubs.find_one({"code": body.code.strip().upper()}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="unknown_code")
    if user["user_id"] not in club.get("members", []):
        await db.clubs.update_one({"club_id": club["club_id"]}, {"$addToSet": {"members": user["user_id"]}})
    return {"club_id": club["club_id"]}


@api.get("/clubs/{club_id}")
async def get_club(club_id: str, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    member_ids = club.get("members", [])
    users = await db.users.find(
        {"user_id": {"$in": member_ids}},
        {"_id": 0, "user_id": 1, "pseudo": 1, "handle": 1},
    ).to_list(200)
    club["members"] = users
    club["members_count"] = len(member_ids)
    club["is_owner"] = club["owner_id"] == user["user_id"]
    # classement du défi
    ch = club.get("challenge")
    if ch:
        umap = {u["user_id"]: u for u in users}
        progress = ch.get("progress", {})
        board = []
        for uid in member_ids:
            uinfo = umap.get(uid, {})
            pages = int(progress.get(uid, 0))
            board.append({
                "pseudo": uinfo.get("pseudo", "Lecteur"),
                "handle": uinfo.get("handle", ""),
                "pages": pages,
                "pct": min(100, round(pages / ch["goal_pages"] * 100)) if ch.get("goal_pages") else 0,
                "is_me": uid == user["user_id"],
            })
        board.sort(key=lambda x: -x["pages"])
        ch["leaderboard"] = board
        ch["my_pages"] = int(progress.get(user["user_id"], 0))
        ch.pop("progress", None)
    return club


@api.patch("/clubs/{club_id}")
async def patch_club(club_id: str, body: ClubPatch, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    if club["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="owner_only")
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if "weekly_passage" in upd:
        upd["weekly_passage"] = {**upd["weekly_passage"], "set_at": now_utc().isoformat(), "set_by": user["pseudo"]}
    if "challenge" in upd:
        ch = upd["challenge"]
        if not ch.get("title") or not ch.get("goal_pages"):
            raise HTTPException(status_code=400, detail="challenge_invalid")
        prev = club.get("challenge") or {}
        upd["challenge"] = {
            "title": str(ch["title"]).strip(),
            "goal_pages": int(ch["goal_pages"]),
            "created_at": now_utc().isoformat(),
            "progress": prev.get("progress", {}),
        }
    if upd:
        await db.clubs.update_one({"club_id": club_id}, {"$set": upd})
        try:
            others = [m for m in club.get("members", []) if m != user["user_id"]]
            if "challenge" in upd:
                await send_push(others, {
                    "title": club.get("name", "Ton club"),
                    "message": f"Nouveau défi de lecture : {upd['challenge']['title']}",
                    "action_url": f"/club/{club_id}",
                })
            elif "weekly_passage" in upd:
                await send_push(others, {
                    "title": club.get("name", "Ton club"),
                    "message": "Nouveau passage de la semaine à méditer",
                    "action_url": f"/club/{club_id}",
                })
        except Exception as e:
            logger.warning("push club update failed (non-blocking): %s", e)
    return await get_club(club_id, user)


@api.post("/clubs/{club_id}/challenge/progress")
async def challenge_progress(club_id: str, body: ChallengeProgress, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    if not club.get("challenge"):
        raise HTTPException(status_code=400, detail="no_challenge")
    await db.clubs.update_one(
        {"club_id": club_id},
        {"$set": {f"challenge.progress.{user['user_id']}": body.pages}},
    )
    await log_reading_event(user["user_id"], 0)
    return await get_club(club_id, user)


@api.post("/clubs/{club_id}/reco")
async def recommend_book(club_id: str, body: RecoBody, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    doc = {
        "message_id": new_id("cm"),
        "club_id": club_id,
        "user_id": user["user_id"],
        "is_reco": True,
        "book": {"title": body.title.strip(), "author": (body.author or "").strip() or None},
        "text": body.note.strip(),
        "created_at": now_utc(),
    }
    await db.club_messages.insert_one(doc.copy())
    try:
        others = [m for m in club.get("members", []) if m != user["user_id"]]
        await send_push(others, {
            "title": club.get("name", "Ton club"),
            "message": f"{user['pseudo']} te recommande « {body.title.strip()} »",
            "action_url": f"/club/{club_id}",
        })
    except Exception as e:
        logger.warning("push club reco failed (non-blocking): %s", e)
    doc["author"] = {"pseudo": user["pseudo"], "handle": user["handle"]}
    doc["is_me"] = True
    return clean_doc(doc)


@api.post("/clubs/{club_id}/leave")
async def leave_club(club_id: str, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    members = [m for m in club.get("members", []) if m != user["user_id"]]
    if not members:
        await db.clubs.delete_one({"club_id": club_id})
        await db.club_messages.delete_many({"club_id": club_id})
        return {"ok": True, "deleted": True}
    upd = {"members": members}
    if club["owner_id"] == user["user_id"]:
        upd["owner_id"] = members[0]
    await db.clubs.update_one({"club_id": club_id}, {"$set": upd})
    return {"ok": True}


def _compose_recap(club: dict) -> Optional[str]:
    parts = ["Récap de la semaine"]
    wp = club.get("weekly_passage")
    if wp and wp.get("text"):
        src = f" ({wp.get('book_title')}" + (f", p. {wp.get('page')}" if wp.get("page") else "") + ")" if wp.get("book_title") else (f" (p. {wp.get('page')})" if wp.get("page") else "")
        parts.append(f"Passage : « {wp['text']} »{src}")
    ch = club.get("challenge")
    if ch:
        progress = ch.get("progress", {})
        ranked = sorted(progress.items(), key=lambda kv: -int(kv[1] or 0))[:3]
        lines = [f"Défi « {ch.get('title')} » — objectif {ch.get('goal_pages')} pages :"]
        if ranked:
            for i, (uid, pages) in enumerate(ranked):
                lines.append(f"{i + 1}. {{{uid}}} — {pages} p.")
        else:
            lines.append("Personne n'a encore noté sa page. À vos livres !")
        parts.append("\n".join(lines))
    if len(parts) == 1:
        return None
    parts.append("Bonne lecture à toutes et à tous.")
    return "\n\n".join(parts)


async def _post_recap(club: dict) -> Optional[dict]:
    text = _compose_recap(club)
    if not text:
        return None
    # remplace les {user_id} par les pseudos
    uids = re.findall(r'\{([^}]+)\}', text)
    if uids:
        ul = await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "pseudo": 1}).to_list(50)
        for u in ul:
            text = text.replace("{" + u["user_id"] + "}", u["pseudo"])
    text = re.sub(r'\{[^}]+\}', 'Lecteur', text)
    doc = {
        "message_id": new_id("cm"),
        "club_id": club["club_id"],
        "user_id": "system_manent",
        "is_system": True,
        "text": text,
        "created_at": now_utc(),
    }
    await db.club_messages.insert_one(doc.copy())
    return clean_doc(doc)


@api.post("/clubs/{club_id}/recap")
async def send_recap(club_id: str, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    if club["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="owner_only")
    msg = await _post_recap(club)
    if not msg:
        raise HTTPException(status_code=400, detail="nothing_to_recap")
    week = now_utc().strftime("%G-W%V")
    await db.clubs.update_one({"club_id": club_id}, {"$set": {"last_recap_week": week}})
    return msg


@api.get("/clubs/{club_id}/messages")
async def club_messages(club_id: str, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    # récap hebdo automatique (une fois par semaine, si passage ou défi existe)
    week = now_utc().strftime("%G-W%V")
    if club.get("last_recap_week") != week and (club.get("weekly_passage") or club.get("challenge")):
        r = await db.clubs.update_one(
            {"club_id": club_id, "last_recap_week": {"$ne": week}},
            {"$set": {"last_recap_week": week}},
        )
        if r.modified_count == 1:
            await _post_recap(club)
    msgs = await db.club_messages.find({"club_id": club_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    uids = list({m["user_id"] for m in msgs if not m.get("is_system")})
    umap = {}
    if uids:
        ul = await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "pseudo": 1, "handle": 1}).to_list(200)
        umap = {u["user_id"]: u for u in ul}
    for m in msgs:
        if m.get("is_system"):
            m["author"] = {"pseudo": "Manent", "handle": "manent"}
            m["is_me"] = False
        else:
            m["author"] = umap.get(m["user_id"], {"pseudo": "Lecteur", "handle": "lecteur"})
            m["is_me"] = m["user_id"] == user["user_id"]
    return {"messages": msgs}


@api.post("/clubs/{club_id}/messages")
async def post_club_message(club_id: str, body: ClubMessageBody, user=Depends(get_current_user)):
    club = await _club_or_404(club_id, user["user_id"])
    doc = {
        "message_id": new_id("cm"),
        "club_id": club_id,
        "user_id": user["user_id"],
        "text": body.text.strip(),
        "created_at": now_utc(),
    }
    await db.club_messages.insert_one(doc.copy())
    try:
        others = [m for m in club.get("members", []) if m != user["user_id"]]
        await send_push(others, {
            "title": club.get("name", "Ton club"),
            "message": f"{user['pseudo']} : {body.text.strip()[:120]}",
            "action_url": f"/club/{club_id}",
        })
    except Exception as e:
        logger.warning("push club message failed (non-blocking): %s", e)
    doc["author"] = {"pseudo": user["pseudo"], "handle": user["handle"]}
    doc["is_me"] = True
    return clean_doc(doc)


# ============ Flashcards (répétition espacée) ============
class FlashReview(BaseModel):
    grade: Literal['again', 'hard', 'good', 'easy']


@api.post("/books/{book_id}/flashcards/generate")
async def generate_flashcards(book_id: str, user=Depends(get_current_user)):
    book = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    quotes = await db.quotes.find({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    existing = await db.flashcards.distinct("quote_id", {"book_id": book_id, "user_id": user["user_id"]})
    pending = [q for q in quotes if q["quote_id"] not in existing]
    if not pending:
        return {"created": 0}

    cards_data = []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        numbered = "\n".join(
            f"{i+1}. « {q['text'][:500]} »" + (f" (page {q['page']})" if q.get('page') else "")
            for i, q in enumerate(pending)
        )
        prompt = (
            f"Livre : {book['title']}" + (f" — {book['author']}" if book.get('author') else "") + ".\n"
            f"Voici des passages relevés par un étudiant :\n{numbered}\n\n"
            "Pour CHAQUE passage, crée une flashcard de révision : une question précise "
            "(compréhension, thème, personnage, style ou mémorisation) et sa réponse concise (2-3 phrases max). "
            "Tutoie l'étudiant. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour : "
            '[{"index": 1, "question": "...", "answer": "..."}]'
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"fc_{user['user_id']}_{uuid.uuid4().hex[:8]}",
            system_message="Tu es un professeur de lettres bienveillant qui crée des flashcards de révision en français.",
        ).with_model("anthropic", "claude-sonnet-4-6")
        raw = await chat.send_message(UserMessage(text=prompt))
        m = re.search(r'\[.*\]', raw or '', re.DOTALL)
        if m:
            import json as _json
            cards_data = _json.loads(m.group(0))
    except Exception:
        logger.exception("flashcard LLM generation failed, using fallback")

    by_index = {c.get("index"): c for c in cards_data if isinstance(c, dict)}
    created = []
    for i, q in enumerate(pending):
        c = by_index.get(i + 1) or {}
        question = (c.get("question") or "").strip() or f"À quel livre appartient ce passage, et que t'apprend-il ?\n« {q['text'][:180]}… »"
        answer = (c.get("answer") or "").strip() or (
            f"{book['title']}" + (f" — {book['author']}" if book.get('author') else "") + (f", page {q['page']}" if q.get('page') else "") + "."
        )
        doc = {
            "card_id": new_id("fc"),
            "user_id": user["user_id"],
            "book_id": book_id,
            "quote_id": q["quote_id"],
            "question": question,
            "answer": answer,
            "ease": 2.5,
            "interval": 0,
            "reps": 0,
            "due": now_utc(),
            "created_at": now_utc(),
        }
        await db.flashcards.insert_one(doc.copy())
        created.append(clean_doc(doc))
    return {"created": len(created), "cards": created}


@api.get("/flashcards")
async def list_flashcards(book_id: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {"user_id": user["user_id"]}
    if book_id:
        q["book_id"] = book_id
    cards = await db.flashcards.find(q, {"_id": 0}).sort("due", 1).to_list(500)
    now = now_utc()
    due = 0
    for c in cards:
        d = c.get("due")
        if d is not None and (d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d) <= now:
            due += 1
    return {"cards": cards, "total": len(cards), "due": due}


@api.post("/flashcards/{card_id}/review")
async def review_flashcard(card_id: str, body: FlashReview, user=Depends(get_current_user)):
    c = await db.flashcards.find_one({"card_id": card_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="not_found")
    ease = c.get("ease", 2.5)
    interval = c.get("interval", 0)
    reps = c.get("reps", 0)
    now = now_utc()
    if body.grade == 'again':
        reps, interval, ease = 0, 0, max(1.3, ease - 0.2)
        due = now + timedelta(minutes=10)
    elif body.grade == 'hard':
        interval = max(1, round(interval * 1.2)) if interval else 1
        ease = max(1.3, ease - 0.15)
        reps += 1
        due = now + timedelta(days=interval)
    elif body.grade == 'good':
        interval = 1 if reps == 0 else max(2, round(interval * ease))
        reps += 1
        due = now + timedelta(days=interval)
    else:  # easy
        interval = 2 if reps == 0 else max(3, round(interval * ease * 1.3))
        ease = ease + 0.15
        reps += 1
        due = now + timedelta(days=interval)
    upd = {"ease": ease, "interval": interval, "reps": reps, "due": due, "last_grade": body.grade, "last_reviewed": now}
    await db.flashcards.update_one({"card_id": card_id}, {"$set": upd})
    return {**c, **upd}


@api.delete("/flashcards/{card_id}")
async def delete_flashcard(card_id: str, user=Depends(get_current_user)):
    await db.flashcards.delete_one({"card_id": card_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============ Statistiques de lecture ============
@api.get("/stats/reading")
async def reading_stats(user=Depends(get_current_user)):
    events = await db.reading_events.find({"user_id": user["user_id"]}, {"_id": 0}).sort("day", -1).to_list(90)
    by_day = {e["day"]: e for e in events}
    today = now_utc().date()
    # série de jours consécutifs (tolérance : la série tient si l'activité date d'hier)
    streak = 0
    d = today
    if today.strftime("%Y-%m-%d") not in by_day:
        d = today - timedelta(days=1)
    while d.strftime("%Y-%m-%d") in by_day:
        streak += 1
        d -= timedelta(days=1)
    # 7 derniers jours
    week = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        k = day.strftime("%Y-%m-%d")
        e = by_day.get(k)
        week.append({"day": k, "label": ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"][day.weekday()], "pages": (e or {}).get("pages", 0), "active": bool(e)})
    week_pages = sum(w["pages"] for w in week)
    month_prefix = today.strftime("%Y-%m")
    active_month = len([k for k in by_day if k.startswith(month_prefix)])
    total_pages = sum(e.get("pages", 0) for e in events)
    # objectif annuel
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "yearly_goal": 1})
    year_start = datetime(today.year, 1, 1, tzinfo=timezone.utc)
    books_year = await db.books.count_documents({
        "user_id": user["user_id"], "status": "termine",
        "$or": [{"finished_at": {"$gte": year_start}}, {"finished_at": {"$exists": False}}],
    })
    return {
        "streak": streak, "week": week, "week_pages": week_pages,
        "active_days_month": active_month, "total_pages": total_pages,
        "year": today.year, "yearly_goal": (u or {}).get("yearly_goal"), "books_year": books_year,
    }


class GoalBody(BaseModel):
    yearly_goal: int = Field(ge=1, le=1000)


@api.patch("/me/goal")
async def set_goal(body: GoalBody, user=Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"yearly_goal": body.yearly_goal}})
    return {"yearly_goal": body.yearly_goal}


# ============ Badges lecteur ============
@api.get("/badges")
async def get_badges(user=Depends(get_current_user)):
    uid = user["user_id"]
    quotes_count = await db.quotes.count_documents({"user_id": uid})
    books_done = await db.books.count_documents({"user_id": uid, "status": "termine"})
    stats = await reading_stats(user)
    streak = stats["streak"]
    clubs = await db.clubs.find({"members": uid}, {"_id": 0, "challenge": 1}).to_list(100)
    challenges_done = 0
    for c in clubs:
        ch = c.get("challenge")
        if ch and int((ch.get("progress") or {}).get(uid, 0)) >= int(ch.get("goal_pages") or 10**9):
            challenges_done += 1

    def sheet_complete(s):
        s = s or {}
        return bool((s.get('author_bio') or '').strip()) and bool(s.get('characters')) and bool((s.get('summary') or '').strip()) and bool(s.get('themes'))

    etudes = await db.books.find({"user_id": uid, "type": "etude"}, {"_id": 0, "sheet": 1}).to_list(200)
    sheet_done = any(sheet_complete(b.get("sheet")) for b in etudes)

    badges = [
        {"id": "first_quote", "title": "Premiers mots", "desc": "Ta première citation capturée", "icon": "feather", "earned": quotes_count >= 1},
        {"id": "collector", "title": "Collectionneur", "desc": "10 citations gardées", "icon": "layers", "earned": quotes_count >= 10},
        {"id": "anthologist", "title": "Anthologiste", "desc": "50 citations qui restent", "icon": "archive", "earned": quotes_count >= 50},
        {"id": "streak3", "title": "Trois jours de suite", "desc": "Lire 3 jours d'affilée", "icon": "sunrise", "earned": streak >= 3},
        {"id": "streak7", "title": "Semaine habitée", "desc": "7 jours de lecture d'affilée", "icon": "sun", "earned": streak >= 7},
        {"id": "streak30", "title": "Rituel installé", "desc": "30 jours d'affilée", "icon": "award", "earned": streak >= 30},
        {"id": "first_book", "title": "Livre refermé", "desc": "Ton premier livre terminé", "icon": "book", "earned": books_done >= 1},
        {"id": "five_books", "title": "Étagère vivante", "desc": "5 livres terminés", "icon": "book-open", "earned": books_done >= 5},
        {"id": "challenge", "title": "Défi relevé", "desc": "Un défi de club atteint", "icon": "flag", "earned": challenges_done >= 1},
        {"id": "sheet", "title": "Fiche parfaite", "desc": "Une fiche d'études complétée", "icon": "check-circle", "earned": sheet_done},
    ]
    return {"badges": badges, "earned_count": sum(1 for b in badges if b["earned"])}


# ============ Fiche de lecture (carnet) ============
FICHE_FIELDS = ("genre", "publisher", "author_bio", "summary", "ideas", "passages", "takeaways", "questions", "review", "recommend")


class FichePatch(BaseModel):
    genre: Optional[str] = None
    publisher: Optional[str] = None
    author_bio: Optional[str] = None
    summary: Optional[str] = None
    ideas: Optional[List[str]] = None
    passages: Optional[List[dict]] = None   # [{text, note}]
    takeaways: Optional[List[str]] = None
    questions: Optional[List[str]] = None
    review: Optional[str] = None
    recommend: Optional[str] = None
    rating: Optional[int] = None


@api.get("/books/{book_id}/fiche")
async def get_fiche(book_id: str, user=Depends(get_current_user)):
    book = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    fiche = book.get("fiche") or {}
    # Pré-remplissage des passages depuis les citations capturées si la fiche n'en a pas encore
    if not fiche.get("passages"):
        qs = await db.quotes.find({"book_id": book_id, "user_id": user["user_id"]},
                                  {"_id": 0, "text": 1, "note": 1}).sort("created_at", 1).limit(10).to_list(10)
        fiche["passages"] = [{"text": q["text"], "note": q.get("note") or ""} for q in qs]
    return {
        "book": {k: book.get(k) for k in ("book_id", "title", "author", "cover", "pages", "year", "type", "isbn")},
        "fiche": {k: fiche.get(k) for k in FICHE_FIELDS} | {"passages": fiche.get("passages", []), "updated_at": fiche.get("updated_at")},
        "rating": book.get("rating") or 0,
    }


@api.put("/books/{book_id}/fiche")
async def save_fiche(book_id: str, body: FichePatch, user=Depends(get_current_user)):
    book = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0, "fiche": 1})
    if book is None:
        raise HTTPException(status_code=404, detail="not_found")
    patch = {k: v for k, v in body.dict().items() if v is not None and k != "rating"}
    upd: dict = {f"fiche.{k}": v for k, v in patch.items()}
    upd["fiche.updated_at"] = now_utc().isoformat()
    if body.rating is not None:
        upd["rating"] = max(0, min(5, body.rating))
    await db.books.update_one({"book_id": book_id, "user_id": user["user_id"]}, {"$set": upd})
    return {"ok": True}


@api.get("/fiches")
async def list_fiches(user=Depends(get_current_user)):
    books = await db.books.find(
        {"user_id": user["user_id"], "fiche": {"$exists": True}},
        {"_id": 0, "book_id": 1, "title": 1, "author": 1, "cover": 1, "rating": 1, "fiche.updated_at": 1, "fiche.summary": 1},
    ).to_list(300)
    out = []
    for b in books:
        f = b.pop("fiche", {}) or {}
        b["updated_at"] = f.get("updated_at")
        b["has_summary"] = bool(f.get("summary"))
        out.append(b)
    out.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return {"fiches": out}


@api.post("/books/{book_id}/fiche/autofill")
async def autofill_fiche(book_id: str, user=Depends(get_current_user)):
    """Remplit genre, éditeur, bio de l'auteur et résumé via l'IA (ne touche pas aux champs déjà remplis côté client)."""
    book = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="not_found")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import json as _json
    system = (
        "Tu es un libraire francophone érudit. On te donne un livre ; tu renvoies UNIQUEMENT un objet JSON "
        "avec ces clés : genre (ex: roman, essai, biographie…), publisher (éditeur français principal, ou null si incertain), "
        "author_bio (3-4 phrases en français : vie, parcours, œuvres majeures, contexte d'écriture de CE livre), "
        "summary (résumé en 5-8 phrases en français, sans divulgâcher la fin). "
        "Aucun texte hors du JSON. Si tu ne connais pas le livre, fais au mieux depuis le titre et l'auteur."
    )
    ident = f"« {book.get('title')} »" + (f" de {book.get('author')}" if book.get("author") else "") + (f" ({book.get('year')})" if book.get("year") else "")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"fiche_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    try:
        resp = await chat.send_message(UserMessage(text=f"Livre : {ident}. Renvoie le JSON."))
        raw = str(resp).strip()
        raw = re.sub(r'^```(?:json)?|```$', '', raw, flags=re.M).strip()
        data = _json.loads(raw)
    except Exception as e:
        logger.warning("fiche autofill failed: %s", e)
        raise HTTPException(status_code=502, detail="autofill_failed")
    out = {k: (data.get(k) or None) for k in ("genre", "publisher", "author_bio", "summary")}
    return {"suggestions": out}


@api.get("/discover/isbn/{isbn}")
async def discover_isbn(isbn: str, user=Depends(get_current_user)):
    """Découverte d'un livre par ISBN : métadonnées + communauté Manent (lecteurs, note moyenne, citations publiques)."""
    from routes.book_search import search_isbn
    meta = None
    try:
        meta = await search_isbn(isbn)
    except HTTPException:
        meta = None
    community_books = await db.books.find({"isbn": isbn}, {"_id": 0, "book_id": 1, "user_id": 1, "rating": 1, "title": 1, "author": 1, "cover": 1, "pages": 1, "year": 1}).to_list(500)
    if meta is None and community_books:
        b = community_books[0]
        meta = {"title": b.get("title"), "author": b.get("author"), "isbn": isbn, "pages": b.get("pages"), "year": b.get("year"), "cover": b.get("cover"), "source": "community"}
    if meta is None:
        raise HTTPException(status_code=404, detail="isbn_not_found")
    readers = len({b["user_id"] for b in community_books})
    ratings = [b["rating"] for b in community_books if b.get("rating")]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None
    book_ids = [b["book_id"] for b in community_books]
    quotes = []
    if book_ids:
        quotes = await db.quotes.find({"book_id": {"$in": book_ids}, "is_public": True}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
        await _attach_public_meta(quotes)
    in_library = any(b["user_id"] == user["user_id"] for b in community_books)
    return {"book": meta, "readers": readers, "avg_rating": avg_rating, "ratings_count": len(ratings), "quotes": quotes, "in_library": in_library}


# ============ Accueil vivant : découverte ============
AWARDED_SEED = [
    {"title": "Houris", "author": "Kamel Daoud", "prize": "Goncourt", "year": "2024"},
    {"title": "Veiller sur elle", "author": "Jean-Baptiste Andrea", "prize": "Goncourt", "year": "2023"},
    {"title": "Vivre vite", "author": "Brigitte Giraud", "prize": "Goncourt", "year": "2022"},
    {"title": "La plus secrète mémoire des hommes", "author": "Mohamed Mbougar Sarr", "prize": "Goncourt", "year": "2021"},
    {"title": "Les Impatientes", "author": "Djaïli Amadou Amal", "prize": "Goncourt des lycéens", "year": "2020"},
    {"title": "Les Insolents", "author": "Ann Scott", "prize": "Renaudot", "year": "2023"},
    {"title": "Performance", "author": "Simon Liberati", "prize": "Renaudot", "year": "2022"},
    {"title": "Triste tigre", "author": "Neige Sinno", "prize": "Femina", "year": "2023"},
    {"title": "Un chien à ma table", "author": "Claudie Hunzinger", "prize": "Femina", "year": "2022"},
    {"title": "Les Années", "author": "Annie Ernaux", "prize": "Nobel de littérature", "year": "2022"},
    {"title": "Paradis", "author": "Abdulrazak Gurnah", "prize": "Nobel de littérature", "year": "2021"},
    {"title": "Le Pays du passé", "author": "Georgi Gospodinov", "prize": "Booker International", "year": "2023"},
    {"title": "Une si longue lettre", "author": "Mariama Bâ", "prize": "Grand prix littéraire d'Afrique noire", "year": "1980"},
    {"title": "Les Soleils des indépendances", "author": "Ahmadou Kourouma", "prize": "Grand prix littéraire d'Afrique noire", "year": "1968"},
]


async def _seed_featured():
    """Alimente featured_collections (lauréats) avec couvertures, une seule fois."""
    if await db.meta.find_one({"key": "featured_seeded_v1"}):
        return
    for it in AWARDED_SEED:
        cover = await _find_cover(it["title"], it["author"], None)
        await db.featured_books.update_one(
            {"title": it["title"], "author": it["author"]},
            {"$set": {**it, "cover": cover}},
            upsert=True,
        )
    await db.meta.insert_one({"key": "featured_seeded_v1", "at": now_utc()})
    logger.info("featured collections seeded")


async def _cached_new_books() -> list:
    """Nouveautés FR Google Books, cache 12 h (repli silencieux si quota)."""
    cache = await db.meta.find_one({"key": "new_books_cache"}, {"_id": 0})
    if cache and (now_utc() - cache["at"].replace(tzinfo=timezone.utc)).total_seconds() < 12 * 3600:
        return cache.get("items") or []
    items = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get("https://www.googleapis.com/books/v1/volumes", params={
                "q": "subject:fiction", "orderBy": "newest", "langRestrict": "fr", "maxResults": 12,
            })
            if r.status_code == 200:
                for it in (r.json().get("items") or []):
                    v = it.get("volumeInfo", {})
                    th = (v.get("imageLinks") or {}).get("thumbnail")
                    if not v.get("title") or not th:
                        continue
                    items.append({
                        "title": v["title"],
                        "author": ", ".join(v.get("authors") or []),
                        "cover": th.replace("http://", "https://") + "&zoom=1",
                        "year": (v.get("publishedDate") or "")[:4] or None,
                        "summary": (v.get("description") or "")[:400],
                    })
    except Exception:
        pass
    if items:
        await db.meta.update_one({"key": "new_books_cache"}, {"$set": {"at": now_utc(), "items": items}}, upsert=True)
        return items
    return (cache or {}).get("items") or []


@api.get("/home/discover")
async def home_discover(user=Depends(get_current_user)):
    uid = user["user_id"]
    # Reprendre ta lecture
    resume = await db.books.find_one(
        {"user_id": uid, "status": "en_cours"}, {"_id": 0},
        sort=[("created_at", -1)],
    )
    # Livres primés
    awarded = await db.featured_books.find({"cover": {"$ne": None}}, {"_id": 0}).to_list(20)
    # Les plus lus (agrégés sur toutes les bibliothèques + citations)
    pipeline = [
        {"$group": {"_id": {"$toLower": "$title"}, "title": {"$first": "$title"}, "author": {"$first": "$author"},
                    "cover": {"$max": "$cover"}, "readers": {"$addToSet": "$user_id"}}},
        {"$project": {"_id": 0, "title": 1, "author": 1, "cover": 1, "readers_count": {"$size": "$readers"}}},
        {"$match": {"cover": {"$ne": None}}},
        {"$sort": {"readers_count": -1}},
        {"$limit": 8},
    ]
    popular = await db.books.aggregate(pipeline).to_list(8)
    # Collections thématiques : thèmes les plus épinglés + couvertures associées
    collections = []
    theme_counts = await db.quotes.aggregate([
        {"$match": {"is_public": True, "is_hidden": {"$ne": True}}},
        {"$unwind": "$themes"},
        {"$group": {"_id": "$themes", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 5},
    ]).to_list(5)
    for tc in theme_counts:
        book_ids = [b for b in await db.quotes.distinct("book_id", {"themes": tc["_id"], "is_public": True}) if b]
        covers = []
        if book_ids:
            bl = await db.books.find({"book_id": {"$in": book_ids}, "cover": {"$ne": None}},
                                     {"_id": 0, "cover": 1}).to_list(3)
            covers = [b["cover"] for b in bl]
        collections.append({"theme": tc["_id"], "quotes": tc["count"], "covers": covers})
    # Tableaux publics populaires
    boards = await db.boards.find({"visibility": "public"}, {"_id": 0, "board_id": 1, "name": 1, "user_id": 1}).to_list(50)
    for b in boards:
        b["pins"] = await db.board_quotes.count_documents({"board_id": b["board_id"]})
    boards = sorted(boards, key=lambda x: -x["pins"])[:5]
    return {
        "resume": resume,
        "awarded": awarded,
        "popular": popular,
        "new_books": await _cached_new_books(),
        "collections": collections,
        "boards": boards,
    }


# ============ Home feed (public quotes) ============
@api.get("/feed")
async def feed(theme: Optional[str] = None, user=Depends(get_current_user)):
    followed = [f["followed_id"] for f in await db.follows.find(
        {"follower_id": user["user_id"]}, {"_id": 0, "followed_id": 1}).to_list(500)]
    # Visible : public, ou réservé aux abonnés si je suis l'auteur·e
    vis_or = [{"is_public": True}]
    if followed:
        vis_or.append({"visibility": "followers", "user_id": {"$in": followed}})
    q: dict = {"$or": vis_or, "is_hidden": {"$ne": True}, **sensitive_filter(user)}
    if theme:
        q["themes"] = theme
    quotes = await db.quotes.find(q, {"_id": 0}).sort("created_at", -1).limit(80).to_list(80)
    # Les citations des lecteurs suivis remontent en tête (récentes d'abord dans chaque groupe)
    if followed:
        fset = set(followed)
        for qd in quotes:
            qd["is_followed_author"] = qd["user_id"] in fset
        quotes.sort(key=lambda x: (not x.get("is_followed_author"),))
    for qd in quotes:
        if qd.get("book_id"):
            qd["book"] = await db.books.find_one({"book_id": qd["book_id"]}, {"_id": 0, "title": 1, "author": 1, "type": 1})
        u = await db.users.find_one({"user_id": qd["user_id"]}, {"_id": 0, "pseudo": 1, "handle": 1, "picture": 1})
        qd["author"] = u
    return {"quotes": quotes}


# ============ Upload (Supabase Storage) ============
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file_too_large")
    ext = (file.filename or "img.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    key = f"{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    if not SUPABASE_URL or not SUPABASE_KEY:
        # Fallback: store as data URL locally in DB (dev only)
        b64 = base64.b64encode(data).decode()
        return {"url": f"data:{file.content_type or 'image/jpeg'};base64,{b64}", "key": key}
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": file.content_type or "image/jpeg",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.post(upload_url, headers=headers, content=data)
    if r.status_code not in (200, 201):
        logger.error("supabase upload failed: %s %s", r.status_code, r.text[:500])
        # fallback data URL
        b64 = base64.b64encode(data).decode()
        return {"url": f"data:{file.content_type or 'image/jpeg'};base64,{b64}", "key": key, "supabase_failed": True}
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{key}"
    return {"url": public_url, "key": key}


# ============ Seed demo data ============
@api.post("/dev/seed")
async def seed(user=Depends(get_current_user)):
    # Seed public quotes for the feed if empty
    existing_public = await db.quotes.count_documents({"is_public": True})
    if existing_public > 5:
        return {"ok": True, "already_seeded": True}
    demos = [
        {"title": "L'Alchimiste", "author": "Paulo Coelho", "type": "papier", "pages": 208,
         "quotes": [
            ("Quand tu veux quelque chose, tout l'univers conspire à te permettre de réaliser ton rêve.", 42, ["résilience", "confiance"]),
            ("C'est la possibilité de réaliser un rêve qui rend la vie intéressante.", 18, ["confiance"]),
         ]},
        {"title": "Une si longue lettre", "author": "Mariama Bâ", "type": "papier", "pages": 165,
         "quotes": [
            ("L'amitié a des grandeurs inconnues de l'amour.", 71, ["amour", "famille"]),
            ("Mon cœur est en fête chaque fois qu'une femme émerge de l'ombre.", 128, ["leadership", "confiance"]),
         ]},
        {"title": "Les Étoiles Perdues", "author": "@lunemauve", "type": "wattpad", "chapters": 42,
         "quotes": [
            ("Elle marchait comme si le monde lui devait des excuses.", None, ["résilience"]),
         ]},
    ]
    demo_user_id = "user_demo_manent"
    await db.users.update_one(
        {"user_id": demo_user_id},
        {"$setOnInsert": {
            "user_id": demo_user_id,
            "email": "demo@manent.app",
            "pseudo": "Léa",
            "handle": "lea",
            "password_hash": None,
            "picture": None,
            "themes": ["résilience", "amour", "leadership"],
            "premium": False,
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    for d in demos:
        book_id = new_id("bk")
        await db.books.insert_one({
            "book_id": book_id,
            "user_id": demo_user_id,
            "type": d["type"],
            "title": d["title"],
            "author": d["author"],
            "pages": d.get("pages"),
            "chapters": d.get("chapters"),
            "status": "en_cours",
            "mode": "perso",
            "cover": None,
            "rating": 4,
            "recap": "",
            "lessons": [],
            "progress_page": 0,
            "progress_chapter": 0,
            "created_at": now_utc(),
        })
        for text, page, themes in d["quotes"]:
            await db.quotes.insert_one({
                "quote_id": new_id("q"),
                "user_id": demo_user_id,
                "book_id": book_id,
                "text": text,
                "page": page if d["type"] != "wattpad" else None,
                "chapter": 12 if d["type"] == "wattpad" else None,
                "note": "",
                "themes": themes,
                "is_public": True,
                "created_at": now_utc(),
            })
    return {"ok": True}


# ============ Health & indexes ============
@api.get("/")
async def root():
    return {"ok": True, "service": "manent"}


# ---- Veilleur Wattpad : détecte les nouveaux chapitres et notifie le lecteur ----
async def _watch_wattpad():
    while True:
        try:
            books = await db.books.find(
                {"type": "wattpad", "wattpad_url": {"$nin": [None, ""]}},
                {"_id": 0, "book_id": 1, "user_id": 1, "title": 1, "chapters": 1, "wattpad_url": 1},
            ).to_list(500)
            for b in books:
                try:
                    meta = await scrape_wattpad(b["wattpad_url"])
                    ch = meta.get("chapters")
                    prev = b.get("chapters")
                    if ch and prev and ch > prev:
                        await db.books.update_one({"book_id": b["book_id"]}, {"$set": {"chapters": ch}})
                        n = ch - prev
                        try:
                            await send_push([b["user_id"]], {
                                "title": b.get("title") or "Wattpad",
                                "message": f"{n} nouveau chapitre disponible" if n == 1 else f"{n} nouveaux chapitres disponibles",
                                "action_url": f"/book/{b['book_id']}",
                            }, idempotency_key=f"wp-{b['book_id']}-{ch}")
                        except Exception as e:
                            logger.warning("push wattpad failed (non-blocking): %s", e)
                    elif ch and not prev:
                        await db.books.update_one({"book_id": b["book_id"]}, {"$set": {"chapters": ch}})
                except Exception:
                    pass
                await asyncio.sleep(2)
        except Exception as e:
            logger.warning("wattpad watcher error: %s", e)
        await asyncio.sleep(12 * 3600)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.books.create_index("user_id")
    await db.quotes.create_index("user_id")
    await db.quotes.create_index("is_public")
    await db.boards.create_index("members")
    await db.follows.create_index([("follower_id", 1), ("followed_id", 1)], unique=True)
    await db.follows.create_index("followed_id")
    asyncio.get_event_loop().create_task(_watch_wattpad())
    asyncio.get_event_loop().create_task(_migrate_covers())
    asyncio.get_event_loop().create_task(_seed_featured())
    logger.info("Manent backend ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(book_search_router)
app.include_router(push_router)
app.include_router(club_router)
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
