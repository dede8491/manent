"""Notifications push — service push d'Expo (https://exp.host/--/api/v2/push/send).

Chaque appareil enregistre son jeton Expo (`ExponentPushToken[...]`) via POST /register-push ; les envois
passent par l'API Expo, qui relaie vers APNs / FCM avec les clés déposées sur le projet EAS.
Variable d'environnement optionnelle : EXPO_ACCESS_TOKEN (sécurité renforcée des envois).
"""
import os
import logging
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from deps import get_current_user, db, now_utc, new_id

logger = logging.getLogger("manent")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_ACCESS_TOKEN = os.environ.get("EXPO_ACCESS_TOKEN", "")

router = APIRouter(prefix="/api")


class RegisterPushBody(BaseModel):
    platform: str  # "android" | "ios"
    device_token: str


@router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, user=Depends(get_current_user)):
    """Enregistre (ou rattache à ce compte) le jeton push de l'appareil. L'identité vient de la session."""
    token = (body.device_token or "").strip()
    if not token.startswith("ExponentPushToken[") and not token.startswith("ExpoPushToken["):
        return {"status": "ignored"}
    await db.push_tokens.update_one(
        {"token": token},
        {"$set": {"user_id": user["user_id"], "platform": body.platform, "token": token, "updated_at": now_utc()},
         "$setOnInsert": {"created_at": now_utc()}},
        upsert=True,
    )
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


async def _expo_send(messages: list) -> list:
    """POST vers l'API push d'Expo (jusqu'à 100 messages par appel). Renvoie les tickets."""
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.post(EXPO_PUSH_URL, json=messages, headers=headers)
    if r.status_code >= 400:
        logger.warning("expo push failed: %s %s", r.status_code, r.text[:200])
        return []
    return (r.json() or {}).get("data") or []


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
    tokens = await db.push_tokens.find({"user_id": {"$in": recipients}}, {"_id": 0, "token": 1}).to_list(5000)
    if not tokens:
        return
    payload = {k: v for k, v in (data.get("data") or {}).items()}
    if data.get("action_url"):
        payload["action_url"] = data["action_url"]
    messages = [{"to": t["token"], "title": data["title"], "body": data["message"], "data": payload, "sound": "default"}
                for t in tokens]
    for i in range(0, len(messages), 100):
        chunk = messages[i:i + 100]
        try:
            tickets = await _expo_send(chunk)
        except Exception as e:
            logger.warning("expo push error: %s", e)
            continue
        # Jetons périmés (appareil désinstallé) : on les oublie
        for msg, ticket in zip(chunk, tickets):
            if isinstance(ticket, dict) and ticket.get("status") == "error" \
                    and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                await db.push_tokens.delete_one({"token": msg["to"]})
