"""Agent Contexte: produit le business-context et extrait le plan de collecte.

Le pipeline s'arrete ici cote LLM. Toutes les analyses aval (VOC, competitors,
trends, ICP, rapport) ont ete retirees: les donnees collectees sont livrees
telles quelles dans un Excel pour l'Account Manager (voir `app/report/excel.py`)."""
import json
import re
from app.agents.base import run_agent
from app.storage import ClientWorkspace


def _read(path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def agent_context(ws: ClientWorkspace, onboarding: dict) -> str:
    out = run_agent(
        "context.md", [],
        f"Reponses du formulaire d'onboarding:\n```json\n{json.dumps(onboarding, ensure_ascii=False, indent=2)}\n```",
    )
    ws.analysis("business-context.md").write_text(out, encoding="utf-8")
    return out


def extract_collection_plan(context_md: str) -> dict:
    """Extrait le bloc JSON des requetes de collecte du business-context."""
    m = re.search(r"```json\s*(\{.*?\})\s*```", context_md, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    return {}
