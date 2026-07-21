"""Couche LLM interchangeable (LiteLLM). Change de provider dans .env, rien d'autre ne bouge."""
import litellm
from tenacity import retry, stop_after_attempt, wait_exponential
from app.config import LLM_MODEL

litellm.drop_params = True  # ignore les params non supportes par certains providers


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def complete(system: str, user: str, model: str | None = None,
             max_tokens: int = 8000, temperature: float = 0.4) -> str:
    resp = litellm.completion(
        model=model or LLM_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content


def chunk_text(items: list[str], max_chars: int = 60_000) -> list[str]:
    """Regroupe une liste de textes en chunks pour le map-reduce."""
    chunks, buf, size = [], [], 0
    for it in items:
        it = (it or "").strip()
        if not it:
            continue
        if size + len(it) > max_chars and buf:
            chunks.append("\n\n---\n\n".join(buf))
            buf, size = [], 0
        buf.append(it)
        size += len(it)
    if buf:
        chunks.append("\n\n---\n\n".join(buf))
    return chunks
