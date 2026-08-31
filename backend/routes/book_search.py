"""Recherche de livres — Google Books + Open Library + BnF (parallèle, priorité FR)."""
import re
import asyncio
import logging
import unicodedata
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("manent")

router = APIRouter(prefix="/api")


def _valid_ean13(code: str) -> bool:
    if not re.fullmatch(r'97[89]\d{10}', code):
        return False
    digits = [int(c) for c in code]
    checksum = (10 - sum(d * (3 if i % 2 else 1) for i, d in enumerate(digits[:12])) % 10) % 10
    return checksum == digits[12]


@router.get("/books/search/isbn")
async def search_isbn(isbn: str):
    isbn = re.sub(r'[^0-9Xx]', '', isbn)
    if len(isbn) == 13 and not _valid_ean13(isbn):
        raise HTTPException(status_code=404, detail="isbn_not_found")
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}")
        data = r.json() if r.status_code == 200 else {}
        items = data.get("items") or []
        if items:
            v = items[0].get("volumeInfo", {})
            return {
                "title": v.get("title"),
                "author": ", ".join(v.get("authors", []) or []),
                "isbn": isbn,
                "pages": v.get("pageCount"),
                "year": (v.get("publishedDate") or "")[:4] or None,
                "cover": ((v.get("imageLinks") or {}).get("thumbnail", "").replace("http://", "https://") + "&zoom=1") if (v.get("imageLinks") or {}).get("thumbnail") else None,
                "description": v.get("description"),
                "source": "google",
            }
        # Repli : Open Library
        try:
            r2 = await http.get(f"https://openlibrary.org/isbn/{isbn}.json", follow_redirects=True)
            if r2.status_code == 200:
                d = r2.json()
                author = None
                a = d.get("authors") or []
                if a and a[0].get("key"):
                    try:
                        ra = await http.get(f"https://openlibrary.org{a[0]['key']}.json")
                        if ra.status_code == 200:
                            author = ra.json().get("name")
                    except Exception:
                        pass
                m = re.search(r'(\d{4})', d.get("publish_date") or "")
                return {
                    "title": d.get("title"),
                    "author": author,
                    "isbn": isbn,
                    "pages": d.get("number_of_pages"),
                    "year": m.group(1) if m else None,
                    "cover": f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false",
                    "description": None,
                    "source": "openlibrary",
                }
        except Exception:
            logger.warning("openlibrary fallback failed for %s", isbn)
        # Repli 2 : BnF (catalogue très riche en éditions françaises)
        try:
            r3 = await http.get(
                "http://catalogue.bnf.fr/api/SRU",
                params={"version": "1.2", "operation": "searchRetrieve",
                        "query": f'bib.isbn all "{isbn}"',
                        "recordSchema": "dublincore", "maximumRecords": "1"},
            )
            if r3.status_code == 200 and "<srw:record>" in r3.text:
                rec = r3.text.split("<srw:record>", 1)[1]
                tm = re.search(r'<dc:title[^>]*>([^<]+)</dc:title>', rec)
                am = re.search(r'<dc:creator[^>]*>([^<]+)</dc:creator>', rec)
                dm = re.search(r'<dc:date[^>]*>[^<]*?(\d{4})', rec)
                fm = re.search(r'<dc:format[^>]*>[^<]*?\((\d+)\s*p', rec)
                if tm:
                    title = tm.group(1).split(" / ")[0].strip()
                    title = _clean_bnf_title(title)
                    author = None
                    if am:
                        author = re.sub(r'\s*\(\d{4}-[^)]*\)\s*', ' ', am.group(1))
                        author = re.sub(r'\.\s*Auteur.*$', '', author).strip(' .,;')
                    return {
                        "title": title,
                        "author": author,
                        "isbn": isbn,
                        "pages": int(fm.group(1)) if fm else None,
                        "year": dm.group(1) if dm else None,
                        "cover": None,
                        "description": None,
                        "source": "bnf",
                    }
        except Exception:
            logger.warning("bnf isbn fallback failed for %s", isbn)
    raise HTTPException(status_code=404, detail="isbn_not_found")


def _clean_bnf_title(title: str) -> str:
    """Retire le bruit éditorial des titres BnF : mentions d'édition, « : roman », nom d'auteur résiduel."""
    title = re.sub(r'\s*\(\[?[ÉEé]d\..*$', '', title)   # "(Éd. collector) ..." / "([Éd. en gros caractères]) ..."
    title = re.sub(r'\s*:\s*roman\b.*$', '', title, flags=re.I)
    return title.strip(' :;,')


def _norm_key(title: Optional[str], author: Optional[str]) -> str:
    s = f"{title or ''}|{(author or '').split(',')[0].split()[-1] if author else ''}"
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9|]', '', s)


async def _search_google(http: httpx.AsyncClient, q: str) -> list:
    out = []
    try:
        r = await http.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": q, "maxResults": 8, "langRestrict": "fr"},
        )
        data = r.json() if r.status_code == 200 else {}
        for it in (data.get("items") or []):
            v = it.get("volumeInfo", {})
            out.append({
                "title": v.get("title"),
                "author": ", ".join(v.get("authors", []) or []),
                "isbn": next((i.get("identifier") for i in (v.get("industryIdentifiers") or []) if i.get("type") in ("ISBN_13", "ISBN_10")), None),
                "pages": v.get("pageCount"),
                "year": (v.get("publishedDate") or "")[:4] or None,
                "cover": ((v.get("imageLinks") or {}).get("thumbnail", "").replace("http://", "https://") + "&zoom=1") if (v.get("imageLinks") or {}).get("thumbnail") else None,
                "summary": (v.get("description") or "")[:600] or None,
                "_fr": (v.get("language") == "fr"),
            })
    except Exception:
        logger.warning("google books search failed for %s", q)
    return out


