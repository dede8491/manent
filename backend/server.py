"""
Manent — backend
FastAPI + MongoDB + Emergent LLM (Claude Sonnet 4.6 vision) + Emergent Google Auth
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, base64, re, io
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
    user = {
        "user_id": user_id,
        "email": body.email.lower(),
        "pseudo": body.pseudo,
        "handle": body.pseudo.lower().replace(" ", "_"),
        "password_hash": pw_hash,
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


# ============ Books ============
class BookCreate(BaseModel):
    type: Literal['papier', 'wattpad', 'etude']
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    wattpad_url: Optional[str] = None
    cover: Optional[str] = None
    pages: Optional[int] = None
    chapters: Optional[int] = None
    status: Literal['a_lire', 'en_cours', 'termine'] = 'a_lire'
    mode: Literal['perso', 'etudes'] = 'perso'
    level: Optional[str] = None  # scolaire
    exam_date: Optional[str] = None


class BookPatch(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    status: Optional[Literal['a_lire', 'en_cours', 'termine']] = None
    rating: Optional[int] = None
    recap: Optional[str] = None
    lessons: Optional[List[str]] = None
    progress_page: Optional[int] = None
    progress_chapter: Optional[int] = None
    exam_date: Optional[str] = None
    level: Optional[str] = None


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
        "progress_page": 0,
        "progress_chapter": 0,
        "created_at": now_utc(),
    }
    await db.books.insert_one(doc.copy())
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


@api.get("/books/search/isbn")
async def search_isbn(isbn: str):
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}")
    data = r.json() if r.status_code == 200 else {}
    items = data.get("items") or []
    if not items:
        raise HTTPException(status_code=404, detail="isbn_not_found")
    v = items[0].get("volumeInfo", {})
    return {
        "title": v.get("title"),
        "author": ", ".join(v.get("authors", []) or []),
        "isbn": isbn,
        "pages": v.get("pageCount"),
        "cover": (v.get("imageLinks") or {}).get("thumbnail", "").replace("http://", "https://"),
        "description": v.get("description"),
    }


@api.get("/books/search")
async def search_books(q: str):
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": q, "maxResults": 12},
        )
    data = r.json() if r.status_code == 200 else {}
    items = data.get("items") or []
    results = []
    for it in items:
        v = it.get("volumeInfo", {})
        results.append({
            "title": v.get("title"),
            "author": ", ".join(v.get("authors", []) or []),
            "isbn": next((i.get("identifier") for i in (v.get("industryIdentifiers") or []) if i.get("type") in ("ISBN_13", "ISBN_10")), None),
            "pages": v.get("pageCount"),
            "cover": (v.get("imageLinks") or {}).get("thumbnail", "").replace("http://", "https://"),
        })
    return {"results": results}


@api.get("/books/{book_id}")
async def get_book(book_id: str, user=Depends(get_current_user)):
    b = await db.books.find_one({"book_id": book_id, "user_id": user["user_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    b["quotes_count"] = await db.quotes.count_documents({"book_id": book_id})
    return b


@api.patch("/books/{book_id}")
async def patch_book(book_id: str, body: BookPatch, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if upd:
        await db.books.update_one({"book_id": book_id, "user_id": user["user_id"]}, {"$set": upd})
    return await get_book(book_id, user)


@api.delete("/books/{book_id}")
async def delete_book(book_id: str, user=Depends(get_current_user)):
    await db.books.delete_one({"book_id": book_id, "user_id": user["user_id"]})
    await db.quotes.delete_many({"book_id": book_id, "user_id": user["user_id"]})
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


class QuotePatch(BaseModel):
    text: Optional[str] = None
    page: Optional[int] = None
    chapter: Optional[int] = None
    note: Optional[str] = None
    themes: Optional[List[str]] = None
    is_public: Optional[bool] = None


@api.post("/quotes")
async def create_quote(body: QuoteCreate, user=Depends(get_current_user)):
    quote_id = new_id("q")
    doc = {
        "quote_id": quote_id,
        "user_id": user["user_id"],
        **body.dict(),
        "created_at": now_utc(),
    }
    await db.quotes.insert_one(doc.copy())
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


@api.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"quote_id": quote_id, "user_id": user["user_id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="not_found")
    if q.get("book_id"):
        q["book"] = await db.books.find_one({"book_id": q["book_id"]}, {"_id": 0})
    q["author"] = {"pseudo": user["pseudo"], "handle": user["handle"]}
    return q


@api.patch("/quotes/{quote_id}")
async def patch_quote(quote_id: str, body: QuotePatch, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if upd:
        await db.quotes.update_one({"quote_id": quote_id, "user_id": user["user_id"]}, {"$set": upd})
    return await get_quote(quote_id, user)


@api.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user=Depends(get_current_user)):
    await db.quotes.delete_one({"quote_id": quote_id, "user_id": user["user_id"]})
    await db.board_quotes.delete_many({"quote_id": quote_id})
    return {"ok": True}


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


# ============ Home feed (public quotes) ============
@api.get("/feed")
async def feed(theme: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {"is_public": True}
    if theme:
        q["themes"] = theme
    cur = db.quotes.find(q, {"_id": 0}).sort("created_at", -1).limit(80)
    quotes = await cur.to_list(80)
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
    logger.info("Manent backend ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
