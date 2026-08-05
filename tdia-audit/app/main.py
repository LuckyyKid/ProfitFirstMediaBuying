"""API FastAPI - le point d'integration avec ton front-end.
POST /audits          -> lance un audit (webhook du formulaire d'onboarding)
GET  /audits/{c}/{id} -> statut du pipeline etape par etape
GET  /audits/{c}/{id}/audit_data.xlsx -> Excel des donnees collectees (pour l'AM)
GET  /audits/{c}/{id}/reviews.xlsx   -> Excel consolide des verbatims (upload IA)
GET  /audits/{c}/{id}/analysis/business-context -> contexte business (markdown)
GET  /clients                        -> liste des clients ayant au moins un audit
GET  /clients/{slug}/audits          -> liste des runs d'un client (avec status)
"""
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from redis import Redis
from rq import Queue
from app.config import API_AUTH_TOKEN, REDIS_URL, DATA_DIR
from app.storage import slugify
import json
import time

app = FastAPI(title="TDIA Audit Engine")
queue = Queue("audits", connection=Redis.from_url(REDIS_URL))

ANALYSIS_FILES = {"business-context"}


def _auth(authorization: str | None):
    if authorization != f"Bearer {API_AUTH_TOKEN}":
        raise HTTPException(401, "invalid token")


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _summarize_status(status: dict | None) -> dict:
    """Retourne un resume derive du status.json (state global + progression)."""
    steps = (status or {}).get("steps") or {}
    current = (status or {}).get("current")
    total = len(steps)
    done = sum(1 for s in steps.values() if s.get("state") == "done")
    error = sum(1 for s in steps.values() if s.get("state") == "error")
    running = sum(1 for s in steps.values() if s.get("state") == "running")

    if total == 0:
        state = "queued"
    elif steps.get("pipeline", {}).get("state") == "done":
        state = "completed"
    elif error > 0 and running == 0:
        state = "failed"
    elif running > 0:
        state = "running"
    else:
        state = "running"  # steps enregistres mais pipeline pas termine

    progress = round(100 * done / max(total, 1))
    last_ts = max((s.get("ts") or 0 for s in steps.values()), default=0)
    return {
        "state": state,
        "current": current,
        "progress": progress,
        "steps_total": total,
        "steps_done": done,
        "steps_error": error,
        "last_step_ts": last_ts,
    }


class AuditRequest(BaseModel):
    client_name: str
    onboarding: dict          # reponses brutes du formulaire
    options: dict = {}        # collection_plan override, country, max_reviews...


@app.post("/audits")
def create_audit(req: AuditRequest, authorization: str | None = Header(None)):
    _auth(authorization)
    audit_id = time.strftime("%Y%m%d-%H%M%S")
    queue.enqueue("app.pipeline.run_audit", req.client_name, req.onboarding,
                  audit_id, req.options, job_timeout=3 * 3600)
    return {"client": slugify(req.client_name), "audit_id": audit_id,
            "status_url": f"/audits/{slugify(req.client_name)}/{audit_id}"}


@app.get("/audits/{client}/{audit_id}")
def audit_status(client: str, audit_id: str, authorization: str | None = Header(None)):
    _auth(authorization)
    root = DATA_DIR / "clients" / client / audit_id
    status = _read_json(root / "status.json")
    if not root.exists():
        return {"client": client, "audit_id": audit_id, "state": "queued",
                "steps": {}, "current": None}
    summary = _summarize_status(status)
    onboarding = _read_json(root / "onboarding.json") or {}
    return {
        "client": client,
        "audit_id": audit_id,
        "steps": (status or {}).get("steps") or {},
        "current": summary["current"],
        "state": summary["state"],
        "progress": summary["progress"],
        "steps_total": summary["steps_total"],
        "steps_done": summary["steps_done"],
        "steps_error": summary["steps_error"],
        "last_step_ts": summary["last_step_ts"],
        "onboarding_name": onboarding.get("nom_entreprise"),
        "onboarding_website": onboarding.get("site_web"),
        "artifacts": _list_artifacts(root),
    }


