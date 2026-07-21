"""Orchestrateur: collecte -> analyse -> rapport PDF. Execute par le worker RQ."""
import traceback
from app.storage import ClientWorkspace, slugify
from app.collectors.apify import collect_trustpilot, collect_fb_ads
from app.collectors.reddit import collect_reddit_voc
from app.collectors.relevance import filter_reddit
from app.collectors.youtube import collect_youtube_voc
from app.collectors.reviews_fallback import (
    detect_widgets, collect_widget_reviews, fetch_google_maps_reviews,
)
from app.collectors.trends import collect_google_trends, collect_semrush_overview
from app.collectors.pages import fetch_page, html_to_text
from app.collectors.industry_data import (
    collect_industry_us, collect_industry_ca, collect_sec_filings,
)
from app.agents import runners
from app.report.excel import render_excel


def _safe(ws: ClientWorkspace, step: str, fn, *args, **kwargs):
    ws.set_status(step, "running")
    try:
        result = fn(*args, **kwargs)
        ws.set_status(step, "done")
        return result
    except Exception as e:
        ws.set_status(step, "error", f"{e}\n{traceback.format_exc()[-2000:]}")
        return None


def run_audit(client_name: str, onboarding: dict, audit_id: str | None = None,
              options: dict | None = None) -> dict:
    options = options or {}
    ws = ClientWorkspace(slugify(client_name), audit_id)
    ws.write_json(ws.root / "onboarding.json", onboarding)

    # ===== 1. Contexte + plan de collecte =====
    context_md = _safe(ws, "context", runners.agent_context, ws, onboarding)
    plan = runners.extract_collection_plan(context_md or "")
    # le front-end peut forcer/completer le plan via options["collection_plan"]
    plan = {**plan, **options.get("collection_plan", {})}
    ws.write_json(ws.root / "collection-plan.json", plan)

    # ===== 2. Collecte =====
    if plan.get("trustpilot_domains"):
        data = _safe(ws, "collect_trustpilot", collect_trustpilot,
                     plan["trustpilot_domains"],
                     options.get("max_reviews_per_domain", 300))
        ws.write_json(ws.raw("trustpilot.json"), data or [])
    if plan.get("fb_pages"):
        data = _safe(ws, "collect_fb_ads", collect_fb_ads, plan["fb_pages"],
                     options.get("country", "CA"))
        ws.write_json(ws.raw("fb_ads.json"), data or [])
    if plan.get("reddit_queries"):
        raw_reddit = _safe(ws, "collect_reddit", collect_reddit_voc,
                           plan["reddit_queries"],
                           options.get("reddit_posts_per_query", 8)) or []
        ws.write_json(ws.raw("reddit_raw.json"), raw_reddit)
        context_md = (ws.analysis("business-context.md").read_text(encoding="utf-8")
                      if ws.analysis("business-context.md").exists() else "")
        kept, stats = _safe(ws, "filter_reddit", filter_reddit, raw_reddit, context_md) \
            or (raw_reddit, {"total": 0, "relevant": 0, "ratio": 0.0})
        ws.write_json(ws.raw("reddit_filter_stats.json"), stats)
        ws.write_json(ws.raw("reddit.json"), kept)
    if plan.get("youtube_queries"):
        yt = _safe(ws, "collect_youtube", collect_youtube_voc,
                   plan["youtube_queries"],
                   options.get("youtube_max_videos_per_query", 5),
                   options.get("youtube_transcript_max_words", 3000),
                   options.get("youtube_max_comments", 30)) or []
        ws.write_json(ws.raw("youtube.json"), yt)
    if plan.get("trend_keywords"):
        data = _safe(ws, "collect_trends", collect_google_trends,
                     plan["trend_keywords"], options.get("geo", "CA"))
        ws.write_json(ws.raw("google_trends.json"), data or {})
    client_domain = (plan.get("client_domain")
                     or (plan.get("trustpilot_domains") or [None])[0])
    if client_domain:
        data = _safe(ws, "collect_semrush", collect_semrush_overview, client_domain)
        ws.write_json(ws.raw("semrush.json"), data or {})

    def _fetch_all(urls, keep_html: bool = False):
        out = []
        for u in urls:
            page = fetch_page(u)
            item = {"url": u, "method": page.get("method"),
                    "text": html_to_text(page.get("html", "")) if page.get("html") else "",
                    "error": page.get("error")}
            if keep_html and page.get("html"):
                item["html"] = page["html"][:80_000]
            out.append(item)
        return out

    if plan.get("landing_pages"):
        # keep_html so we can detect review widgets in the fallback
        ws.write_json(ws.raw("client_pages.json"),
                      _safe(ws, "collect_client_pages", _fetch_all,
                            plan["landing_pages"], True) or [])
    if plan.get("competitor_pages") or plan.get("competitor_domains"):
        comp_urls = plan.get("competitor_pages") or \
            [f"https://{d}" for d in plan.get("competitor_domains", [])]
        ws.write_json(ws.raw("competitor_pages.json"),
                      _safe(ws, "collect_competitor_pages", _fetch_all, comp_urls) or [])
    if plan.get("industry_article_urls"):
        ws.write_json(ws.raw("industry_articles.json"),
                      _safe(ws, "collect_articles", _fetch_all,
                            plan["industry_article_urls"]) or [])

    # ===== 2a-bis. Donnees industrie (US Census MARTS + StatCan + SEC EDGAR) =====
    # Categorie choisie par l'agent Contexte parmi la taxonomie DTC.
    # Cache automatique 30j (mensuel) / 90j (trimestriel).
    industry_key = plan.get("industry_category")
    if industry_key:
        ws.write_json(ws.raw("industry_us.json"),
                      _safe(ws, "collect_industry_us",
                            collect_industry_us, industry_key) or {})
        ws.write_json(ws.raw("industry_ca.json"),
                      _safe(ws, "collect_industry_ca",
                            collect_industry_ca, industry_key) or {})
        ws.write_json(ws.raw("sec_filings.json"),
                      _safe(ws, "collect_sec_filings",
                            collect_sec_filings, industry_key) or {})

    # ===== 2b. Reviews additionnels (widgets + GMaps) =====
    # PRINCIPE: on ne se contente PAS d'un fallback. On empile toutes les sources
    # de reviews disponibles dans trustpilot.json (fichier "master reviews" —
    # chaque item porte son tag `_source`: trustpilot / gmaps / judgeme / loox).
    # Objectif: maximiser le volume de reviews. TP = signal categorie universel
    # (leaders US/UK/FR), GMaps = signal client + competiteurs LOCAUX.
    tp_data = ws.read_json(ws.raw("trustpilot.json")) or []
    extra_reviews: list = []

    # Widgets on client pages (Judge.me / Loox / ...) — toujours tenter si detecte
    client_pages = ws.read_json(ws.raw("client_pages.json")) or []
    widgets = detect_widgets(client_pages)
    ws.write_json(ws.raw("review_widgets_detected.json"), widgets)
    if widgets and plan.get("landing_pages"):
        base = plan["landing_pages"][0].rsplit("/", 1)[0]
        w_reviews = _safe(ws, "collect_widget_reviews",
                          collect_widget_reviews, base, widgets) or []
        extra_reviews.extend(w_reviews)

    # Google Maps — toujours execute si queries disponibles (pas un fallback)
    if plan.get("google_maps_queries"):
        gmaps = _safe(ws, "collect_gmaps_reviews", fetch_google_maps_reviews,
                      plan["google_maps_queries"],
                      options.get("gmaps_max_reviews", 100)) or []
        mismatch = next((r["_gmaps_match_log"] for r in gmaps
                         if "_gmaps_match_log" in r), [])
        gmaps_reviews = [r for r in gmaps
                         if "error" not in r and "_gmaps_match_log" not in r]
        ws.write_json(ws.raw("gmaps_reviews.json"), gmaps_reviews)
        ws.write_json(ws.raw("gmaps_match_log.json"),
                      {"kept": len(gmaps_reviews), "rejected": len(mismatch),
                       "rejected_samples": mismatch[:20]})
        extra_reviews.extend(gmaps_reviews)

    if extra_reviews:
        ws.write_json(ws.raw("trustpilot.json"), tp_data + extra_reviews)

    # ===== 2c. Gate de suffisance des donnees =====
    reviews_n = len(ws.read_json(ws.raw("trustpilot.json")) or [])
    reddit_n = len(ws.read_json(ws.raw("reddit.json")) or [])
    ads_n = len(ws.read_json(ws.raw("fb_ads.json")) or [])
    client_pages_n = len(ws.read_json(ws.raw("client_pages.json")) or [])
    youtube_items = ws.read_json(ws.raw("youtube.json")) or []
    youtube_n = sum(1 for y in youtube_items if "error" not in y)
    data_score = {
        "reviews": reviews_n, "reddit": reddit_n, "ads": ads_n,
        "client_pages": client_pages_n, "youtube": youtube_n,
        "sufficient_sources": sum(
            [reviews_n > 0, reddit_n >= 5, ads_n > 0,
             client_pages_n > 0, youtube_n > 0]
        ),
    }
    ws.write_json(ws.root / "data-score.json", data_score)

    # ===== 3. Export Excel pour l'Account Manager =====
    # Pas d'analyse LLM: on livre les donnees brutes organisees.
    _safe(ws, "excel", render_excel, ws, client_name)

    ws.set_status("pipeline", "done")
    return {"audit_id": ws.audit_id, "client": ws.slug, "path": str(ws.root)}
