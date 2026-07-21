"""Fallback reviews collector when Trustpilot is empty.

Cascade:
1. Widget detection on client_pages HTML: Judge.me, Loox, Yotpo, Okendo, Stamped.
   For each detected widget, try scraping the corresponding JSON endpoint / public API.
2. (Placeholder) Google Maps reviews via Apify actor — requires ACTOR_GMAPS_REVIEWS.
3. (Placeholder) Facebook page reviews — requires an actor for that surface.

For now (1) is fully implemented; (2)/(3) are stubs that require user confirmation to
subscribe an actor (see fetch_google_maps_reviews / fetch_fb_page_reviews below).
"""
import re
import json
import httpx
from urllib.parse import quote_plus
from app.config import ACTOR_GMAPS_REVIEWS

WIDGET_PATTERNS = {
    "judgeme": [
        re.compile(r"cdn\.judge\.me", re.I),
        re.compile(r"jdgm[\w-]+", re.I),
    ],
    "loox": [re.compile(r"loox\.io", re.I)],
    "yotpo": [re.compile(r"yotpo\.com|yotpo_reviews", re.I)],
    "okendo": [re.compile(r"okendo\.io|oke-widget", re.I)],
    "stamped": [re.compile(r"stamped\.io", re.I)],
    "reviews_io": [re.compile(r"reviews\.io|reviewscouk", re.I)],
    "shopify_native": [re.compile(r"shopify_reviews", re.I)],
}


def detect_widgets(pages: list[dict]) -> dict:
    """Return {widget_name: [urls_where_seen]} from already-collected client_pages."""
    hits: dict[str, list[str]] = {}
    for p in pages:
        html = p.get("html") or p.get("text") or ""
        url = p.get("url", "")
        for name, patterns in WIDGET_PATTERNS.items():
            if any(pat.search(html) for pat in patterns):
                hits.setdefault(name, []).append(url)
    return hits


