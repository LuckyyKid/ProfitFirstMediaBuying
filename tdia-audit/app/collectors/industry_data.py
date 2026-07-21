"""Collecteur de donnees industrie (point 9 de la roadmap).

3 sous-collecteurs, sortie JSON par categorie:
- industry_us.json   : US Census MARTS (ventes retail mensuelles + saisonnalite)
- industry_ca.json   : StatCan tableau 20-10-0056 via stats_can + macros CA
- sec_filings.json   : EDGAR full-text search 10-K/10-Q par mot-cle categorie

Cache: data/industry_cache/<scian>_<source>.json
- TTL 30 jours par defaut (donnees mensuelles)
- TTL 90 jours pour e-commerce trimestriel
- Lecture cache AVANT tout appel reseau
"""
import json
import time
from pathlib import Path
from statistics import mean

import requests

from app.config import CENSUS_API_KEY, DATA_DIR, SEC_USER_AGENT
from app.collectors.industry_taxonomy import get_category

CACHE_DIR = DATA_DIR / "industry_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

STATCAN_VECTORS = Path(__file__).parent / "statcan_vectors.json"

TTL_MONTHLY = 30 * 24 * 3600     # 30 jours
TTL_QUARTERLY = 90 * 24 * 3600   # 90 jours
TTL_EDGAR = 30 * 24 * 3600       # 30 jours


# ==================== CACHE ====================
def _cache_path(scian: str, source: str) -> Path:
    return CACHE_DIR / f"{scian}_{source}.json"


def _read_cache(scian: str, source: str, ttl_s: int) -> dict | None:
    p = _cache_path(scian, source)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    ts = data.get("_cached_at", 0)
    if time.time() - ts > ttl_s:
        return None
    return data


def _write_cache(scian: str, source: str, data: dict) -> None:
    data = {**data, "_cached_at": time.time()}
    _cache_path(scian, source).write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ==================== SEASONALITY ====================
def _seasonality_index(monthly_series: list[tuple[str, float]]) -> dict:
    """Indice de saisonnalite mensuel: (moyenne du mois i / moyenne annuelle) x 100.

    monthly_series: [(YYYY-MM, value), ...] non-desaisonnalise.
    Retourne {01: 92.3, 02: 88.1, ...} (1 = base 100 = moyenne annuelle).
    Necessite >= 2 annees completes pour etre significatif.
    """
    by_month: dict[str, list[float]] = {f"{m:02d}": [] for m in range(1, 13)}
    all_values: list[float] = []
    for date, val in monthly_series:
        if val is None or not date or len(date) < 7:
            continue
        month = date[5:7]
        if month in by_month:
            by_month[month].append(val)
            all_values.append(val)
    if len(all_values) < 24:
        return {"_note": f"pas assez de donnees ({len(all_values)} pts, requis >=24)"}
    annual_mean = mean(all_values)
    if annual_mean == 0:
        return {"_note": "moyenne annuelle nulle"}
    return {m: round(mean(vals) / annual_mean * 100, 1)
            for m, vals in by_month.items() if vals}


def _yoy_latest(monthly_series: list[tuple[str, float]]) -> dict:
    """YoY du dernier mois disponible vs meme mois annee precedente."""
    if len(monthly_series) < 13:
        return {"_note": "pas assez d'historique"}
    monthly_series = sorted(monthly_series)
    last_date, last_val = monthly_series[-1]
    if last_val is None or len(last_date) < 7:
        return {"_note": "dernier point invalide"}
    target_month = last_date[5:7]
    # Cherche le meme mois de l'annee precedente (compare sur les 7 premiers chars
    # pour supporter aussi bien "YYYY-MM" que "YYYY-MM-DD")
    prev_year = int(last_date[:4]) - 1
    prev_prefix = f"{prev_year}-{target_month}"
    prev_val = next((v for d, v in monthly_series if d[:7] == prev_prefix), None)
    if prev_val in (None, 0):
        return {"_note": f"pas de valeur pour {prev_prefix}"}
    return {
        "latest_month": last_date,
        "latest_value": last_val,
        "yoy_month": prev_prefix,
        "yoy_value": prev_val,
        "yoy_pct": round((last_val - prev_val) / prev_val * 100, 2),
    }


