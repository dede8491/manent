"""Notifications push — relais Emergent managed (SuprSend)."""
import os
import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from deps import get_current_user, db, now_utc, new_id

logger = logging.getLogger("manent")

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

router = APIRouter(prefix="/api")


class RegisterPushBody(BaseModel):
    platform: str  # "android" | "ios"
    device_token: str


@router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, user=Depends(get_current_user)):
    # L'identité vient de la session — jamais du client
    payload = {"user_id": user["user_id"], "platform": body.platform, "device_token": body.device_token}
    resp = await _client.post("/api/v1/push/users/register", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


# Types de notifications (clé, libellé, description) : réglables une à une dans Paramètres → Notifications.
KINDS = [
    ("followed_quote", "Nouvelle citation d’une lectrice suivie", "Quand une personne que tu suis publie une citation."),
    ("quote_like", "Cœur sur une de tes citations", "Quand une lectrice aime une citation publique."),
    ("quote_comment", "Commentaire sur une de tes citations", "Quand une lectrice commente une citation publique."),
    ("new_follower", "Nouvelle abonnée", "Quand quelqu’un se met à suivre tes lectures."),
    ("recommendation", "Livre recommandé", "Quand une lectrice te recommande un livre."),
    ("invitation", "Invitation", "Quand on t’invite sur un tableau ou dans un club."),
    ("club", "Vie de tes clubs", "Messages, progression partagée, défis, passages de la semaine, événements."),
    ("book_update", "Nouveaux chapitres", "Quand une histoire Wattpad de ta bibliothèque avance."),
]
KIND_KEYS = {k for k, _, _ in KINDS}


def notif_kind(data: dict) -> str:
    """Type d'une notification, déduit de son contenu (data.type, écran cible, message)."""
    d = data.get("data") or {}
    t = d.get("type")
    if t in KIND_KEYS:
        return t
    url = data.get("action_url") or ""
    msg = (data.get("message") or "").lower()
    if url.startswith("/quote/"):
        return "followed_quote"
    if url.startswith("/reader/"):
        return "new_follower"
    if url.startswith("/club") or "publication" in msg or (data.get("title") or "") == "Club de lecture":
        return "club"
    if url.startswith("/recommendations") or url.startswith("/inbox?tab=recommendations"):
        return "recommendation"
    if url.startswith("/book/"):
        return "book_update"
    return "general"


def _action_url(data: dict) -> str | None:
    """Écran à ouvrir depuis la notification : action_url explicite, sinon déduit du type."""
    if data.get("action_url"):
        return data["action_url"]
    d = data.get("data") or {}
    t = d.get("type")
    if t in ("quote_like", "quote_comment") and d.get("quote_id"):
        return f"/quote/{d['quote_id']}"
    if t == "invitation":
        return "/inbox?tab=invitations"
    return None


async def filter_recipients(recipients: list, kind: str) -> list:
    """Retire les destinataires qui ont désactivé ce type dans leurs préférences (notif_prefs.<kind> = false)."""
    if not recipients or kind not in KIND_KEYS:
        return list(recipients)
    try:
        off = {u["user_id"] for u in await db.users.find({"user_id": {"$in": list(recipients)}, f"notif_prefs.{kind}": False}, {"_id": 0, "user_id": 1}).to_list(10000)}
    except Exception as e:  # noqa: BLE001
        logger.warning("notif prefs lookup failed: %s", e)
        return list(recipients)
    return [r for r in recipients if r not in off]


async def store_notifications(recipients: list, data: dict, idempotency_key: str | None = None) -> None:
    """Garde chaque notification en base (collection notifications) pour le centre de notifications de l'app.
    Idempotent sur (destinataire, clé). Ne bloque jamais l'envoi."""
    try:
        now = now_utc()
        for uid in recipients:
            doc = {"notif_id": new_id("nt"), "user_id": uid, "title": data.get("title") or "Manent", "message": data.get("message") or "",
                   "action_url": _action_url(data), "kind": notif_kind(data), "read": False, "created_at": now}
            if idempotency_key:
                await db.notifications.update_one({"user_id": uid, "key": f"{idempotency_key}"}, {"$setOnInsert": {**doc, "key": idempotency_key}}, upsert=True)
            else:
                await db.notifications.insert_one(doc)
    except Exception as e:  # noqa: BLE001
        logger.warning("notification store failed (non-blocking): %s", e)


async def send_push(recipients: list, data: dict, idempotency_key: str | None = None) -> None:
    """Envoie un push aux user_ids donnés. Ne jamais bloquer l'opération principale (appeler dans try/except)."""
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    recipients = await filter_recipients(recipients, notif_kind(data))
    if not recipients:
        return
    await store_notifications(recipients, data, idempotency_key)
    # max 100 destinataires par appel — on découpe
    for i in range(0, len(recipients), 100):
        payload: dict = {"recipients": recipients[i:i + 100], "data": data}
        if idempotency_key:
            payload["$idempotency_key"] = f"{idempotency_key}-{i}"
        resp = await _client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
