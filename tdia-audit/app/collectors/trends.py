"""Google Trends via pytrends + (optionnel) Semrush API."""
import time
import httpx
from app.config import SEMRUSH_API_KEY


def _batch_trends(py, batch: list[str], geo: str, timeframe: str) -> tuple[dict, dict]:
    """One pytrends batch. Raises on 429/timeout so the caller can retry."""
    py.build_payload(batch, geo=geo, timeframe=timeframe)
    iot = py.interest_over_time()
    iot_out = {}
    if not iot.empty:
        iot_out = {k: {str(ts): int(v) for ts, v in iot[k].to_dict().items()}
                   for k in batch if k in iot.columns}
    rq = py.related_queries() or {}
    rq_out = {}
    for k, v in rq.items():
        rq_out[k] = {
            "top": v["top"].to_dict("records") if v.get("top") is not None else [],
            "rising": v["rising"].to_dict("records") if v.get("rising") is not None else [],
        }
    return iot_out, rq_out


def collect_google_trends(keywords: list[str], geo: str = "CA",
                          timeframe: str = "today 12-m") -> dict:
    """Retry+backoff per batch. Never crashes; returns partial data + errors list."""
    from pytrends.request import TrendReq
    out: dict = {"interest_over_time": {}, "related_queries": {}, "errors": []}
    max_attempts = 3
    backoff = [5, 15, 45]  # seconds
    for start in range(0, len(keywords), 5):
        batch = keywords[start:start + 5]
        for attempt in range(max_attempts):
            try:
                py = TrendReq(hl="fr-CA", tz=300, timeout=(10, 30))
                iot, rq = _batch_trends(py, batch, geo, timeframe)
                out["interest_over_time"].update(iot)
                out["related_queries"].update(rq)
                break
            except Exception as e:
                msg = str(e)
                if attempt < max_attempts - 1 and ("429" in msg or "timeout" in msg.lower()):
                    time.sleep(backoff[attempt])
                    continue
                out["errors"].append({"batch": batch, "attempt": attempt + 1,
                                       "error": msg[:200]})
                break
        time.sleep(2)  # between batches
    return out


def collect_semrush_overview(domain: str, database: str = "ca") -> dict:
    """Apercu Semrush du domaine (si cle API dispo). Renvoie {} sinon."""
    if not SEMRUSH_API_KEY:
        return {}
    out = {}
    reports = {
        "domain_overview": {"type": "domain_ranks"},
        "top_keywords": {"type": "domain_organic", "display_limit": "50",
                         "export_columns": "Ph,Po,Nq,Cp,Tr"},
        "paid_keywords": {"type": "domain_adwords", "display_limit": "50",
                          "export_columns": "Ph,Po,Nq,Cp"},
    }
    with httpx.Client(timeout=60) as c:
        for name, extra in reports.items():
            params = {"key": SEMRUSH_API_KEY, "domain": domain, "database": database, **extra}
            try:
                r = c.get("https://api.semrush.com/", params=params)
                out[name] = r.text
            except Exception as e:
                out[name] = f"ERROR: {e}"
    return out