# ==================== US CENSUS MARTS ====================
def collect_industry_us(category_key: str, force: bool = False) -> dict:
    """Ventes mensuelles US pour la categorie MARTS, non-desaisonnalisees.
    Calcule indice de saisonnalite + YoY."""
    cat = get_category(category_key)
    code = cat["marts_category_code"]
    cached = None if force else _read_cache(code, "us_marts", TTL_MONTHLY)
    if cached is not None:
        return cached

    if not CENSUS_API_KEY:
        return {"error": "CENSUS_API_KEY manquant", "category": category_key}

    try:
        # SM = Sales (millions USD), seasonally_adj=no pour calculer saisonnalite.
        # NB: 'time' est un filtre valide mais PAS un 'get' variable pour MARTS —
        # l'API le retourne quand meme comme colonne implicite.
        r = requests.get(
            "https://api.census.gov/data/timeseries/eits/marts",
            params={
                "get": "cell_value,data_type_code,seasonally_adj",
                "category_code": code,
                "data_type_code": "SM",
                "time": "from 2019",
                "key": CENSUS_API_KEY,
            },
            timeout=30,
        )
        r.raise_for_status()
        rows = r.json()
    except Exception as e:
        return {"error": f"Census API: {e}", "category": category_key,
                "marts_category_code": code}

    header = rows[0]
    idx_val = header.index("cell_value")
    idx_adj = header.index("seasonally_adj")
    # 'time' n'est pas dans 'get' mais l'API MARTS l'ajoute a la fin
    idx_time = header.index("time") if "time" in header else -1

    # On garde seulement les non-desaisonnalisees pour calculer notre propre saisonnalite
    series_raw: list[tuple[str, float]] = []
    for row in rows[1:]:
        if row[idx_adj] != "no":
            continue
        try:
            series_raw.append((row[idx_time], float(row[idx_val])))
        except (ValueError, TypeError):
            pass
    series_raw.sort()

    out = {
        "source": "US Census MARTS",
        "endpoint": "https://api.census.gov/data/timeseries/eits/marts",
        "category": category_key,
        "marts_category_code": code,
        "label_fr": cat["label_fr"],
        "unit": "millions USD, non-seasonally-adjusted retail sales (SM)",
        "n_points": len(series_raw),
        "date_range": [series_raw[0][0], series_raw[-1][0]] if series_raw else None,
        "monthly_series": [{"date": d, "value": v} for d, v in series_raw],
        "seasonality_index_monthly": _seasonality_index(series_raw),
        "yoy_latest": _yoy_latest(series_raw),
    }
    _write_cache(code, "us_marts", out)
    return out


# ==================== STATCAN CANADA ====================
def _load_statcan_vectors() -> dict:
    if not STATCAN_VECTORS.exists():
        return {}
    return json.loads(STATCAN_VECTORS.read_text(encoding="utf-8"))


def _statcan_vectors_to_series(vector_ids: list[str], periods: int = 60) -> dict:
    """Wraps stats_can.vectors_to_df -> dict {vectorId: [(date, value), ...]}."""
    import math
    import stats_can as sc
    df = sc.vectors_to_df(vector_ids, periods=periods)
    out: dict = {}
    for col in df.columns:
        series = []
        for idx, val in df[col].items():
            try:
                fval = float(val) if val is not None else None
            except (ValueError, TypeError):
                fval = None
            if fval is None or math.isnan(fval):
                continue
            series.append((str(idx)[:10], fval))
        out[col] = sorted(series)
    return out


def collect_industry_ca(category_key: str, force: bool = False) -> dict:
    """Ventes mensuelles Canada + Quebec via StatCan 20-10-0056 + macros CA."""
    cat = get_category(category_key)
    scian = cat["scian_code"]
    cached = None if force else _read_cache(scian, "ca_statcan", TTL_MONTHLY)
    if cached is not None:
        return cached

    vec_map = _load_statcan_vectors()
    entry = vec_map.get(scian, {})
    vec_qc = (entry.get("quebec") or {}).get("vectorId")
    vec_ca = (entry.get("canada") or {}).get("vectorId")

    result: dict = {
        "source": "StatCan WDS (tableau 20-10-0056)",
        "category": category_key,
        "scian_code": scian,
        "label_fr": cat["label_fr"],
        "unit": "milliers CAD, non-desaisonnalise",
        "vectors_used": {"canada": vec_ca, "quebec": vec_qc},
        "retail_sales": {},
    }

    vec_ids = [v for v in (vec_ca, vec_qc) if v]
    if vec_ids:
        try:
            series_by_vec = _statcan_vectors_to_series(vec_ids, periods=60)
            for label, vec in (("canada", vec_ca), ("quebec", vec_qc)):
                if not vec:
                    continue
                s = series_by_vec.get(vec, [])
                result["retail_sales"][label] = {
                    "vectorId": vec,
                    "n_points": len(s),
                    "date_range": [s[0][0], s[-1][0]] if s else None,
                    "monthly_series": [{"date": d, "value": v} for d, v in s],
                    "seasonality_index_monthly": _seasonality_index(s),
                    "yoy_latest": _yoy_latest(s),
                }
        except Exception as e:
            result["retail_sales"]["error"] = f"stats_can: {e}"
    else:
        result["retail_sales"]["error"] = (
            f"aucun vecteur pour SCIAN {scian} dans statcan_vectors.json "
            "(fallback CSV non implemente)"
        )

    # Macros: IPC + chomage (utile pour tout rapport CA)
    macros = (vec_map.get("_macro") or {})
    macro_vecs = [m["vectorId"] for m in macros.values() if m.get("vectorId")]
    result["macros"] = {}
    if macro_vecs:
        try:
            macro_series = _statcan_vectors_to_series(macro_vecs, periods=36)
            for name, m in macros.items():
                v = m.get("vectorId")
                if not v:
                    continue
                s = macro_series.get(v, [])
                result["macros"][name] = {
                    "vectorId": v,
                    "description": m.get("description", ""),
                    "table": m.get("table", ""),
                    "latest": {"date": s[-1][0], "value": s[-1][1]} if s else None,
                    "yoy": _yoy_latest(s),
                }
        except Exception as e:
            result["macros"]["error"] = f"stats_can macros: {e}"

    _write_cache(scian, "ca_statcan", result)
    return result


