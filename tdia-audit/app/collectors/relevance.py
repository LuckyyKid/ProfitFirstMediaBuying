"""Post-collect relevance filter for Reddit results.

The reddit-posts-search RapidAPI provider does OR-token matching which returns a lot of
noise (r/pcgaming for "play couch kids", etc.). This module scores each post via the
cheap LLM against the business context and keeps only the relevant ones.
"""
import json
import re

from app.config import LLM_MODEL_CHEAP
from app.llm import complete

_SCORE_PROMPT = (
    "Tu evalues la pertinence de posts Reddit pour une analyse VOC (voice of customer). "
    "Le contexte business est fourni. Pour chaque post numerote, reponds UNIQUEMENT par "
    "une ligne de la forme `N: 1` (pertinent) ou `N: 0` (hors-sujet). Un post est pertinent "
    "s'il parle du produit/service, d'un pain de la categorie, d'un competiteur, ou d'un "
    "usage typique du client cible. r/pcgaming pour du kombucha = 0. r/Kombucha discussing "
    "brand X = 1. Aucun commentaire, aucun autre texte."
)


def _post_summary(post: dict, idx: int) -> str:
    sub = post.get("subreddit") or post.get("subredditName") or "?"
    title = (post.get("title") or "")[:200]
    body = (post.get("selftext") or post.get("text") or "")[:400]
    return f"[{idx}] r/{sub} | {title} | {body}"


def _parse_scores(text: str, n: int) -> list[int]:
    scores = [0] * n
    for m in re.finditer(r"(\d+)\s*[:.\-]\s*([01])", text):
        i = int(m.group(1)) - 1
        if 0 <= i < n:
            scores[i] = int(m.group(2))
    return scores


def score_relevance(items: list[dict], context: str,
                    batch_size: int = 20) -> list[int]:
    """Return a 0/1 vector same length as items. items may include `error` entries.

    error entries always score 0. All calls hit the cheap model.
    """
    scores = [0] * len(items)
    posts_idx = [i for i, it in enumerate(items) if "error" not in it and it.get("post")]
    for start in range(0, len(posts_idx), batch_size):
        batch = posts_idx[start:start + batch_size]
        lines = [_post_summary(items[i]["post"], k + 1)
                 for k, i in enumerate(batch)]
        user = (f"# Contexte business\n{context[:6000]}\n\n"
                f"# Posts a evaluer ({len(batch)})\n" + "\n".join(lines))
        try:
            resp = complete(_SCORE_PROMPT, user, model=LLM_MODEL_CHEAP, max_tokens=300)
        except Exception:
            resp = ""
        for k, s in enumerate(_parse_scores(resp, len(batch))):
            scores[batch[k]] = s
    return scores


def filter_reddit(items: list[dict], context: str) -> tuple[list[dict], dict]:
    """Return (kept_items, stats) where stats includes total/relevant/ratio."""
    if not items:
        return [], {"total": 0, "relevant": 0, "ratio": 0.0}
    scores = score_relevance(items, context)
    kept = [it for it, s in zip(items, scores) if s == 1]
    total_scoreable = sum(1 for it in items if "error" not in it and it.get("post"))
    ratio = len(kept) / max(total_scoreable, 1)
    return kept, {"total": total_scoreable, "relevant": len(kept), "ratio": ratio}
