"""Abstraction du fournisseur IA (AIProvider).

Frontend → Backend → ClassificationService → AIProvider → API du fournisseur.
Le fournisseur actuel est la passerelle Emergent (`emergentintegrations`, clé `EMERGENT_LLM_KEY`,
modèle `AI_MODEL`, Claude par défaut). Changer de fournisseur = remplacer `_send()` ici, rien d'autre.

Chaque appel est journalisé (`ai_calls` : type, modèle, durée, succès, erreur) sans données sensibles.
"""
import os
import re
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("manent")


class AIProvider:
    name = "emergent"
    db = None  # injecté (journal des appels)

    def __init__(self):
        self.api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        self.vendor = os.environ.get("AI_VENDOR", "anthropic")
        self.model = os.environ.get("AI_MODEL", "claude-sonnet-4-6")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def _send(self, system: str, user: str, session_id: str) -> str:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=self.api_key, session_id=session_id, system_message=system).with_model(self.vendor, self.model)
        return str(await chat.send_message(UserMessage(text=user)))

    async def _log(self, kind: str, ok: bool, ms: int, error: Optional[str] = None, meta: Optional[dict] = None):
        if self.db is None:
            return
        try:
            await self.db.ai_calls.insert_one({"kind": kind, "model": self.model, "vendor": self.vendor, "ok": ok,
                                               "duration_ms": ms, "error": (error or "")[:200] or None,
                                               "meta": meta or {}, "at": datetime.now(timezone.utc)})
        except Exception:
            pass

    async def complete_json(self, kind: str, system: str, user: str, session_id: str, meta: Optional[dict] = None) -> Optional[dict]:
        """Appel avec réponse JSON stricte. None en cas d'échec (jamais d'exception vers l'appelant)."""
        if not self.available:
            return None
        t0 = time.monotonic()
        try:
            raw = (await self._send(system, user, session_id)).strip()
            raw = re.sub(r'^```(?:json)?|```$', '', raw, flags=re.M).strip()
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("json_not_object")
            await self._log(kind, True, int((time.monotonic() - t0) * 1000), meta=meta)
            return data
        except Exception as e:
            logger.warning("ai %s failed: %s", kind, e)
            await self._log(kind, False, int((time.monotonic() - t0) * 1000), error=str(e), meta=meta)
            return None

    async def complete_text(self, kind: str, system: str, user: str, session_id: str) -> Optional[str]:
        if not self.available:
            return None
        t0 = time.monotonic()
        try:
            out = (await self._send(system, user, session_id)).strip()
            await self._log(kind, True, int((time.monotonic() - t0) * 1000))
            return out
        except Exception as e:
            await self._log(kind, False, int((time.monotonic() - t0) * 1000), error=str(e))
            return None

    # ------------------------------------------------------------ Services métier
    async def classify_book(self, system: str, payload_text: str, catalog_id: str, prompt_version: str) -> Optional[dict]:
        return await self.complete_json("classify", system, payload_text + "\n\nRenvoie le JSON.",
                                        session_id=f"cls_{catalog_id}", meta={"catalog_id": catalog_id, "prompt_version": prompt_version})

    async def parse_search_intent(self, system: str, text: str) -> Optional[dict]:
        return await self.complete_json("intent", system, f"Demande : « {text} »", session_id=f"intent_{abs(hash(text)) % 10**8}")

    async def analyze_author(self, name: str) -> Optional[str]:
        """Pays d'origine (ISO2) d'un auteur, ou None — n'invente jamais."""
        out = await self.complete_text(
            "author_origin",
            "Tu donnes le pays d'origine d'un auteur. Réponds UNIQUEMENT par un code ISO 3166-1 alpha-2 "
            "(ex. SN, MQ pour Martinique, GP Guadeloupe, GF Guyane) ou INCONNU. N'invente jamais.",
            f"Pays d'origine de l'auteur : {name}", session_id=f"orig_{abs(hash(name)) % 10**8}")
        out = (out or "").strip().upper()
        return out if re.fullmatch(r"[A-Z]{2}", out) else None


provider = AIProvider()
