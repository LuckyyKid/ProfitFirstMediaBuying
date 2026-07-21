"""Collecte YouTube pour la VOC: transcripts + top comments.

Deux libs pures Python, sans cookies ni compte:
- `youtube-transcript-api`: recupere les sous-titres (auto ou manuels)
- `youtube-comment-downloader`: recupere les commentaires tries par popularite

Aucun API key. Aucun ffmpeg. Aucun subprocess sur yt-dlp. Aucun cookie.

Rate-limit: YouTube renvoie parfois 429 depuis les IPs cloud. Le collecteur
loggue et passe a la video suivante — pas de retry brutal (evite le ban).

Chaque item est taggue `_source: "youtube"` pour attribution dans l'agent VOC.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import httpx


def _video_id(url: str) -> str | None:
    """Extrait l'ID YouTube depuis n'importe quelle forme d'URL."""
    p = urlparse(url)
    host = p.netloc.lower()
    if "youtu.be" in host:
        return p.path.lstrip("/") or None
    if "youtube.com" in host:
        if p.path.startswith("/watch"):
            v = parse_qs(p.query).get("v", [None])[0]
            return v
        if p.path.startswith("/shorts/") or p.path.startswith("/embed/"):
            return p.path.split("/", 2)[2].split("?")[0]
    return None


def search_videos(query: str, max_results: int = 5) -> list[dict]:
    """Recherche YouTube minimale par scraping de la page results.
    Renvoie [{video_id, url, title}]. Pas de cookies, pas d'API key."""
    r = httpx.get("https://www.youtube.com/results",
                  params={"search_query": query, "sp": "EgIQAQ%253D%253D"},
                  headers={"User-Agent": "Mozilla/5.0",
                           "Accept-Language": "en-US,en;q=0.9"},
                  timeout=25, follow_redirects=True)
    if r.status_code != 200:
        return []
    # Le JSON initial est embarque dans ytInitialData
    m = re.search(r"var ytInitialData = ({.*?});</script>", r.text, re.S)
    if not m:
        return []
    import json as _json
    try:
        data = _json.loads(m.group(1))
    except Exception:
        return []
    out: list[dict] = []
    try:
        sections = (data["contents"]["twoColumnSearchResultsRenderer"]
                        ["primaryContents"]["sectionListRenderer"]["contents"])
        for section in sections:
            items = section.get("itemSectionRenderer", {}).get("contents", [])
            for it in items:
                v = it.get("videoRenderer")
                if not v:
                    continue
                vid = v.get("videoId")
                title = "".join(
                    r.get("text", "") for r in v.get("title", {}).get("runs", []))
                if vid:
                    out.append({
                        "video_id": vid,
                        "url": f"https://www.youtube.com/watch?v={vid}",
                        "title": title,
                    })
                if len(out) >= max_results:
                    return out
    except (KeyError, TypeError):
        pass
    return out


def fetch_transcript(video_id: str, max_words: int = 3000,
                     languages: tuple[str, ...] = ("en", "fr")) -> str:
    """Recupere le transcript et le tronque a `max_words` mots."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return ""
    try:
        api = YouTubeTranscriptApi()
        tr = api.fetch(video_id, languages=list(languages))
        text = " ".join(s.text.strip() for s in tr.snippets if s.text)
        words = text.split()
        if len(words) > max_words:
            text = " ".join(words[:max_words]) + "…"
        return text
    except Exception:
        return ""


def fetch_top_comments(video_id: str, max_comments: int = 30) -> list[dict]:
    """Top comments tries par 'top' (sort_by=0)."""
    try:
        from youtube_comment_downloader import YoutubeCommentDownloader
    except ImportError:
        return []
    out: list[dict] = []
    try:
        dl = YoutubeCommentDownloader()
        gen = dl.get_comments_from_url(
            f"https://www.youtube.com/watch?v={video_id}", sort_by=0)
        for i, c in enumerate(gen):
            if i >= max_comments:
                break
            out.append({
                "author": c.get("author"),
                "text": c.get("text"),
                "votes": c.get("votes"),
                "time": c.get("time"),
            })
    except Exception:
        pass
    return out


def collect_youtube_voc(queries: list[str], max_videos_per_query: int = 5,
                        transcript_max_words: int = 3000,
                        max_comments: int = 30) -> list[dict]:
    """Pour chaque requete: search → top N videos → (transcript + top comments).
    Renvoie une liste d'items normalises avec `_source: "youtube"`."""
    out: list[dict] = []
    seen_ids: set[str] = set()
    for q in queries:
        try:
            videos = search_videos(q, max_results=max_videos_per_query)
        except Exception as e:
            out.append({"error": str(e), "query": q, "_source": "youtube"})
            continue
        for v in videos:
            vid = v["video_id"]
            if vid in seen_ids:
                continue
            seen_ids.add(vid)
            item = {
                "_source": "youtube",
                "_source_query": q,
                "video_id": vid,
                "url": v["url"],
                "title": v.get("title", ""),
                "transcript": fetch_transcript(vid, max_words=transcript_max_words),
                "comments": fetch_top_comments(vid, max_comments=max_comments),
            }
            out.append(item)
    return out
