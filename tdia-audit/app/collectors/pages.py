"""Recuperation de pages web (landing pages, articles, rapports d'industrie).

Chaine de fallback (4 niveaux):
  1. httpx simple
  2. Scrapling Fetcher (headers stealth mais requetes HTTP)
  3. Scrapling StealthyFetcher (browser Playwright + patches JS)
  4. CloakBrowser (Chromium stealth patche au niveau C++ — DERNIER RECOURS)

Le niveau 4 n'est declenche que si le niveau 3 echoue OU renvoie une page de
challenge anti-bot (Cloudflare "Just a moment", captcha, Attention Required).
Chaque tentative est loggee dans `data/logs/fetch_stats.jsonl` pour permettre
d'evaluer objectivement si le niveau 4 tire son poids apres quelques semaines
d'utilisation (voir `scripts/fetch_stats.py`)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import httpx

from app.config import DATA_DIR

FETCH_LOG = DATA_DIR / "logs" / "fetch_stats.jsonl"

# Patterns qui trahissent une page de challenge anti-bot renvoyee 200 OK.
_CHALLENGE_PATTERNS = re.compile(
    r"(just a moment|cf-browser-verification|attention required|"
    r"cloudflare|challenge-platform|captcha|please enable javascript "
    r"and cookies)",
    re.I,
)

# Level codes for fetch_stats.jsonl. 0 = total failure.
LEVEL_HTTPX = 1
LEVEL_FETCHER = 2
LEVEL_STEALTHY = 3
LEVEL_CLOAK = 4
LEVEL_FAIL = 0

_LEVEL_NAMES = {1: "httpx", 2: "scrapling", 3: "scrapling-stealth",
                4: "cloakbrowser", 0: "failed"}


def _looks_like_challenge(html: str) -> bool:
    if not html:
        return False
    return bool(_CHALLENGE_PATTERNS.search(html[:4000]))


def _log_fetch(url: str, level: int, duration_ms: int,
               error: str | None = None) -> None:
    try:
        FETCH_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {"url": url, "level": level, "level_name": _LEVEL_NAMES[level],
                 "duration_ms": duration_ms, "timestamp": int(time.time())}
        if error:
            entry["error"] = error[:400]
        with FETCH_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        # Le logging ne doit jamais casser une collecte
        pass


def _fetch_httpx(url: str) -> tuple[str | None, str | None]:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and len(r.text) > 500 and not _looks_like_challenge(r.text):
            return r.text, None
        if r.status_code in (403, 503):
            return None, f"status {r.status_code}"
        if _looks_like_challenge(r.text):
            return None, "challenge detected"
        return None, f"status {r.status_code} ({len(r.text)} chars)"
    except Exception as e:
        return None, str(e)


def _fetch_scrapling(url: str) -> tuple[str | None, str | None]:
    try:
        from scrapling.fetchers import Fetcher
        page = Fetcher.get(url, stealthy_headers=True)
        if page and page.status == 200 and not _looks_like_challenge(page.html_content):
            return page.html_content, None
        return None, ("challenge detected" if page and _looks_like_challenge(page.html_content)
                      else f"status {getattr(page, 'status', '?')}")
    except Exception as e:
        return None, str(e)


def _fetch_stealthy(url: str) -> tuple[str | None, str | None]:
    try:
        from scrapling.fetchers import StealthyFetcher
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
        if page and page.html_content and not _looks_like_challenge(page.html_content):
            return page.html_content, None
        return None, ("challenge detected" if page and _looks_like_challenge(page.html_content)
                      else "empty response")
    except Exception as e:
        return None, str(e)


def _fetch_cloak(url: str, timeout_ms: int = 45_000) -> tuple[str | None, str | None]:
    """Dernier recours: CloakBrowser (Chromium avec patches stealth au niveau C++).

    Import LAZY pour ne pas alourdir le demarrage du worker (le binaire Chromium
    est telecharge au premier appel, ~200MB) et pour rester fonctionnel meme si
    le paquet n'est pas installe (fallback gracieux)."""
    try:
        from cloakbrowser import launch  # type: ignore
    except ImportError as e:
        return None, f"cloakbrowser not installed: {e}"

    browser = None
    try:
        browser = launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(timeout_ms)
        page.goto(url, wait_until="domcontentloaded")
        # Laisse un court delai au challenge Cloudflare pour se resoudre seul
        try:
            page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass
        html = page.content()
        if html and not _looks_like_challenge(html):
            return html, None
        return None, ("challenge still present after cloak"
                      if _looks_like_challenge(html) else "empty response")
    except Exception as e:
        return None, str(e)
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass


def fetch_page(url: str) -> dict:
    """Renvoie {'url', 'method', 'html', 'level', 'error'?}.

    Traverse la chaine en escaladant si le niveau precedent echoue ou detecte
    une page de challenge anti-bot."""
    t0 = time.time()
    for level, name, fn in (
        (LEVEL_HTTPX, "httpx", _fetch_httpx),
        (LEVEL_FETCHER, "scrapling", _fetch_scrapling),
        (LEVEL_STEALTHY, "scrapling-stealth", _fetch_stealthy),
        (LEVEL_CLOAK, "cloakbrowser", _fetch_cloak),
    ):
        step_start = time.time()
        html, err = fn(url)
        step_ms = int((time.time() - step_start) * 1000)
        if html:
            _log_fetch(url, level, step_ms)
            return {"url": url, "method": name, "html": html, "level": level}
        # continue en escalade — on ne logge que la reussite finale (ou l'echec)
        last_err = err

    _log_fetch(url, LEVEL_FAIL, int((time.time() - t0) * 1000),
               error=last_err or "all methods failed")
    return {"url": url, "method": "failed", "level": LEVEL_FAIL,
            "error": last_err or "all methods failed"}


def html_to_text(html: str, max_chars: int = 40_000) -> str:
    """Texte lisible pour les agents (sans dependance lourde)."""
    text = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html,
                  flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text[:max_chars]
