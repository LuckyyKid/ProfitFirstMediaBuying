"""Collecte Reddit via RapidAPI (reddit-posts-search).
Un seul endpoint: GET / avec query params. Renvoie posts + selftext.
Pas de comments disponibles sur ce provider."""
import time
import httpx
from app.config import RAPIDAPI_KEY, RAPIDAPI_REDDIT_HOST

BASE = f"https://{RAPIDAPI_REDDIT_HOST}"
HEADERS = {"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_REDDIT_HOST}


def _get(params: dict) -> dict:
    """GET avec retry: le provider RapidAPI renvoie regulierement des 502/503
    transitoires ET des 429 (rate limit du plan RapidAPI). Sans retry sur 429,
    tout un run rate-limite ramene 0 post (vecu sur Spek Optics: 15/15 queries
    en 429). Backoff long sur 429 (respecte `Retry-After` si present), backoff
    court sur 5xx transitoires."""
    last_exc: Exception | None = None
    for attempt in range(5):
        try:
            with httpx.Client(timeout=90) as c:
                r = c.get(f"{BASE}/", headers=HEADERS, params=params)
                if r.status_code == 429:
                    # RapidAPI free/basic tier: 1 req/sec typique. Respecte
                    # Retry-After si envoye, sinon backoff long.
                    ra = r.headers.get("retry-after")
                    wait = float(ra) if (ra and ra.replace('.', '', 1).isdigit()) else 5.0 * (attempt + 1)
                    last_exc = httpx.HTTPStatusError(
                        f"rate limited 429 (retry-after={ra})",
                        request=r.request, response=r)
                    time.sleep(min(wait, 30.0))
                    continue
                if 500 <= r.status_code < 600:
                    last_exc = httpx.HTTPStatusError(
                        f"server {r.status_code}", request=r.request, response=r)
                    time.sleep(1.5 * (attempt + 1))
                    continue
                r.raise_for_status()
                return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            last_exc = e
            time.sleep(1.5 * (attempt + 1))
    assert last_exc is not None
    raise last_exc


def search_posts(query: str, sort: str = "relevance", limit: int = 25,
                 time_range: str = "all") -> list[dict]:
    """sort: relevance|hot|top|new|comments. time_range: all|year|month|week|day|hour."""
    data = _get({
        "query": query,
        "sort": sort,
        "time": time_range,
        "includeComments": "false",
        "maxItems": str(limit),
    })
    results = data.get("results") or []
    return results if isinstance(results, list) else []


def collect_reddit_voc(queries: list[str], posts_per_query: int = 15,
                       sleep_s: float = 2.5) -> list[dict]:
    """Pour chaque requete: posts (title + selftext). Pas de comments sur ce provider.

    Default `posts_per_query=15` (~135 posts pour 9 queries) — la relevance chute
    au-dela, mais 6 (ancien default) etait trop bas et gaspillait le potentiel
    de canaux comme r/Kombucha ou r/GutHealth.

    `sleep_s=2.5` par defaut: le RapidAPI free/basic tier limite a ~1 req/sec.
    Avec 15 queries et 1s de sleep, on tapait le rate limit 429 sur toutes les
    queries (run Spek Optics 2026-07-20). 2.5s laisse une marge suffisante."""
    out = []
    for q in queries:
        try:
            posts = search_posts(q, limit=posts_per_query)
        except Exception as e:
            out.append({"query": q, "error": str(e)})
            continue
        for p in posts:
            out.append({"query": q, "post": p})
        time.sleep(sleep_s)
    return out
