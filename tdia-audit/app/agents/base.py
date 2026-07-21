"""Runner generique d'agent: skills (base de connaissances) + prompt + inputs -> markdown."""
from pathlib import Path
from app.llm import complete

SKILLS_DIR = Path(__file__).parent.parent / "skills"
PROMPTS_DIR = Path(__file__).parent / "prompts"

COMMON_RULES = """
REGLES COMMUNES A TOUS LES AGENTS TDIA — INFRACTION = ECHEC DE LA MISSION:

1. ZERO INVENTION. Chaque affirmation quantifiee (chiffre, %, frequence, note) doit etre traceable
   a une donnee des inputs. Chaque verbatim doit etre COPIE-COLLE d'un post/review/commentaire
   REELLEMENT present dans les inputs.

2. VERBATIMS — REGLES STRICTES:
   - Format: "citation exacte" — [Source: Trustpilot XXX / Reddit r/XXX / Ad Meta XXX]
   - Recopie mot pour mot, dans la langue originale. Pas de traduction, pas de nettoyage.
   - INTERDICTION FORMELLE d'auto-citation: `(voc.md)`, `(Trends.md)`, `(competitors.md)`,
     `(cro.md)`, `(icp.md)`, `(context.md)` ne sont JAMAIS des sources valides pour un verbatim.
     Ce sont des fichiers d'analyse produits par TES pairs, pas des voix de clients.
   - Si aucun verbatim reel ne correspond, ecris `[PAS DE VERBATIM DIRECT DANS LES DONNEES]`
     plutot que d'en inventer un. Un point sans verbatim vaut mille fois mieux qu'un faux verbatim.

3. DONNEES MANQUANTES. Si une metrique/section ne peut etre remplie a partir des inputs,
   ecris explicitement `DONNEE MANQUANTE: <ce qu'il faudrait>`. Ne combler pas les trous
   avec des estimations plausibles ou du langage vague ("environ", "probablement", "il est
   raisonnable de penser que...").

4. OUTPUT EN FRANCAIS professionnel. Les verbatims restent dans leur langue d'origine.

5. OUTPUT MARKDOWN structure, directement exploitable par les agents suivants.
"""


def load_skill(name: str) -> str:
    p = SKILLS_DIR / name
    return p.read_text(encoding="utf-8") if p.exists() else ""


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def run_agent(prompt_file: str, skill_files: list[str], user_content: str,
              model: str | None = None, max_tokens: int = 8000) -> str:
    skills = "\n\n".join(f"<skill name=\"{s}\">\n{load_skill(s)}\n</skill>"
                         for s in skill_files if load_skill(s))
    system = f"{load_prompt(prompt_file)}\n\n{COMMON_RULES}\n\n# BASE DE CONNAISSANCES\n{skills}"
    return complete(system=system, user=user_content, model=model, max_tokens=max_tokens)
