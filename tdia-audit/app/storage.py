"""Workspace fichiers par client: raw/ -> analysis/ -> report/"""
import json
import re
import time
from pathlib import Path
from app.config import DATA_DIR


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class ClientWorkspace:
    def __init__(self, client_slug: str, audit_id: str | None = None):
        self.slug = client_slug
        self.audit_id = audit_id or time.strftime("%Y%m%d-%H%M%S")
        self.root = DATA_DIR / "clients" / client_slug / self.audit_id
        for sub in ("raw", "analysis", "report", "logs"):
            (self.root / sub).mkdir(parents=True, exist_ok=True)

    def raw(self, name: str) -> Path:
        return self.root / "raw" / name

    def analysis(self, name: str) -> Path:
        return self.root / "analysis" / name

    def report(self, name: str) -> Path:
        return self.root / "report" / name

    def write_json(self, path: Path, data) -> Path:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def read_json(self, path: Path):
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def set_status(self, step: str, state: str, detail: str = ""):
        status_file = self.root / "status.json"
        status = self.read_json(status_file) or {"steps": {}}
        status["steps"][step] = {"state": state, "detail": detail, "ts": time.time()}
        status["current"] = step
        self.write_json(status_file, status)