async def _search_openlibrary(http: httpx.AsyncClient, q: str) -> list:
    out = []
    try:
        r = await http.get(
            "https://openlibrary.org/search.json",
            params={"q": q, "limit": 10,
                    "fields": "title,author_name,first_publish_year,isbn,number_of_pages_median,cover_i,language"},
        )
        docs = (r.json() or {}).get("docs", []) if r.status_code == 200 else []
        for d in docs:
            isbns = d.get("isbn") or []
            isbn13 = next((x for x in isbns if len(x) == 13), isbns[0] if isbns else None)
            out.append({
                "title": d.get("title"),
                "author": ", ".join(d.get("author_name", [])[:2]),
                "isbn": isbn13,
                "pages": d.get("number_of_pages_median"),
                "year": str(d["first_publish_year"]) if d.get("first_publish_year") else None,
                "cover": f"https://covers.openlibrary.org/b/id/{d['cover_i']}-M.jpg" if d.get("cover_i") else None,
                "_fr": ("fre" in (d.get("language") or [])),
            })
    except Exception:
        logger.warning("openlibrary search failed for %s", q)
    return out


async def _search_bnf(http: httpx.AsyncClient, q: str) -> list:
    out = []
    try:
        r = await http.get(
            "http://catalogue.bnf.fr/api/SRU",
            params={"version": "1.2", "operation": "searchRetrieve",
                    "query": f'bib.title all "{q}" and bib.doctype any "a"',
                    "recordSchema": "dublincore", "maximumRecords": "6"},
        )
        if r.status_code == 200:
            records = re.split(r'<srw:record>', r.text)[1:7]
            for rec in records:
                tm = re.search(r'<dc:title[^>]*>([^<]+)</dc:title>', rec)
                am = re.search(r'<dc:creator[^>]*>([^<]+)</dc:creator>', rec)
                dm = re.search(r'<dc:date[^>]*>[^<]*?(\d{4})', rec)
                im = re.search(r'<dc:identifier[^>]*>ISBN\s*([0-9Xx-]+)', rec)
                fm = re.search(r'<dc:format[^>]*>[^<]*?\((\d+)\s*p', rec)
                if not tm:
                    continue
                title = tm.group(1).split(" / ")[0].strip()
                title = _clean_bnf_title(title)
                author = None
                if am:
                    author = re.sub(r'\s*\(\d{4}-[^)]*\)\s*', ' ', am.group(1))
                    author = re.sub(r'\.\s*(Auteur|Voix|Traducteur).*$', '', author).strip(' .,;')
                isbn = im.group(1).replace('-', '') if im else None
                out.append({
                    "title": title,
                    "author": author,
                    "isbn": isbn,
                    "pages": int(fm.group(1)) if fm else None,
                    "year": dm.group(1) if dm else None,
                    "cover": f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false" if isbn else None,
                    "_fr": True,
                })
    except Exception:
        logger.warning("bnf search failed for %s", q)
    return out


async def _libraires_cover(http: httpx.AsyncClient, title: str, author: str = "") -> str | None:
    """Couverture de repli via la librairie partenaire (leslibraires.fr)."""
    try:
        r = await http.get("https://www.leslibraires.fr/recherche/",
                           params={"q": f"{title} {author or ''}".strip()},
                           headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=8)
        if r.status_code == 200:
            m = re.search(r'itemprop="image"\s+src="(//[^"]+)"', r.text)
            if m:
                return "https:" + m.group(1)
    except Exception:
        pass
    return None


@router.get("/books/search")
async def search_books(q: str):
    # Interroge les 3 sources en parallèle, priorité aux éditions françaises, doublons retirés.
    async with httpx.AsyncClient(timeout=12) as http:
        g, ol, bnf = await asyncio.gather(
            _search_google(http, q), _search_openlibrary(http, q), _search_bnf(http, q)
        )
    merged, seen = [], set()
    ordered = (
        [x for x in g if x["_fr"]] + [x for x in bnf] + [x for x in ol if x["_fr"]]
        + [x for x in g if not x["_fr"]] + [x for x in ol if not x["_fr"]]
    )
    for x in ordered:
        if not x.get("title"):
            continue
        k = _norm_key(x["title"], x.get("author"))
        if k in seen:
            continue
        seen.add(k)
        x.pop("_fr", None)
        merged.append(x)
        if len(merged) >= 10:
            break
    # Complète les couvertures manquantes via la librairie partenaire (en parallèle)
    missing = [b for b in merged if not b.get("cover")][:6]
    if missing:
        async with httpx.AsyncClient() as http2:
            covers = await asyncio.gather(*[_libraires_cover(http2, b["title"], b.get("author") or "") for b in missing])
        for b, c in zip(missing, covers):
            if c:
                b["cover"] = c
    return {"results": merged}