def _judgeme_reviews(shop_domain: str, max_reviews: int = 50) -> list[dict]:
    """Judge.me exposes a public widget JSON at /reviews/reviews_for_widget.
    We can't easily know the shop_id without the widget script — try the /reviews.json
    Shopify-native endpoint first, then fall back to what we can find.
    """
    out: list[dict] = []
    urls_to_try = [
        f"{shop_domain.rstrip('/')}/collections/all.json?limit=1",  # sanity check
    ]
    # Judge.me public feed: /reviews?utf8=%E2%9C%93 (HTML rendering, needs Scrapling)
    try:
        r = httpx.get(f"{shop_domain.rstrip('/')}/reviews",
                      timeout=20, follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            # Very rough text extraction — the agent VOC will re-parse
            text = re.sub(r"<[^>]+>", " ", r.text)
            out.append({"source": "judgeme_html", "text": text[:200_000],
                        "url": r.url.__str__()})
    except Exception:
        pass
    return out[:max_reviews]


def _loox_reviews(shop_domain: str, max_reviews: int = 50) -> list[dict]:
    """Loox public widget: no easy public JSON without shop_id. Return HTML dump."""
    out: list[dict] = []
    try:
        r = httpx.get(f"{shop_domain.rstrip('/')}/apps/loox",
                      timeout=20, follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            text = re.sub(r"<[^>]+>", " ", r.text)
            out.append({"source": "loox_html", "text": text[:200_000]})
    except Exception:
        pass
    return out[:max_reviews]


def collect_widget_reviews(client_domain: str, widgets: dict,
                           max_reviews: int = 50) -> list[dict]:
    """Given detected widgets for a client, try to pull the reviews.

    Chaque item est taggue `_source` = "judgeme" / "loox" / etc. pour l'attribution.
    """
    out: list[dict] = []
    if "judgeme" in widgets:
        items = _judgeme_reviews(client_domain, max_reviews)
        for it in items:
            it["_source"] = "judgeme"
            it["_source_domain"] = client_domain
        out.extend(items)
    if "loox" in widgets:
        items = _loox_reviews(client_domain, max_reviews)
        for it in items:
            it["_source"] = "loox"
            it["_source_domain"] = client_domain
        out.extend(items)
    return out


_GEO_STOPWORDS = {
    "montreal", "montréal", "quebec", "québec", "toronto", "vancouver",
    "canada", "ontario", "laval", "longueuil", "sherbrooke", "gatineau",
    "ottawa", "calgary", "edmonton", "winnipeg", "halifax",
    "new", "york", "los", "angeles", "chicago", "boston", "miami", "usa",
    "france", "paris", "lyon", "marseille", "london", "uk",
    "inc", "ltd", "llc", "co", "the", "and", "et",
}


def _brand_tokens(query: str) -> list[str]:
    """Extract brand tokens from a query (strip geo/generic stopwords)."""
    raw = re.split(r"[\s,\-]+", query.lower().strip())
    toks = [t for t in raw if len(t) >= 3 and t not in _GEO_STOPWORDS]
    # Ne garde que les tokens alphanum, retire ponctuation restante
    toks = [re.sub(r"[^\w]", "", t) for t in toks]
    return [t for t in toks if len(t) >= 3]


def _gmaps_place_title(item: dict) -> str:
    """The actor's items typically nest place info differently across runs."""
    for k in ("title", "name", "placeName", "businessName"):
        v = item.get(k)
        if isinstance(v, str) and v:
            return v
    place = item.get("place") or {}
    if isinstance(place, dict):
        for k in ("title", "name"):
            v = place.get(k)
            if isinstance(v, str) and v:
                return v
    return ""


def _brand_match_score(query: str, title: str) -> int:
    """0-100 confidence score that `title` refers to the brand named in `query`.

    Uses rapidfuzz.partial_ratio on brand tokens (query minus geo stopwords) vs
    lowercased title. Requires at least one brand token to actually appear as a
    substring — otherwise we return 0 regardless of fuzzy score.
    """
    if not title:
        return 0
    from rapidfuzz import fuzz
    tokens = _brand_tokens(query)
    if not tokens:
        return 0
    tl = title.lower()
    if not any(t in tl for t in tokens):
        return 0
    brand = " ".join(tokens)
    return int(fuzz.partial_ratio(brand, tl))


def _gmaps_search_url(query: str) -> str:
    return f"https://www.google.com/maps/search/{quote_plus(query)}"


# Retail chain / multi-brand stores whose GMaps reviews describe the STORE
# service (staff, checkout, workshop) — never the client's product. Historique
# Spek Optics: la query `"Sports Experts Montreal"` a ramene 711 reviews, 0
# mention du produit. On bloque en amont pour eviter que le corpus VOC soit
# pollue si le prompt context.md laisse passer une telle query.
RETAIL_CHAIN_BLOCKLIST = {
    "sports experts", "sport experts", "atmosphere", "atmosphère",
    "soccer experts", "hockey experts", "sail",
    "walmart", "costco", "target", "canadian tire", "ctc",
    "iga", "metro", "loblaws", "provigo", "maxi", "super c",
    "sephora", "shoppers drug mart", "pharmaprix",
    "amazon", "best buy", "the source", "bureau en gros", "staples",
    "decathlon", "mec", "sportium",
}


def _is_retail_chain_query(query: str) -> bool:
    """True si la requete cible une chaine retail generique (a bloquer)."""
    q = query.lower().strip()
    for chain in RETAIL_CHAIN_BLOCKLIST:
        # match si la chaine apparait comme mot-cle dominant de la query
        if chain in q:
            # tolere si le nom d'une vraie marque suit (ex: "Nike @ Sports Experts")
            # → mais dans la pratique on genere `<brand> <ville>`, donc si un
            # element de la blocklist apparait, c'est presque toujours l'element
            # dominant. Bloque net.
            return True
    return False


def fetch_google_maps_reviews(queries: list[str], max_reviews: int = 100,
                              language: str = "en",
                              reviews_start_date: str = "2024-01-01",
                              match_threshold: int = 60) -> list[dict]:
    """Google Maps reviews via Apify actor ACTOR_GMAPS_REVIEWS.

    Each item in `queries` can be:
    - a full Google Maps place URL (https://www.google.com/maps/place/...)
    - a search query (brand + city) — converted to a maps/search URL

    Runs the actor ONCE PER QUERY so each result is attributable, then filters
    out places whose title doesn't fuzzy-match the brand named in the query
    (score < match_threshold). Each returned item gets `_query`, `_place_title`
    and `_brand_match_score` fields. Items with a mismatch are dropped but the
    mismatch is logged in `_gmaps_match_log`.

    Les requetes qui ciblent une chaine retail generique (blocklist) sont
    REJETEES au demarrage — leurs reviews parlent du magasin, pas du produit
    client. Le log est conserve dans `_gmaps_match_log`.
    """
    if not queries:
        return []
    from app.collectors.apify import run_actor
    kept: list[dict] = []
    mismatch_log: list[dict] = []
    for q in queries:
        if _is_retail_chain_query(q):
            mismatch_log.append({"query": q, "place_title": "(query bloquee)",
                                 "score": 0,
                                 "reason": "retail chain blocklist — voir "
                                           "context.md regle anti-pollution"})
            continue
        url = q if q.startswith("http") else _gmaps_search_url(q)
        run_input = {
            "startUrls": [{"url": url}],
            "maxReviews": max_reviews,
            "reviewsSort": "newest",
            "reviewsStartDate": reviews_start_date,
            "reviewsFilterString": "",
            "language": language,
            "reviewsOrigin": "all",
            "personalData": True,
        }
        try:
            items = run_actor(ACTOR_GMAPS_REVIEWS, run_input)
        except Exception as e:
            kept.append({"error": f"gmaps actor failed: {e}", "query": q})
            continue
        # A full-URL query bypasses the brand-match check (URL = intent explicite)
        skip_match = q.startswith("http")
        for it in items:
            title = _gmaps_place_title(it)
            score = 100 if skip_match else _brand_match_score(q, title)
            it["_query"] = q
            it["_place_title"] = title
            it["_brand_match_score"] = score
            it["_source"] = "gmaps"
            if score >= match_threshold:
                kept.append(it)
            else:
                mismatch_log.append({"query": q, "place_title": title,
                                     "score": score})
    if mismatch_log:
        kept.append({"_gmaps_match_log": mismatch_log[:200]})
    return kept


def fetch_fb_page_reviews(fb_page_url: str, max_reviews: int = 50) -> list[dict]:
    """Stub — requires an actor for FB page reviews."""
    return [{"error": "FB page reviews actor not configured — pending subscription"}]


# ============================================================================
# TRUSTPILOT — scraper direct (fallback quand l'actor Apify est epuise)
# ============================================================================

_TP_JSON_RE = re.compile(
    r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL)


def _tp_business_url(domain_or_url: str) -> str:
    """Accepte `sungod.co`, `www.sungod.co`, `https://www.trustpilot.com/review/sungod.co`."""
    s = domain_or_url.strip()
    if s.startswith("http"):
        return s.rstrip("/")
    s = s.replace("https://", "").replace("http://", "").strip("/")
    if s.startswith("www."):
        s = s[4:]
    return f"https://www.trustpilot.com/review/{s}"


def _tp_extract_reviews(html: str) -> tuple[list[dict], int]:
    """Extrait la liste de reviews et le nombre total depuis __NEXT_DATA__.

    Renvoie ([], 0) si le blob est absent/malforme. Chaque review garde sa
    shape Trustpilot d'origine (id, title, text, rating, dates, consumer)."""
    m = _TP_JSON_RE.search(html)
    if not m:
        return [], 0
    try:
        data = json.loads(m.group(1))
    except Exception:
        return [], 0
    page_props = (((data.get("props") or {}).get("pageProps")) or {})
    reviews = page_props.get("reviews") or []
    total = ((page_props.get("filters") or {}).get("pagination", {}) or {}).get(
        "totalNumberOfReviews", 0) or page_props.get("numberOfReviews", 0)
    if not isinstance(reviews, list):
        return [], 0
    return reviews, int(total or 0)


def fetch_trustpilot_direct(domain: str, max_reviews: int = 100,
                            max_pages: int = 5) -> list[dict]:
    """Fallback direct sur Trustpilot quand l'actor Apify est epuise.

    Scrape https://www.trustpilot.com/review/<domain>?page=1..N via la chaine
    fetch_page (httpx -> scrapling -> stealthy -> cloak). Extrait les reviews
    depuis `__NEXT_DATA__` (props.pageProps.reviews).

    Chaque review recoit `_source: "trustpilot"`, `_source_domain: <domain>`,
    `_source_method: "direct"` pour distinguer d'un scrape actor.
    """
    from app.collectors.pages import fetch_page
    base = _tp_business_url(domain)
    out: list[dict] = []
    for page in range(1, max_pages + 1):
        url = base if page == 1 else f"{base}?page={page}"
        res = fetch_page(url)
        html = res.get("html")
        if not html:
            break
        reviews, _total = _tp_extract_reviews(html)
        if not reviews:
            break
        for r in reviews:
            r["_source"] = "trustpilot"
            r["_source_domain"] = domain
            r["_source_method"] = "direct"
        out.extend(reviews)
        if len(out) >= max_reviews:
            return out[:max_reviews]
    return out[:max_reviews]
