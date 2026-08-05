"""Consolidation des donnees brutes -> un seul Excel normalise pour analyse
conversationnelle (Claude / GPT / etc.).

Usage dans le pipeline (apres la Collecte):
    from app.export import export_reviews_excel
    _safe(ws, "export_excel", export_reviews_excel, ws)

Sortie: report/reviews.xlsx (+ report/reviews.csv miroir + report/reviews_summary.json).
Colonnes: id | source | entreprise | role | date | note | titre | texte | url | extra

- `id` unique (R-0001...) : chaque verbatim cite par l'IA doit pointer vers un id verifiable.
- `role` (client / competiteur / inconnu) deduit de collection-plan.json + onboarding.json.
- `source` : trustpilot | reddit_post | reddit_comment | ad_library | gmaps
             | judgeme | loox | youtube_comment | youtube_transcript

Robustesse:
- Une source absente (fichier raw manquant / vide / illisible) est simplement ignoree.
- Encodage UTF-8 partout (BOM sur le CSV pour les accents QC sur Excel Windows).
- openpyxl est optionnel : si absent, on livre le CSV seul (l'endpoint expose le .xlsx
  quand il existe, sinon 404 -> le front peut retomber sur reviews.csv).
"""
import csv
from typing import Callable, Iterable
from urllib.parse import urlparse

try:
    from openpyxl import Workbook
    HAS_XLSX = True
except ImportError:  # pragma: no cover — soft fallback
    HAS_XLSX = False

HEADERS = ["id", "source", "entreprise", "role", "date", "note",
           "titre", "texte", "url", "extra"]


def _clean(s, limit: int = 6000) -> str:
    if s is None:
        return ""
    s = str(s).replace("\r", " ").replace("\x00", " ").strip()
    return s[:limit]


def _domain_from_url(u) -> str:
    """Extrait le host d'une URL (ou d'un domaine nu). Retire www."""
    if not u:
        return ""
    s = str(u).strip().lower()
    if not s:
        return ""
    if "://" not in s:
        s = "https://" + s
    try:
        host = urlparse(s).netloc.split(":")[0]
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def _domain_roles(ws) -> tuple[dict[str, str], set[str]]:
    """Mappe domaine/nom d'entreprise -> role (client / competiteur), et
    retourne aussi le set de tokens client pour l'attribution des ads
    (pageName Meta = nom brand, pas domaine)."""
    plan = ws.read_json(ws.root / "collection-plan.json") or {}
    onboarding = ws.read_json(ws.root / "onboarding.json") or {}

    roles: dict[str, str] = {}
    client_tokens: set[str] = set()

    def _add(role: str, key) -> None:
        k = str(key or "").strip().lower()
        if not k:
            return
        # ne pas ecraser un mapping client existant par une valeur competiteur
        if k in roles and roles[k] == "client" and role != "client":
            return
        roles[k] = role
        if role == "client":
            client_tokens.add(k)

    # === CLIENT ===
    # formulaire d'onboarding TDIA (francais) : site_web / nom_entreprise
    site = (onboarding.get("site_web")
            or onboarding.get("website") or onboarding.get("site"))
    site_domain = _domain_from_url(site)
    if site_domain:
        _add("client", site_domain)

    for k in ("nom_entreprise", "client_name", "company_name"):
        v = onboarding.get(k)
        if v:
            _add("client", v)

    # Fallback plan : 1er trustpilot_domain est par convention celui du client
    if not site_domain:
        tp_dom = plan.get("trustpilot_domains") or []
        if tp_dom:
            _add("client", tp_dom[0])

    # === COMPETITEURS ===
    for d in plan.get("competitor_domains") or []:
        _add("competiteur", d)

    # fb_pages: URLs Facebook -> host + slug (matcher `pageName` plus tard)
    for u in plan.get("fb_pages") or []:
        _add("competiteur", _domain_from_url(u))
        try:
            slug = urlparse(str(u)).path.strip("/").split("/")[0]
            if slug:
                _add("competiteur", slug)
        except Exception:
            pass

    # onboarding.competiteurs : texte libre "attitude.com, oneka.ca, ..."
    for token in str(onboarding.get("competiteurs") or "").replace(";", ",").split(","):
        t = token.strip()
        if not t:
            continue
        dom = _domain_from_url(t)
        _add("competiteur", dom if dom else t)

    return roles, client_tokens


