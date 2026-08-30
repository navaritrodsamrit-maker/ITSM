import httpx

from ..config import settings


class OllamaError(Exception):
    pass


async def embed(texts: list[str]) -> list[list[float]]:
    """คืน embedding ต่อ text (ใช้ ITSM_EMBED_MODEL)."""
    if not texts:
        return []
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(f"{settings.ollama_url}/api/embed",
                             json={"model": settings.embed_model, "input": texts})
    except httpx.RequestError as e:
        raise OllamaError(f"ต่อ Ollama ไม่ได้: {e}") from e
    if r.status_code != 200:
        raise OllamaError(f"embed {r.status_code}: {r.text[:200]}")
    data = r.json().get("embeddings")
    if not data:
        raise OllamaError("Ollama ไม่คืน embeddings (โมเดล embed ถูกต้องไหม / ollama pull แล้วยัง)")
    return data


async def chat(messages: list[dict], *, temperature: float = 0.2) -> str:
    try:
        async with httpx.AsyncClient(timeout=180) as c:
            r = await c.post(f"{settings.ollama_url}/api/chat", json={
                "model": settings.chat_model,
                "messages": messages,
                "stream": False,
                "think": False,          # ปิด reasoning ของ qwen3
                "options": {"temperature": temperature},
            })
    except httpx.RequestError as e:
        raise OllamaError(f"ต่อ Ollama ไม่ได้: {e}") from e
    if r.status_code != 200:
        raise OllamaError(f"chat {r.status_code}: {r.text[:200]}")
    return (r.json().get("message") or {}).get("content", "").strip()


async def health() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{settings.ollama_url}/api/tags")
        models = [m["name"] for m in r.json().get("models", [])]
        bare = {m.split(":")[0] for m in models}

        def ready(name: str) -> bool:
            return name in models or name.split(":")[0] in bare

        return {
            "ok": True,
            "models": models,
            "chat_model_ready": ready(settings.chat_model),
            "embed_model_ready": ready(settings.embed_model),
        }
    except (httpx.RequestError, ValueError) as e:
        return {"ok": False, "error": str(e)}
