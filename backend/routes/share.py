"""Partage universel (chantier 7) — pages « Rejoindre Manent » avec Open Graph.

Formats servis par le backend : /api/s/q/{quote_id}, /api/s/b/{catalog_id},
/api/s/u/{handle}, /api/s/c/{code}. Les liens partagés pointent vers
PUBLIC_BASE_URL + routes app (/q/…, /b/…, /@handle, /c/…) que l'app web rend
directement ; ces pages HTML servent d'aperçu riche (OG) et de repli.
Seul le contenu PUBLIC est montré. Aucune URL en dur : PUBLIC_BASE_URL.
"""
import os
import html
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/api/s")
db = None  # injecté par server.py

PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")


def _page(title: str, desc: str, image: str | None, target: str) -> str:
    t, d = html.escape(title[:120]), html.escape((desc or "")[:220])
    img = f'<meta property="og:image" content="{html.escape(image)}"/>' if image else ""
    url = f"{PUBLIC_BASE_URL}{target}"
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{t} — Manent</title>
<meta property="og:title" content="{t}"/><meta property="og:description" content="{d}"/>
<meta property="og:site_name" content="Manent"/><meta property="og:url" content="{url}"/>{img}
<style>body{{margin:0;font-family:Georgia,serif;background:#D2E2EC;color:#3A2119;display:flex;min-height:100vh;align-items:center;justify-content:center}}
.card{{background:#F5EDE4;border-radius:16px;padding:32px;max-width:420px;text-align:center;margin:16px}}
img{{max-width:140px;border-radius:8px}}h1{{font-style:italic;font-weight:500}}p{{font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;opacity:.85}}
a.btn{{display:block;background:#79A3C3;color:#F5EDE4;text-decoration:none;border-radius:999px;padding:14px;font-family:Helvetica,Arial,sans-serif;margin-top:16px}}
a.alt{{display:block;color:#957662;font-family:Helvetica,Arial,sans-serif;font-size:13px;margin-top:12px}}</style></head>
<body><div class="card">{f'<img src="{html.escape(image)}"/>' if image else ''}
<h1>{t}</h1><p>{d}</p>
<a class="btn" href="{url}">Rejoindre Manent</a>
<a class="alt" href="manent://{html.escape(target.lstrip('/'))}">J'ai déjà l'app</a>
</div></body></html>"""


@router.get("/q/{quote_id}", response_class=HTMLResponse)
async def share_quote(quote_id: str):
    q = await db.quotes.find_one({"quote_id": quote_id, "is_public": True, "is_hidden": {"$ne": True}}, {"_id": 0})
    if not q:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    u = await db.users.find_one({"user_id": q["user_id"]}, {"_id": 0, "pseudo": 1})
    b = await db.books.find_one({"book_id": q.get("book_id")}, {"_id": 0, "title": 1, "cover": 1}) if q.get("book_id") else None
    title = f"« {q['text'][:80]}… »" if len(q["text"]) > 80 else f"« {q['text']} »"
    desc = " — ".join(x for x in [(b or {}).get("title"), f"partagé par {(u or {}).get('pseudo', 'une lectrice')}"] if x)
    return HTMLResponse(_page(title, desc, (b or {}).get("cover"), f"/q/{quote_id}"))


@router.get("/b/{catalog_id}", response_class=HTMLResponse)
async def share_book(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not b:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    return HTMLResponse(_page(b["title"], b.get("summary") or ", ".join(b.get("authors") or []), b.get("cover"), f"/b/{catalog_id}"))


@router.get("/u/{handle}", response_class=HTMLResponse)
async def share_profile(handle: str):
    u = await db.users.find_one({"handle": handle}, {"_id": 0, "pseudo": 1, "picture": 1, "user_id": 1, "profile_public": 1})
    if not u or u.get("profile_public") is False:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    quotes = await db.quotes.find({"user_id": u["user_id"], "is_public": True, "is_hidden": {"$ne": True}},
                                  {"_id": 0, "text": 1}).sort("created_at", -1).to_list(3)
    desc = "  ·  ".join(f"« {q['text'][:60]} »" for q in quotes) or "Lectrice sur Manent."
    return HTMLResponse(_page(f"@{handle} — {u.get('pseudo', '')}", desc, u.get("picture"), f"/@{handle}"))


@router.get("/c/{code}", response_class=HTMLResponse)
async def share_club(code: str):
    c = await db.clubs.find_one({"code": code.upper()}, {"_id": 0, "name": 1, "members": 1})
    if not c:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    n = len(c.get("members", []))
    return HTMLResponse(_page(c["name"], f"{n} membre{'s' if n > 1 else ''} — on t'attend pour la prochaine lecture.", None, f"/c/{code.upper()}"))