def _resolve_role(roles: dict[str, str], client_tokens: set[str],
                  candidates: list, default: str) -> str:
    """Cherche le premier candidat qui match un domaine/nom connu.
    Chaque candidat peut etre une URL, un domaine ou un nom libre — on tente
    la valeur brute + le domaine extrait, puis un match partiel sur les tokens
    client (pageName Meta 'Demo Boutique' match 'demo boutique')."""
    normalized = []
    for c in candidates:
        if not c:
            continue
        s = str(c).strip().lower()
        if not s:
            continue
        normalized.append(s)
        dom = _domain_from_url(s)
        if dom and dom != s:
            normalized.append(dom)
    for s in normalized:
        if s in roles:
            return roles[s]
    for s in normalized:
        for tok in client_tokens:
            if tok and tok in s:
                return "client"
    return default


# ─── Parsers par source ───────────────────────────────────────────────────

def _iter_trustpilot(raw) -> Iterable[dict]:
    """trustpilot.json est le "master reviews" du pipeline : il peut contenir
    des items Trustpilot (Apify OU scrape direct), des dumps widget (judgeme
    /loox) et parfois des reviews Google Maps injectees en aval. On dispatch
    par `_source`."""
    for r in raw or []:
        if not isinstance(r, dict) or r.get("error"):
            continue
        src = str(r.get("_source") or "").lower()

        if src == "gmaps":
            texte = _clean(r.get("text") or r.get("textOriginal") or r.get("snippet"))
            if not texte:
                continue
            yield {
                "source": "gmaps",
                "entreprise": _clean(r.get("_place_title") or r.get("title")
                                     or r.get("placeName") or r.get("name")),
                "date": _clean(r.get("publishedAtDate") or r.get("publishAtDate")
                               or r.get("date")),
                "note": r.get("stars") or r.get("rating") or "",
                "titre": _clean(r.get("reviewerName") or r.get("reviewer")),
                "texte": texte,
                "url": _clean(r.get("reviewUrl") or r.get("url")),
                "extra": f"query={_clean(r.get('_query'))}",
            }
            continue

        if src in ("judgeme", "loox"):
            texte = _clean(r.get("text"), limit=8000)
            if not texte:
                continue
            yield {
                "source": src,
                "entreprise": _clean(r.get("_source_domain")),
                "date": "", "note": "", "titre": "",
                "texte": texte,
                "url": _clean(r.get("url") or r.get("_source_domain")),
                "extra": "widget dump",
            }
            continue

        # Trustpilot Apify ou scrape direct
        texte = _clean(r.get("text") or r.get("reviewBody"))
        if not texte:
            continue
        # direct scrape : dates.publishedDate ; apify : date
        date = r.get("date")
        if not date:
            dates = r.get("dates") or {}
            if isinstance(dates, dict):
                date = dates.get("publishedDate") or dates.get("experiencedDate")
        # verified : apify -> verified ; scrape -> consumer.isVerified
        verified = r.get("verified")
        if verified is None:
            cons = r.get("consumer") or {}
            if isinstance(cons, dict):
                verified = cons.get("isVerified")
        yield {
            "source": "trustpilot",
            "entreprise": _clean(r.get("companyDomain") or r.get("_source_domain")
                                 or r.get("domain")),
            "date": _clean(date),
            "note": r.get("rating") or r.get("ratingValue") or "",
            "titre": _clean(r.get("title")),
            "texte": texte,
            "url": _clean(r.get("url") or r.get("reviewUrl")),
            "extra": "verified" if verified else "",
        }


