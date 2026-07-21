"""Test de la chaine complete de fetchers sur des URLs reelles.
Usage: python scripts/test_cloak_chain.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Env stubs pour eviter d'exiger un .env complet
os.environ.setdefault("APIFY_TOKEN", "")
os.environ.setdefault("RAPIDAPI_KEY", "")
os.environ.setdefault("SEMRUSH_API_KEY", "")

sys.path.insert(0, str(Path(__file__).parent.parent))

# On importe apres avoir configure l'env pour eviter les erreurs de config
from app.collectors.pages import fetch_page  # noqa: E402


URLS = [
    # Case 1: site legit qui a echoue avant en SSL — vraiment un anti-bot ?
    "https://healthade.com",
    # Case 2: Cloudflare-protected classic
    "https://www.g2.com",
    # Case 3: page simple qui doit passer au niveau 1
    "https://example.com",
    # Case 4: site FR classique
    "https://www.risekombucha.com",
]


def main():
    print(f"{'URL':<45} {'Method':<22} {'Level':>5} {'Duration (s)':>12}")
    print("-" * 90)
    for u in URLS:
        t0 = time.time()
        try:
            r = fetch_page(u)
        except Exception as e:
            print(f"{u:<45} EXC: {str(e)[:40]:<22} {'-':>5} {time.time()-t0:>12.2f}")
            continue
        d = time.time() - t0
        method = r.get("method", "?")
        level = r.get("level", "?")
        print(f"{u:<45} {method:<22} {str(level):>5} {d:>12.2f}")
        if r.get("error"):
            print(f"  err: {r['error'][:120]}")


if __name__ == "__main__":
    main()