def _list_artifacts(root) -> list[dict]:
    """Enumere les livrables telechargeables pour un run."""
    items = []
    report = root / "report"
    if (report / "reviews.xlsx").exists():
        items.append({"kind": "reviews_xlsx",
                      "title": "Verbatims consolides (upload IA)",
                      "path": "reviews.xlsx"})
    elif (report / "reviews.csv").exists():
        items.append({"kind": "reviews_csv",
                      "title": "Verbatims consolides (CSV fallback)",
                      "path": "reviews.csv"})
    if (report / "audit_data.xlsx").exists():
        items.append({"kind": "audit_data_xlsx",
                      "title": "Donnees d'audit (Account Manager)",
                      "path": "audit_data.xlsx"})
    if (root / "analysis" / "business-context.md").exists():
        items.append({"kind": "business_context",
                      "title": "Contexte business (markdown)",
                      "path": "business-context"})
    return items


@app.get("/audits/{client}/{audit_id}/audit_data.xlsx")
def audit_excel(client: str, audit_id: str, authorization: str | None = Header(None)):
    _auth(authorization)
    p = DATA_DIR / "clients" / client / audit_id / "report" / "audit_data.xlsx"
    if not p.exists():
        raise HTTPException(404, "pas encore genere")
    return FileResponse(
        p,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        filename=f"audit-{client}-{audit_id}.xlsx",
    )


@app.get("/audits/{client}/{audit_id}/reviews.xlsx")
def reviews_excel(client: str, audit_id: str, authorization: str | None = Header(None)):
    """Verbatims consolides (Trustpilot + Reddit + Meta Ads + GMaps + YouTube)
    dans un unique Excel normalise, pret a etre uploade dans une conversation IA."""
    _auth(authorization)
    p = DATA_DIR / "clients" / client / audit_id / "report" / "reviews.xlsx"
    if not p.exists():
        # Fallback CSV si openpyxl n'est pas installe cote worker
        csv_p = p.with_suffix(".csv")
        if csv_p.exists():
            return FileResponse(csv_p, media_type="text/csv",
                                filename=f"reviews-{client}-{audit_id}.csv")
        raise HTTPException(404, "pas encore genere")
    return FileResponse(
        p,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        filename=f"reviews-{client}-{audit_id}.xlsx",
    )


@app.get("/audits/{client}/{audit_id}/analysis/{name}", response_class=PlainTextResponse)
def audit_analysis(client: str, audit_id: str, name: str,
                   authorization: str | None = Header(None)):
    _auth(authorization)
    if name not in ANALYSIS_FILES:
        raise HTTPException(404, "livrable inconnu")
    p = DATA_DIR / "clients" / client / audit_id / "analysis" / f"{name}.md"
    if not p.exists():
        raise HTTPException(404, "pas encore genere")
    return p.read_text(encoding="utf-8")


@app.get("/clients")
def list_clients(authorization: str | None = Header(None)):
    """Liste les clients ayant au moins un audit stocke localement."""
    _auth(authorization)
    root = DATA_DIR / "clients"
    if not root.exists():
        return []
    out = []
    for d in sorted(root.iterdir()):
        if not d.is_dir():
            continue
        # dernier audit_id (tri par nom de dossier — timestamp YYYYMMDD-HHMMSS)
        audits = sorted([a.name for a in d.iterdir() if a.is_dir()], reverse=True)
        latest_id = audits[0] if audits else None
        latest_onboarding = {}
        if latest_id:
            latest_onboarding = _read_json(d / latest_id / "onboarding.json") or {}
        out.append({
            "slug": d.name,
            "name": latest_onboarding.get("nom_entreprise") or d.name,
            "website": latest_onboarding.get("site_web"),
            "audits_count": len(audits),
            "latest_audit_id": latest_id,
        })
    return out


@app.get("/clients/{slug}/audits")
def list_client_audits(slug: str, authorization: str | None = Header(None)):
    """Liste les runs d'un client avec leur etat resume."""
    _auth(authorization)
    client_root = DATA_DIR / "clients" / slug
    if not client_root.exists():
        return []
    out = []
    for a in sorted(client_root.iterdir(), reverse=True):
        if not a.is_dir():
            continue
        status = _read_json(a / "status.json")
        summary = _summarize_status(status)
        out.append({
            "client": slug,
            "audit_id": a.name,
            "state": summary["state"],
            "current": summary["current"],
            "progress": summary["progress"],
            "steps_total": summary["steps_total"],
            "steps_done": summary["steps_done"],
            "steps_error": summary["steps_error"],
            "last_step_ts": summary["last_step_ts"],
        })
    return out


@app.get("/health")
def health():
    return {"ok": True}
