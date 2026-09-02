"""Partage universel (Lot A) — pages « Rejoindre Manent » avec Open Graph.

Pages HTML servies par le backend : /api/s/q/{quote_id}, /api/s/b/{catalog_id},
/api/s/u/{handle}, /api/s/c/{code}. Les mêmes gestionnaires sont aussi montés à la
racine (/q/…, /b/…, /c/…, /@{handle}) pour le jour où le domaine pointe vers le
backend. Les fichiers .well-known sont servis dynamiquement depuis les variables
d'environnement. Seul le contenu PUBLIC est montré. Aucune URL en dur.
"""
import os
import html
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse

router = APIRouter(prefix="/api/s")
root_router = APIRouter()   # mêmes pages à la racine du domaine (si l'ingress le permet)
wk_router = APIRouter()     # .well-known dynamiques
db = None  # injecté par server.py

PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")


def _env(key: str) -> str:
    return (os.environ.get(key) or "").strip().strip('"')


def _store_buttons() -> str:
    app_store, play_store = _env("APP_STORE_URL"), _env("PLAY_STORE_URL")
    ios = (f'<a class="store" href="{html.escape(app_store)}">Télécharger sur l’App Store</a>'
           if app_store else '<span class="store soon">App Store — bientôt disponible</span>')
    android = (f'<a class="store" href="{html.escape(play_store)}">Disponible sur Google Play</a>'
               if play_store else '<span class="store soon">Google Play — bientôt disponible</span>')
    return ios + android


