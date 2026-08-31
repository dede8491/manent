"""Club de lecture global — livres proposés, lectures collectives, discussions, avis."""
import logging
import re
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import db, get_current_user, now_utc, new_id
from routes.push import send_push

logger = logging.getLogger("manent")
router = APIRouter(prefix="/api/club")

CRITERIA = ["histoire", "ecriture", "personnages", "emotion"]


def _norm(title: str, author: Optional[str]) -> str:
    return re.sub(r"\W+", "", f"{title}{author or ''}".lower())


# ---------- Models ----------
class ClubBookAdd(BaseModel):
    title: str = Field(min_length=1)
    author: Optional[str] = None
    cover: Optional[str] = None
    isbn: Optional[str] = None
    pages: Optional[int] = None
    year: Optional[str] = None
    genre: Optional[str] = None
    summary: Optional[str] = None


class ProgressBody(BaseModel):
    pct: Optional[int] = Field(default=None, ge=0, le=100)
    page: Optional[int] = Field(default=None, ge=0)
    finished: Optional[bool] = None


class PostBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    spoiler: bool = False
    spoiler_chapter: Optional[str] = None


class CommentBody(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class ReviewBody(BaseModel):
    criteria: dict  # {histoire: 1-5, ecriture: 1-5, personnages: 1-5, emotion: 1-5}
    text: Optional[str] = None


class ReportBody(BaseModel):
    kind: str  # 'post' | 'comment'
    target_id: str
    reason: Optional[str] = None


# ---------- Helpers ----------
async def _book_or_404(cb_id: str) -> dict:
    b = await db.club_books.find_one({"cb_id": cb_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    return b


async def _enrich_book(b: dict, user_id: str) -> dict:
    readers = await db.club_readers.find({"cb_id": b["cb_id"]}, {"_id": 0}).to_list(1000)
    b["readers_count"] = len(readers)
    b["finished_count"] = sum(1 for r in readers if r.get("status") == "finished")
    pcts = [100 if r.get("status") == "finished" else (r.get("pct") or 0) for r in readers]
    b["collective_pct"] = round(sum(pcts) / len(pcts)) if pcts else 0
    mine = next((r for r in readers if r["user_id"] == user_id), None)
    b["is_joined"] = mine is not None
    b["my_pct"] = (100 if mine.get("status") == "finished" else mine.get("pct") or 0) if mine else 0
    b["my_status"] = mine.get("status") if mine else None
    reviews = await db.club_reviews.find({"cb_id": b["cb_id"]}, {"_id": 0, "note": 1}).to_list(1000)
    b["ratings_count"] = len(reviews)
    b["avg_rating"] = round(sum(r["note"] for r in reviews) / len(reviews), 1) if reviews else 0
    b["posts_count"] = await db.club_posts.count_documents({"cb_id": b["cb_id"]})
    return b


async def _attach_user(items: list, key: str = "user_id"):
    for it in items:
        u = await db.users.find_one({"user_id": it[key]}, {"_id": 0, "pseudo": 1, "handle": 1, "picture": 1})
        it["author"] = u or {"pseudo": "Lecteur", "handle": ""}


# ---------- Home ----------
@router.get("/home")
async def club_home(user=Depends(get_current_user)):
    books = await db.club_books.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for b in books:
        await _enrich_book(b, user["user_id"])
    posts = await db.club_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    await _attach_user(posts)
    bmap = {b["cb_id"]: b for b in books}
    for p in posts:
        bb = bmap.get(p["cb_id"])
        p["book_title"] = bb["title"] if bb else ""
        p["likes_count"] = len(p.get("likes") or [])
        p.pop("likes", None)
    return {"books": books, "active_posts": posts, "is_admin": bool(user.get("is_admin"))}


# ---------- Books ----------
@router.post("/books")
async def add_club_book(body: ClubBookAdd, user=Depends(get_current_user)):
    key = _norm(body.title, body.author)
    existing = await db.club_books.find_one({"norm_key": key}, {"_id": 0})
    if existing:
        return {**existing, "already_existed": True}
    doc = {
        "cb_id": new_id("cb"),
        **body.dict(),
        "norm_key": key,
        "added_by": user["user_id"],
        "created_at": now_utc(),
    }
    await db.club_books.insert_one(doc.copy())
    doc.pop("norm_key", None)
    return {**doc, "already_existed": False}


@router.get("/books/{cb_id}")
async def club_book_detail(cb_id: str, user=Depends(get_current_user)):
    b = await _book_or_404(cb_id)
    b.pop("norm_key", None)
    await _enrich_book(b, user["user_id"])
    readers = await db.club_readers.find({"cb_id": cb_id}, {"_id": 0}).sort("joined_at", -1).to_list(100)
    await _attach_user(readers)
    b["readers"] = [
        {"pseudo": r["author"]["pseudo"], "handle": r["author"].get("handle"), "picture": r["author"].get("picture"),
         "pct": 100 if r.get("status") == "finished" else r.get("pct") or 0, "status": r.get("status")}
        for r in readers
    ]
    adder = await db.users.find_one({"user_id": b.get("added_by")}, {"_id": 0, "pseudo": 1})
    b["added_by_pseudo"] = (adder or {}).get("pseudo")
    b["can_remove"] = bool(user.get("is_admin")) or b.get("added_by") == user["user_id"]
    return b


@router.delete("/books/{cb_id}")
async def remove_club_book(cb_id: str, user=Depends(get_current_user)):
    b = await _book_or_404(cb_id)
    if not user.get("is_admin") and b.get("added_by") != user["user_id"]:
        raise HTTPException(status_code=403, detail="forbidden")
    await db.club_books.delete_one({"cb_id": cb_id})
    await db.club_readers.delete_many({"cb_id": cb_id})
    post_ids = [p["post_id"] for p in await db.club_posts.find({"cb_id": cb_id}, {"_id": 0, "post_id": 1}).to_list(1000)]
    await db.club_posts.delete_many({"cb_id": cb_id})
    if post_ids:
        await db.club_comments.delete_many({"post_id": {"$in": post_ids}})
    await db.club_reviews.delete_many({"cb_id": cb_id})
    return {"ok": True}


# ---------- Participation ----------
@router.post("/books/{cb_id}/join")
async def join_reading(cb_id: str, user=Depends(get_current_user)):
    await _book_or_404(cb_id)
    key = {"cb_id": cb_id, "user_id": user["user_id"]}
    if not await db.club_readers.find_one(key):
        await db.club_readers.insert_one({**key, "status": "reading", "pct": 0, "page": 0, "joined_at": now_utc()})
    return {"ok": True, "joined": True}


@router.post("/books/{cb_id}/leave")
async def leave_reading(cb_id: str, user=Depends(get_current_user)):
    await db.club_readers.delete_one({"cb_id": cb_id, "user_id": user["user_id"]})
    return {"ok": True, "joined": False}


@router.patch("/books/{cb_id}/progress")
async def update_progress(cb_id: str, body: ProgressBody, user=Depends(get_current_user)):
    b = await _book_or_404(cb_id)
    key = {"cb_id": cb_id, "user_id": user["user_id"]}
    mine = await db.club_readers.find_one(key)
    if not mine:
        raise HTTPException(status_code=400, detail="not_joined")
    upd: dict = {}
    if body.finished:
        upd = {"status": "finished", "pct": 100, "finished_at": now_utc()}
    else:
        if body.pct is not None:
            upd["pct"] = body.pct
        elif body.page is not None and b.get("pages"):
            upd["pct"] = min(100, round(body.page / b["pages"] * 100))
        if body.page is not None:
            upd["page"] = body.page
        if upd.get("pct", 0) < 100:
            upd["status"] = "reading"
    if upd:
        await db.club_readers.update_one(key, {"$set": upd})
    mine = await db.club_readers.find_one(key, {"_id": 0})
    return mine


@router.get("/me/summary")
async def my_club_summary(user=Depends(get_current_user)):
    mine = await db.club_readers.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    return {
        "joined": len(mine),
        "reading": sum(1 for r in mine if r.get("status") == "reading"),
        "finished": sum(1 for r in mine if r.get("status") == "finished"),
    }


# ---------- Discussions ----------
@router.get("/books/{cb_id}/posts")
async def list_posts(cb_id: str, user=Depends(get_current_user)):
    posts = await db.club_posts.find({"cb_id": cb_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    await _attach_user(posts)
    for p in posts:
        likes = p.pop("likes", []) or []
        p["likes_count"] = len(likes)
        p["liked_by_me"] = user["user_id"] in likes
        p["comments_count"] = await db.club_comments.count_documents({"post_id": p["post_id"]})
        p["is_mine"] = p["user_id"] == user["user_id"]
    return {"posts": posts}


@router.post("/books/{cb_id}/posts")
async def create_post(cb_id: str, body: PostBody, user=Depends(get_current_user)):
    await _book_or_404(cb_id)
    doc = {
        "post_id": new_id("cp"),
        "cb_id": cb_id,
        "user_id": user["user_id"],
        "text": body.text.strip(),
        "spoiler": body.spoiler,
        "spoiler_chapter": (body.spoiler_chapter or "").strip() or None,
        "likes": [],
        "created_at": now_utc(),
    }
    await db.club_posts.insert_one(doc.copy())
    doc["likes_count"] = 0
    doc["liked_by_me"] = False
    doc["comments_count"] = 0
    doc["is_mine"] = True
    doc.pop("likes", None)
    doc["author"] = {"pseudo": user["pseudo"], "handle": user.get("handle"), "picture": user.get("picture")}
    return doc


@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    p = await db.club_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="not_found")
    likes = p.get("likes") or []
    if user["user_id"] in likes:
        await db.club_posts.update_one({"post_id": post_id}, {"$pull": {"likes": user["user_id"]}})
        return {"liked": False, "likes_count": len(likes) - 1}
    await db.club_posts.update_one({"post_id": post_id}, {"$addToSet": {"likes": user["user_id"]}})
    if p["user_id"] != user["user_id"]:
        try:
            await send_push([p["user_id"]], {
                "title": "Manent",
                "message": f"{user['pseudo']} aime ta publication du Club",
            }, idempotency_key=f"like-{post_id}-{user['user_id']}")
        except Exception as e:
            logger.warning("push like failed: %s", e)
    return {"liked": True, "likes_count": len(likes) + 1}


@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, user=Depends(get_current_user)):
    comments = await db.club_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    await _attach_user(comments)
    return {"comments": comments}


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentBody, user=Depends(get_current_user)):
    p = await db.club_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="not_found")
    doc = {
        "comment_id": new_id("cc"),
        "post_id": post_id,
        "user_id": user["user_id"],
        "text": body.text.strip(),
        "created_at": now_utc(),
    }
    await db.club_comments.insert_one(doc.copy())
    if p["user_id"] != user["user_id"]:
        try:
            await send_push([p["user_id"]], {
                "title": user["pseudo"],
                "message": f"a commenté ta publication : « {body.text.strip()[:90]} »",
            }, idempotency_key=f"comment-{doc['comment_id']}")
        except Exception as e:
            logger.warning("push comment failed: %s", e)
    doc["author"] = {"pseudo": user["pseudo"], "handle": user.get("handle"), "picture": user.get("picture")}
    return doc


@router.post("/report")
async def report_content(body: ReportBody, user=Depends(get_current_user)):
    await db.reports.insert_one({
        "report_id": new_id("rp"),
        "kind": body.kind,
        "target_id": body.target_id,
        "reason": (body.reason or "").strip() or None,
        "user_id": user["user_id"],
        "status": "open",
        "created_at": now_utc(),
    })
    return {"ok": True}


# ---------- Avis (notes multi-critères) ----------
@router.get("/books/{cb_id}/reviews")
async def list_reviews(cb_id: str, user=Depends(get_current_user)):
    reviews = await db.club_reviews.find({"cb_id": cb_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    await _attach_user(reviews)
    mine = next((r for r in reviews if r["user_id"] == user["user_id"]), None)
    avg_criteria = {}
    if reviews:
        for c in CRITERIA:
            vals = [r["criteria"].get(c) for r in reviews if (r.get("criteria") or {}).get(c)]
            avg_criteria[c] = round(sum(vals) / len(vals), 1) if vals else 0
    return {"reviews": reviews, "mine": mine, "avg_criteria": avg_criteria}


@router.post("/books/{cb_id}/reviews")
async def upsert_review(cb_id: str, body: ReviewBody, user=Depends(get_current_user)):
    await _book_or_404(cb_id)
    crit = {c: max(1, min(5, int(body.criteria.get(c) or 0))) for c in CRITERIA if body.criteria.get(c)}
    if not crit:
        raise HTTPException(status_code=400, detail="empty_review")
    note = round(sum(crit.values()) / len(crit), 1)
    doc = {
        "cb_id": cb_id,
        "user_id": user["user_id"],
        "criteria": crit,
        "note": note,
        "text": (body.text or "").strip() or None,
        "created_at": now_utc(),
    }
    await db.club_reviews.update_one(
        {"cb_id": cb_id, "user_id": user["user_id"]},
        {"$set": doc},
        upsert=True,
    )
    return doc
