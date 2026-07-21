#!/usr/bin/env python3
"""Teste chaque collecteur individuellement avant de lancer un audit complet.
Usage: python scripts/test_collectors.py trustpilot|fb|reddit|trends|page <arg>"""
import json, sys
sys.path.insert(0, ".")

what, arg = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None
if what == "trustpilot":
    from app.collectors.apify import collect_trustpilot
    print(json.dumps(collect_trustpilot([arg], 20)[:3], indent=2, ensure_ascii=False))
elif what == "fb":
    from app.collectors.apify import collect_fb_ads
    print(json.dumps(collect_fb_ads([arg], records_per_page=20)[:3], indent=2, ensure_ascii=False))
elif what == "reddit":
    from app.collectors.reddit import search_posts
    print(json.dumps(search_posts(arg, limit=5), indent=2, ensure_ascii=False))
elif what == "trends":
    from app.collectors.trends import collect_google_trends
    print(json.dumps(collect_google_trends([arg]), indent=2)[:3000])
elif what == "page":
    from app.collectors.pages import fetch_page, html_to_text
    p = fetch_page(arg)
    print(p["method"], "|", html_to_text(p.get("html", ""))[:800])