def _iter_reddit(raw) -> Iterable[dict]:
    """Reddit VOC : liste d'items {query, post, [details.comments]}.
    Le collecteur RapidAPI en prod ne fournit PAS de comments (voir
    app/collectors/reddit.py). Le champ `details.comments` n'existe que
    dans les fixtures — le loop reste tolerant."""
    for item in raw or []:
        if not isinstance(item, dict) or item.get("error"):
            continue
        q = _clean(item.get("query"))
        post = item.get("post") if isinstance(item.get("post"), dict) else {}

        sub_raw = post.get("subreddit")
        if isinstance(sub_raw, dict):
            sub = _clean(sub_raw.get("name") or sub_raw.get("displayName"))
        else:
            sub = _clean(sub_raw)

        purl = post.get("url") or post.get("permalink") or ""
        if purl and str(purl).startswith("/"):
            purl = "https://www.reddit.com" + str(purl)
        purl = _clean(purl)

        body = " — ".join(x for x in (_clean(post.get("title")),
                                       _clean(post.get("selftext"))) if x)
        if body:
            yield {
                "source": "reddit_post",
                "entreprise": sub,
                "date": _clean(post.get("created") or post.get("createdAt")
                               or post.get("date")),
                "note": post.get("score") or post.get("upvotes") or "",
                "titre": _clean(post.get("title")),
                "texte": body,
                "url": purl,
                "extra": f"query={q}",
            }

        details = item.get("details") or {}
        comments = None
        if isinstance(details, dict):
            comments = details.get("comments")
            if comments is None and isinstance(details.get("body"), dict):
                comments = details["body"].get("comments")
        if isinstance(comments, dict):
            comments = comments.get("comments")
        for c in comments if isinstance(comments, list) else []:
            if not isinstance(c, dict):
                continue
            ctext = _clean(c.get("body") or c.get("text"))
            if not ctext:
                continue
            yield {
                "source": "reddit_comment",
                "entreprise": sub,
                "date": _clean(c.get("created") or c.get("createdAt") or ""),
                "note": c.get("score") or "",
                "titre": "",
                "texte": ctext,
                "url": purl,
                "extra": f"query={q}",
            }


def _iter_fb_ads(raw) -> Iterable[dict]:
    """Meta Ad Library : chaque item = une ad avec un ou plusieurs creatifs
    texte. Actor Apify => `pageName`, `adText`, `startDate`, `displayFormat`.
    Certaines shapes exposent le texte dans `snapshot.body.text`."""
    for a in raw or []:
        if not isinstance(a, dict) or a.get("error"):
            continue
        snap = a.get("snapshot") if isinstance(a.get("snapshot"), dict) else {}
        snap_body = snap.get("body") if isinstance(snap.get("body"), dict) else {}
        texte = _clean(a.get("adText") or a.get("text") or a.get("body")
                       or snap_body.get("text") or snap.get("caption"))
        if not texte:
            continue
        page = _clean(a.get("pageName") or a.get("page_name")
                      or snap.get("page_name") or a.get("page") or a.get("pageUrl"))
        yield {
            "source": "ad_library",
            "entreprise": page,
            "date": _clean(a.get("startDate") or a.get("start_date")
                           or a.get("startDateFormatted")),
            "note": "",
            "titre": _clean(a.get("headline") or a.get("title") or snap.get("title")),
            "texte": texte,
            "url": _clean(a.get("url") or a.get("adUrl") or a.get("snapshotUrl")),
            "extra": _clean(a.get("displayFormat") or ""),
        }


