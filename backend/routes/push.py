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


async def store_notifications(recipients: list, data: dict, idempotency_key: str | None = None) -> None:
    """Garde chaque notification en base (collection notifications) pour le centre de notifications de l'app.
    Idempotent sur (destinataire, clé). Ne bloque jamais l'envoi."""
    try:
        now = now_utc()
        for uid in recipients:
            doc = {"notif_id": new_id("nt"), "user_id": uid, "title": data.get("title") or "Manent", "message": data.get("message") or "",
                   "action_url": _action_url(data), "kind": (data.get("data") or {}).get("type") or ("club" if (data.get("action_url") or "").startswith("/club") else "general"),
                   "read": False, "created_at": now}
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
