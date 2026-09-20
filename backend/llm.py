"""Appels IA directs à l'API Anthropic (remplace la passerelle Emergent).

Un seul point d'entrée : `chat(system, user, image_b64=None, ...)` renvoie le texte de la réponse, ou "" si
l'appel échoue ou si le modèle refuse. Les appelants traitent "" comme un échec non bloquant.

Variables d'environnement :
  ANTHROPIC_API_KEY  clé API (sans elle, `available` est False et chat() renvoie "")
  AI_MODEL           modèle par défaut (claude-opus-5) ; claude-sonnet-5 pour réduire le coût
"""
import os
import base64
import logging
from typing import Optional

logger = logging.getLogger("manent")

DEFAULT_MODEL = os.environ.get("AI_MODEL", "claude-opus-5")
_client = None


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic()
    return _client


def image_media_type(b64: str) -> str:
    """Type MIME d'une image base64 d'après ses octets de signature (jamais d'après le client)."""
    try:
        head = base64.b64decode(b64[:32] + "=" * (-len(b64[:32]) % 4))
    except Exception:
        return "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/jpeg"


async def chat(system: str, user: str, image_b64: Optional[str] = None, *, model: Optional[str] = None,
               max_tokens: int = 2048, effort: Optional[str] = None) -> str:
    """Un tour de conversation. Texte seul ou texte + image (base64 sans préfixe data:).
    `effort` ("low" | "medium" | "high") règle la profondeur de réflexion : "low" pour les tâches
    mécaniques (numéro de page, OUI/NON, traduction), défaut sinon."""
    if not available():
        return ""
    content: list = []
    if image_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": image_media_type(image_b64), "data": image_b64}})
    content.append({"type": "text", "text": user})
    kwargs = dict(model=model or DEFAULT_MODEL, max_tokens=max_tokens, system=system,
                  messages=[{"role": "user", "content": content}])
    if effort:
        kwargs["output_config"] = {"effort": effort}
    client = _get_client()
    try:
        # Repli serveur en cas de refus de sécurité (réexécution sur un modèle de repli dans le même appel)
        try:
            resp = await client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
        except TypeError:
            resp = await client.messages.create(**kwargs)
    except Exception as e:
        logger.warning("llm call failed: %s", e)
        return ""
    if getattr(resp, "stop_reason", None) == "refusal":
        logger.info("llm refused (%s)", getattr(getattr(resp, "stop_details", None), "category", None))
        return ""
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