def _iter_youtube(raw) -> Iterable[dict]:
    """YouTube VOC : liste d'items {video, transcript, comments}.
    Transcript = long-form (limite dur) ; comments = un item par comment."""
    for v in raw or []:
        if not isinstance(v, dict) or v.get("error"):
            continue
        vid = v.get("video") if isinstance(v.get("video"), dict) else v
        title = _clean(vid.get("title") or v.get("title"))
        channel = _clean(vid.get("channel") or vid.get("channelTitle")
                         or v.get("channel"))
        vurl = _clean(vid.get("url") or vid.get("watchUrl") or v.get("url"))
        vdate = _clean(vid.get("publishedAt") or v.get("publishedAt"))

        tx = v.get("transcript") or vid.get("transcript") or ""
        if isinstance(tx, list):
            tx = " ".join(_clean(x.get("text") if isinstance(x, dict) else x, limit=300)
                          for x in tx)
        tx = _clean(tx, limit=8000)
        if tx:
            yield {
                "source": "youtube_transcript",
                "entreprise": channel,
                "date": vdate,
                "note": "",
                "titre": title,
                "texte": tx,
                "url": vurl,
                "extra": "transcript",
            }

        comments = v.get("comments") or []
        if isinstance(comments, list):
            for c in comments:
                if not isinstance(c, dict):
                    continue
                ctext = _clean(c.get("text") or c.get("comment") or c.get("body"))
                if not ctext:
                    continue
                yield {
                    "source": "youtube_comment",
                    "entreprise": channel,
                    "date": _clean(c.get("publishedAt") or c.get("date") or ""),
                    "note": c.get("likeCount") or c.get("likes") or "",
                    "titre": title,
                    "texte": ctext,
                    "url": vurl,
                    "extra": "comment",
                }


_SOURCES: list[tuple[str, Callable[[list], Iterable[dict]]]] = [
    ("trustpilot.json", _iter_trustpilot),
    ("reddit.json", _iter_reddit),
    ("gmaps_reviews.json", _iter_trustpilot),  # meme dispatcher, tag `_source: gmaps`
    ("fb_ads.json", _iter_fb_ads),
    ("youtube.json", _iter_youtube),
]


def export_reviews_excel(ws) -> str:
    """Consolide toutes les sources presentes dans raw/ en un Excel unique.
    Retour: chemin du fichier principal (xlsx si openpyxl dispo, csv sinon)."""
    roles, client_tokens = _domain_roles(ws)
    rows: list[dict] = []

    for fname, parser in _SOURCES:
        path = ws.raw(fname)
        if not path.exists():
            continue
        try:
            raw = ws.read_json(path)
        except Exception:
            continue
        for row in parser(raw):
            row["role"] = _resolve_role(
                roles, client_tokens,
                [row.get("entreprise"), row.get("url")],
                default="competiteur" if row["source"] == "ad_library" else "inconnu",
            )
            rows.append(row)

    for i, row in enumerate(rows, 1):
        row["id"] = f"R-{i:04d}"

    # CSV (miroir, sans dependance)
    out_csv = ws.report("reviews.csv")
    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        for row in rows:
            w.writerow({h: row.get(h, "") for h in HEADERS})

    # Excel (si openpyxl dispo)
    out_xlsx = ws.report("reviews.xlsx")
    if HAS_XLSX:
        wb = Workbook()
        sh = wb.active
        sh.title = "reviews"
        sh.append(HEADERS)
        for row in rows:
            sh.append([row.get(h, "") for h in HEADERS])
        sh.freeze_panes = "A2"
        wb.save(out_xlsx)

    # Sommaire pour l'AM (utile aussi pour le health-check post-audit)
    by_src: dict[str, int] = {}
    for r in rows:
        by_src[r["source"]] = by_src.get(r["source"], 0) + 1
    ws.write_json(
        ws.report("reviews_summary.json"),
        {
            "total": len(rows),
            "par_source": by_src,
            "fichier_principal": str(out_xlsx if HAS_XLSX else out_csv),
        },
    )
    return str(out_xlsx if HAS_XLSX else out_csv)
