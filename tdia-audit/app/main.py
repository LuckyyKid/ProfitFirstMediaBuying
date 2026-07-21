"""API FastAPI - le point d'integration avec ton front-end.
POST /audits          -> lance un audit (webhook du formulaire d'onboarding)
GET  /audits/{c}/{id} -> statut du pipeline etape par etape
GET  /audits/{c}/{id}/audit_data.xlsx -> Excel des donnees collectees (pour l'AM)
GET  /audits/{c}/{id}/analysis/business-context -> contexte business (markdown)
"""
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from redis import Redis
from rq import Queue
from app.config import API_AUTH_TOKEN, REDIS_URL, DATA_DIR
from app.storage import slugify
import time

app = FastAPI(title="TDIA Audit Engine")
queue = Queue("audits", connection=Redis.from_url(REDIS_URL))

ANALYSIS_FILES = {"business-context"}


def _auth(authorization: str | None):
    if authorization != f"Bearer {API_AUTH_TOKEN}":
        raise HTTPException(401, "invalid token")


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
    import json
    p = DATA_DIR / "clients" / client / audit_id / "status.json"
    if not p.exists():
        return {"state": "queued"}
    return json.loads(p.read_text(encoding="utf-8"))


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


@app.get("/health")
def health():
    return {"ok": True}