# ==================== SEC EDGAR ====================
class _EdgarRateLimiter:
    """SEC exige <=10 req/s. On garde une horloge minimale entre requetes."""
    _last = 0.0
    _min_interval = 0.11  # ~9 req/s pour marge de securite

    @classmethod
    def wait(cls):
        now = time.time()
        elapsed = now - cls._last
        if elapsed < cls._min_interval:
            time.sleep(cls._min_interval - elapsed)
        cls._last = time.time()


def _edgar_search(keyword: str, forms: str = "10-K,10-Q,S-1",
                  from_year: int = 2022) -> dict:
    """Un appel EDGAR full-text search avec retry sur 429/403."""
    if not SEC_USER_AGENT:
        return {"error": "SEC_USER_AGENT manquant"}
    headers = {
        "User-Agent": SEC_USER_AGENT,
        "Accept": "application/json",
    }
    params = {
        "q": f'"{keyword}"',
        "forms": forms,
        "dateRange": "custom",
        "startdt": f"{from_year}-01-01",
        "enddt": f"{time.strftime('%Y')}-12-31",
    }
    max_attempts = 4
    backoff = [1, 3, 10, 30]
    for attempt in range(max_attempts):
        _EdgarRateLimiter.wait()
        try:
            r = requests.get(
                "https://efts.sec.gov/LATEST/search-index",
                params=params, headers=headers, timeout=30,
            )
            if r.status_code in (429, 403):
                if attempt < max_attempts - 1:
                    time.sleep(backoff[attempt])
                    continue
                return {"error": f"HTTP {r.status_code} apres {attempt+1} tentatives",
                        "keyword": keyword}
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < max_attempts - 1:
                time.sleep(backoff[attempt])
                continue
            return {"error": str(e), "keyword": keyword}
    return {"error": "unreachable", "keyword": keyword}


def _extract_hits(edgar_response: dict) -> list[dict]:
    hits = (edgar_response.get("hits") or {}).get("hits") or []
    out = []
    for h in hits[:20]:
        src = h.get("_source", {})
        adsh = h.get("_id", "").split(":")[0]
        cik = (src.get("ciks") or ["?"])[0]
        out.append({
            "cik": cik,
            "accession": adsh,
            "form": src.get("form"),
            "filed": src.get("file_date"),
            "period_ending": src.get("period_ending"),
            "company": (src.get("display_names") or [""])[0],
            "sics": src.get("sics", []),
            "biz_locations": src.get("biz_locations", []),
        })
    return out


def collect_sec_filings(category_key: str, force: bool = False) -> dict:
    """EDGAR search sur les keywords categorie (precis -> general).
    Fallback: si un keyword retourne 0 resultat, on passe au suivant."""
    cat = get_category(category_key)
    scian = cat["scian_code"]
    cached = None if force else _read_cache(scian, "sec_edgar", TTL_EDGAR)
    if cached is not None:
        return cached

    result: dict = {
        "source": "SEC EDGAR full-text search",
        "endpoint": "https://efts.sec.gov/LATEST/search-index",
        "category": category_key,
        "keywords_tried": [],
        "keyword_used": None,
        "n_hits_total": 0,
        "filings": [],
        "unique_companies": [],
    }

    for kw in cat["category_keywords_en"]:
        resp = _edgar_search(kw)
        n_total = (resp.get("hits") or {}).get("total", {}).get("value", 0)
        result["keywords_tried"].append({"keyword": kw, "n_hits": n_total,
                                          "error": resp.get("error")})
        if n_total > 0:
            result["keyword_used"] = kw
            result["n_hits_total"] = n_total
            filings = _extract_hits(resp)
            result["filings"] = filings
            seen = set()
            uniques = []
            for f in filings:
                key = (f["cik"], f["company"])
                if key not in seen:
                    seen.add(key)
                    uniques.append({"cik": f["cik"], "company": f["company"],
                                    "sics": f["sics"],
                                    "biz_locations": f["biz_locations"]})
            result["unique_companies"] = uniques
            break

    _write_cache(scian, "sec_edgar", result)
    return result


# ==================== ORCHESTRATEUR ====================
def collect_industry(category_key: str, force: bool = False) -> dict:
    """Lance les 3 sous-collecteurs. Retourne un resume + les 3 payloads."""
    return {
        "us": collect_industry_us(category_key, force=force),
        "ca": collect_industry_ca(category_key, force=force),
        "sec": collect_sec_filings(category_key, force=force),
    }