def _page(title: str, desc: str, image: str | None, target: str, extra: str = "", open_label: str = "Ouvrir dans l’application") -> str:
    t, d = html.escape(title[:120]), html.escape((desc or "")[:220])
    img_meta = (f'<meta property="og:image" content="{html.escape(image)}"/>'
                f'<meta name="twitter:image" content="{html.escape(image)}"/>') if image else ""
    card = "summary_large_image" if image else "summary"
    url = f"{PUBLIC_BASE_URL}{target}"
    scheme = f"manent://{html.escape(target.lstrip('/'))}"
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{t} — Manent</title>
<meta name="theme-color" content="#3A2119"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{t}"/><meta property="og:description" content="{d}"/>
<meta property="og:site_name" content="Manent"/><meta property="og:url" content="{html.escape(url)}"/>{img_meta}
<meta name="twitter:card" content="{card}"/>
<meta name="twitter:title" content="{t}"/><meta name="twitter:description" content="{d}"/>
<style>
body{{margin:0;font-family:Georgia,'Times New Roman',serif;background:#D2E2EC;color:#3A2119;display:flex;min-height:100vh;align-items:center;justify-content:center}}
.card{{background:#F5EDE4;border-radius:18px;padding:36px 28px;max-width:420px;text-align:center;margin:16px;box-shadow:0 8px 30px rgba(58,33,25,.08)}}
.mark{{font-style:italic;font-weight:500;font-size:26px;letter-spacing:.5px;margin-bottom:4px}}
.base{{font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#957662;margin-bottom:22px}}
img.cover{{max-width:130px;border-radius:8px;box-shadow:0 4px 16px rgba(58,33,25,.18)}}
h1{{font-style:italic;font-weight:500;font-size:22px;line-height:1.35;margin:18px 0 8px}}
p{{font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;opacity:.85;margin:0 0 20px}}
a.btn{{display:block;background:#79A3C3;color:#F5EDE4;text-decoration:none;border-radius:999px;padding:14px;font-family:Helvetica,Arial,sans-serif;font-size:14px}}
.store{{display:block;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:#3A2119;background:#EBCDB7;border-radius:999px;padding:11px;margin-top:10px;text-decoration:none}}
.store.soon{{opacity:.55}}
a.alt{{display:block;color:#957662;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;margin-top:16px;text-decoration:none}}
.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 18px}}
.grid img{{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6px;box-shadow:0 3px 10px rgba(58,33,25,.15)}}
.grid .ph{{aspect-ratio:2/3;border-radius:6px;background:#EBCDB7;display:flex;align-items:center;justify-content:center;font-style:italic;font-size:22px}}
.avatar{{width:84px;height:84px;border-radius:50%;object-fit:cover;box-shadow:0 4px 16px rgba(58,33,25,.18)}}
blockquote{{font-style:italic;font-size:14px;line-height:1.45;margin:0 0 10px;color:#3A2119}}
</style></head>
<body><div class="card">
<div class="mark">Manent</div><div class="base">verba volant, scripta manent</div>
{f'<img class="cover" src="{html.escape(image)}" alt=""/>' if image else ''}
<h1>{t}</h1><p>{d}</p>
{extra}
<a class="btn" href="{scheme}">{open_label}</a>
{_store_buttons()}
<a class="alt" href="{html.escape(url)}">Rejoindre Manent — ce que tes lectures te laissent</a>
</div></body></html>"""


async def _quote_page(quote_id: str):
    q = await db.quotes.find_one({"quote_id": quote_id, "is_public": True, "is_hidden": {"$ne": True}}, {"_id": 0})
    if not q:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    u = await db.users.find_one({"user_id": q["user_id"]}, {"_id": 0, "pseudo": 1})
    b = await db.books.find_one({"book_id": q.get("book_id")}, {"_id": 0, "title": 1, "cover": 1}) if q.get("book_id") else None
    title = f"« {q['text'][:80]}… »" if len(q["text"]) > 80 else f"« {q['text']} »"
    desc = " — ".join(x for x in [(b or {}).get("title"), f"partagé par {(u or {}).get('pseudo', 'une lectrice')}"] if x)
    return HTMLResponse(_page(title, desc, (b or {}).get("cover"), f"/q/{quote_id}"))


async def _book_page(catalog_id: str):
    b = await db.catalog_books.find_one({"catalog_id": catalog_id}, {"_id": 0})
    if not b:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    return HTMLResponse(_page(b["title"], b.get("summary") or ", ".join(b.get("authors") or []), b.get("cover"), f"/b/{catalog_id}"))


async def _profile_page(handle: str):
    handle = handle.lstrip("@")
    u = await db.users.find_one({"handle": handle}, {"_id": 0, "pseudo": 1, "picture": 1, "user_id": 1, "profile_public": 1})
    if not u or u.get("profile_public") is False:
        return HTMLResponse(_page("Manent", "Ce contenu est réservé aux membres.", None, "/"))
    quotes = await db.quotes.find({"user_id": u["user_id"], "is_public": True, "is_hidden": {"$ne": True}},
                                  {"_id": 0, "text": 1}).sort("created_at", -1).to_list(3)
    followers = await db.follows.count_documents({"followed_id": u["user_id"]})
    desc = f"{followers} abonné{'s' if followers > 1 else ''} sur Manent" if followers else "Lectrice sur Manent."
    pic = u.get("picture")
    if pic and pic.startswith("data:"):
        pic = None
    extra = "".join(f"<blockquote>« {html.escape(q['text'][:140])} »</blockquote>" for q in quotes)
    # Le bouton Suivre ouvre l'app (ou l'inscription) puis suit automatiquement (follow=1)
    page = _page(f"{u.get('pseudo', '')} · @{handle}", desc, pic, f"/@{handle}", extra=extra, open_label=f"Suivre @{html.escape(handle)}")
    page = page.replace(f'href="manent://@{html.escape(handle)}"', f'href="manent://@{html.escape(handle)}?follow=1"')
    return HTMLResponse(page)


async def _library_page(handle: str):
    """Bibliothèque publique d'une lectrice : mosaïque de couvertures + Rejoindre."""
    handle = handle.lstrip("@")
    u = await db.users.find_one({"handle": handle}, {"_id": 0, "pseudo": 1, "user_id": 1, "profile_public": 1})
    if not u or u.get("profile_public") is False:
        return HTMLResponse(_page("Manent", "Ce contenu est réservé aux membres.", None, "/"))
    books = await db.books.find({"user_id": u["user_id"], "type": {"$ne": "etude"}},
                                {"_id": 0, "title": 1, "cover": 1}).sort("created_at", -1).to_list(12)
    total = await db.books.count_documents({"user_id": u["user_id"], "type": {"$ne": "etude"}})
    cells = "".join(
        f'<img src="{html.escape(b["cover"])}" alt="{html.escape(b["title"][:60])}"/>' if b.get("cover")
        else f'<div class="ph">{html.escape((b.get("title") or "M")[:1].upper())}</div>'
        for b in books)
    extra = f'<div class="grid">{cells}</div>' if cells else ""
    cover = next((b["cover"] for b in books if b.get("cover")), None)
    return HTMLResponse(_page(f"La bibliothèque de {u.get('pseudo', '')}", f"{total} livre{'s' if total > 1 else ''} sur Manent", cover,
                              f"/@{handle}/bibliotheque", extra=extra, open_label=f"Voir dans l’application"))


async def _club_page(code: str):
    c = await db.clubs.find_one({"code": code.upper()}, {"_id": 0, "name": 1, "members": 1})
    if not c:
        return HTMLResponse(_page("Manent", "Ce que tes lectures te laissent.", None, "/"))
    n = len(c.get("members", []))
    return HTMLResponse(_page(c["name"], f"{n} membre{'s' if n > 1 else ''} — on t'attend pour la prochaine lecture.", None, f"/c/{code.upper()}"))


router.add_api_route("/q/{quote_id}", _quote_page, response_class=HTMLResponse)
router.add_api_route("/b/{catalog_id}", _book_page, response_class=HTMLResponse)
router.add_api_route("/u/{handle}", _profile_page, response_class=HTMLResponse)
router.add_api_route("/u/{handle}/bibliotheque", _library_page, response_class=HTMLResponse)
router.add_api_route("/c/{code}", _club_page, response_class=HTMLResponse)

root_router.add_api_route("/q/{quote_id}", _quote_page, response_class=HTMLResponse)
root_router.add_api_route("/b/{catalog_id}", _book_page, response_class=HTMLResponse)
root_router.add_api_route("/c/{code}", _club_page, response_class=HTMLResponse)
root_router.add_api_route("/@{handle}", _profile_page, response_class=HTMLResponse)
root_router.add_api_route("/@{handle}/bibliotheque", _library_page, response_class=HTMLResponse)


# ---------------------------------------------------------------- Pages légales publiques (exigées par les stores)
PRIVACY_FR = """Manent respecte le RGPD (Règlement général sur la protection des données).

Ce que nous collectons : ton e-mail, ton pseudo, tes livres, citations, tableaux, clubs, recommandations et statistiques de lecture. Rien d'autre.

Ce que nous en faisons : uniquement faire fonctionner l'app, y compris les propositions « Pour toi », calculées à partir de ta bibliothèque et de tes sujets, jamais partagées. Tes citations restent privées par défaut ; toi seul décides de les rendre publiques.

Ce que nous ne faisons jamais : vendre tes données, les partager avec des annonceurs, ou analyser tes lectures à des fins publicitaires.

Tes droits (articles 15 à 21 du RGPD) : accès, rectification, portabilité (bouton « Télécharger mes données » dans Paramètres) et effacement (bouton « Supprimer mon compte » — suppression immédiate et définitive).

Hébergement : tes données sont stockées de manière sécurisée ; les photos de pages transitent uniquement pour la transcription et ne sont pas conservées par le modèle d'IA.

Contact : bonjour@manentlc.app"""

TERMS_FR = """Conditions d'utilisation — l'essentiel, sans jargon.

1. Manent t'aide à garder ce que tes lectures te laissent. Ton contenu t'appartient, tu nous accordes seulement le droit technique de l'afficher dans l'app.

2. Les citations que tu rends publiques restent de courts extraits relevant du droit de courte citation. Tu t'engages à créditer l'œuvre et à ne pas publier de passages entiers.

3. Respect entre lecteurs : pas de contenu haineux, illégal ou hors sujet dans les clubs, les recommandations et les profils publics. Nous pouvons retirer un contenu signalé.

4. Le Premium est un abonnement facultatif, résiliable à tout moment.

5. Les liens librairies sont affiliés : une commission nous est reversée, sans surcoût pour toi.

6. Nous pouvons faire évoluer l'app ; les changements importants te seront annoncés.

Contact : bonjour@manentlc.app"""


def _legal_html(title: str, body: str) -> str:
    paras = "".join(f"<p>{html.escape(p.strip())}</p>" for p in body.split("\n\n") if p.strip())
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{html.escape(title)} — Manent</title>
<meta name="robots" content="index,follow"/>
<style>
body{{margin:0;font-family:Georgia,'Times New Roman',serif;background:#D2E2EC;color:#3A2119}}
.wrap{{max-width:680px;margin:0 auto;padding:40px 24px 64px}}
.mark{{font-style:italic;font-weight:500;font-size:28px}}
.base{{font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#957662;margin-bottom:28px}}
h1{{font-style:italic;font-weight:500;font-size:30px;margin:0 0 20px}}
p{{font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;background:#F5EDE4;border-radius:12px;padding:14px 18px;margin:0 0 12px}}
a{{color:#79A3C3}}
footer{{font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#957662;margin-top:28px}}
</style></head><body><div class="wrap">
<div class="mark">Manent</div><div class="base">verba volant, scripta manent</div>
<h1>{html.escape(title)}</h1>{paras}
<footer>Manent · <a href="{html.escape(PUBLIC_BASE_URL or '/')}">manentlc.app</a></footer>
</div></body></html>"""


async def _privacy_page():
    return HTMLResponse(_legal_html("Politique de confidentialité", PRIVACY_FR))


async def _terms_page():
    return HTMLResponse(_legal_html("Conditions d'utilisation", TERMS_FR))


router.add_api_route("/confidentialite", _privacy_page, response_class=HTMLResponse)
router.add_api_route("/conditions", _terms_page, response_class=HTMLResponse)
root_router.add_api_route("/confidentialite", _privacy_page, response_class=HTMLResponse)
root_router.add_api_route("/conditions", _terms_page, response_class=HTMLResponse)


# ---------------------------------------------------------------- .well-known dynamiques
def _aasa() -> dict:
    team, bundle = _env("APPLE_TEAM_ID") or "TEAMID", _env("IOS_BUNDLE_ID") or "com.manent.app"
    return {"applinks": {"apps": [], "details": [
        {"appID": f"{team}.{bundle}", "paths": ["/@*", "/q/*", "/b/*", "/c/*", "/api/s/*"]}]}}


def _assetlinks() -> list:
    pkg = _env("ANDROID_PACKAGE") or "com.manent.app"
    fp = _env("ANDROID_SHA256_FINGERPRINT") or "REMPLACER_PAR_EMPREINTE_DE_SIGNATURE"
    return [{"relation": ["delegate_permission/common.handle_all_urls"],
             "target": {"namespace": "android_app", "package_name": pkg,
                        "sha256_cert_fingerprints": [fp]}}]


@wk_router.get("/.well-known/apple-app-site-association")
@wk_router.get("/api/.well-known/apple-app-site-association")
async def wk_aasa():
    return JSONResponse(_aasa(), media_type="application/json")


@wk_router.get("/.well-known/assetlinks.json")
@wk_router.get("/api/.well-known/assetlinks.json")
async def wk_assetlinks():
    return JSONResponse(_assetlinks(), media_type="application/json")
