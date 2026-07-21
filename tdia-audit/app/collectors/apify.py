"""Collecte via Apify: Trustpilot reviews + Meta Ad Library (client et competiteurs)."""
from apify_client import ApifyClient
from app.config import APIFY_TOKEN, ACTOR_TRUSTPILOT, ACTOR_FB_ADS


def _client() -> ApifyClient:
    return ApifyClient(APIFY_TOKEN)


def run_actor(actor_id: str, run_input: dict, timeout_secs: int = 3600) -> list[dict]:
    from datetime import timedelta
    client = _client()
    run = client.actor(actor_id).call(
        run_input=run_input, run_timeout=timedelta(seconds=timeout_secs))
    dataset_id = run.default_dataset_id if hasattr(run, "default_dataset_id") else run["defaultDatasetId"]
    return list(client.dataset(dataset_id).iterate_items())


def collect_trustpilot(domains: list[str], max_reviews_per_domain: int = 300) -> list[dict]:
    """zen-studio/trustpilot-review-scraper - reviews. `businessUrl` accepte domaine
    ou URL Trustpilot complete. Un run par domaine (l'actor prend UN businessUrl a la fois).

    Chaque review est tagguee `_source: "trustpilot"` et `_source_domain: <domaine>` pour
    permettre une attribution correcte plus tard (les livrables ne doivent PAS confondre
    un review Trustpilot d'un competiteur avec un review du client).

    Fallback: si l'actor renvoie 0 review pour un domaine (typiquement free tier
    epuise → l'actor retourne 1 item vide ou lance une erreur), on tente un scrape
    direct via `fetch_trustpilot_direct`. Les pages Trustpilot sont publiques et
    embarquent les reviews dans `__NEXT_DATA__`."""
    from app.collectors.reviews_fallback import fetch_trustpilot_direct
    out = []
    for d in domains:
        run_input = {"businessUrl": d, "maxResults": max_reviews_per_domain}
        actor_items: list[dict] = []
        actor_err: str | None = None
        try:
            actor_items = run_actor(ACTOR_TRUSTPILOT, run_input)
            for it in actor_items:
                it["_source"] = "trustpilot"
                it["_source_domain"] = d
                it["_source_method"] = "apify"
        except Exception as e:
            actor_err = str(e)

        # Un item valide contient au minimum un texte ou une note. Le free tier
        # epuise retourne des placeholders vides.
        real_items = [it for it in actor_items
                      if (it.get("text") or it.get("reviewBody")
                          or it.get("rating") or it.get("ratingValue"))]

        if real_items:
            out.extend(real_items)
            continue

        # Fallback direct scrape
        try:
            direct = fetch_trustpilot_direct(d, max_reviews=max_reviews_per_domain)
            if direct:
                out.extend(direct)
            elif actor_err:
                out.append({"error": f"actor: {actor_err}; direct: 0 reviews",
                            "domain": d})
            else:
                out.append({"error": "actor: 0 reviews; direct: 0 reviews",
                            "domain": d})
        except Exception as e:
            out.append({"error": f"actor+direct failed: {actor_err or 'ok'} / {e}",
                        "domain": d})
    return out


def collect_fb_ads(page_urls: list[str], country: str = "ALL",
                   records_per_page: int = 30) -> list[dict]:
    """XtaWFhbtfxyzqrFmd - ads du client et des competiteurs.
    `page_urls`: URLs de pages Facebook OU URLs de recherche Ad Library.

    `records_per_page` plafonne a 30 par defaut: on tri par impressions_desc et
    activeStatus=all, donc on recupere les 30 ads les plus servies (actives +
    inactives). Suffisant pour identifier les winners / evergreens sans exploser
    le contexte LLM ni le cout Apify."""
    urls = [{"url": u} for u in page_urls]
    run_input = {
        "urls": urls,
        "scrapeAdDetails": True,
        "count": records_per_page * max(len(urls), 1),
        "scrapePageAds.period": "",
        "scrapePageAds.activeStatus": "all",
        "scrapePageAds.sortBy": "impressions_desc",
        "scrapePageAds.countryCode": country,
    }
    items = run_actor(ACTOR_FB_ADS, run_input)
    # Ceinture + bretelles: certains actors ignorent le `count` par page si
    # l'input est mal formatte. On plafonne cote client apres coup.
    per_page: dict[str, int] = {}
    kept: list[dict] = []
    for a in items:
        page = a.get("pageName") or a.get("page_name") or a.get("url") or "?"
        if per_page.get(page, 0) >= records_per_page:
            continue
        per_page[page] = per_page.get(page, 0) + 1
        kept.append(a)
    return kept


def ad_library_search_url(query: str, country: str = "CA") -> str:
    """Construit une URL de recherche Ad Library par mot-cle (pour decouvrir des competiteurs)."""
    from urllib.parse import quote
    return (f"https://www.facebook.com/ads/library/?active_status=active"
            f"&ad_type=all&country={country}&q={quote(query)}&media_type=all")
