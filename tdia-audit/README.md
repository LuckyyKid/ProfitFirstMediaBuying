# TDIA Audit Engine

Systeme multi-agents d'audit & market research. Self-hosted (VPS), LLM interchangeable (LiteLLM), integre a ton front-end via API REST.

## Pipeline
```
onboarding (webhook front-end)
  └─> Agent Contexte ──> plan de collecte (JSON)
        └─> COLLECTE: Apify (Trustpilot + Meta Ad Library) · RapidAPI (Reddit) ·
            pytrends (Google Trends) · Semrush (opt.) · Scrapling (pages, fallback anti-bot)
              └─> Agent VOC (map-reduce sur les reviews)
              └─> Agent Competiteurs
              └─> Agent Tendances
                    └─> Agent CRO & Offre
                          └─> Agent ICP & Angles (minimum 15 ICP, garde-fou automatique)
                                └─> Agent Rapport ──> PDF (WeasyPrint, charte TDIA)
```

## Demarrage local (test)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # remplir les cles
python scripts/test_collectors.py reddit "creme peau sensible"   # tester chaque collecteur
python scripts/run_local.py exemple-onboarding.json              # audit complet
```
Les livrables arrivent dans `data/clients/{client}/{audit_id}/`:
`raw/` (donnees brutes) → `analysis/` (markdown par agent) → `report/rapport.pdf`.

## Deploiement VPS (Hostinger)
```bash
git clone <ton-repo> && cd tdia-audit
cp .env.example .env && nano .env
docker compose up -d --build
curl http://localhost:8000/health
```
Mets un reverse proxy (Caddy/Nginx) devant avec HTTPS. L'API ecoute sur :8000.

## Integration front-end
```
POST /audits                        Authorization: Bearer <API_AUTH_TOKEN>
  {"client_name": "...", "onboarding": {...}, "options": {...}}
GET  /audits/{client}/{audit_id}                 -> statut etape par etape
GET  /audits/{client}/{audit_id}/analysis/{voc|icp|cro|...}  -> livrables markdown
GET  /audits/{client}/{audit_id}/report.pdf      -> rapport final
```
Ton front-end poste le formulaire d'onboarding, poll le statut, affiche le PDF.

## Points de controle qualite (recommande au debut)
Le pipeline tourne de bout en bout, mais tant que tu valides les agents:
1. Lance `run_local.py`, lis `analysis/business-context.md` et `collection-plan.json`.
2. Verifie que le plan de collecte est bon AVANT de payer la collecte — tu peux forcer
   le plan via `options.collection_plan` (le front-end pourra offrir cette etape de validation).
3. Lis chaque markdown dans `analysis/` avant de faire confiance au PDF.

## Couts par audit (ordres de grandeur)
- Apify Trustpilot: ~0.75$/1000 reviews · FB Ads: ~0.75$/1000 ads
- RapidAPI Reddit: selon ton plan
- LLM: ~2-6$ selon le volume (le map-reduce utilise LLM_MODEL_CHEAP)

## Changer de LLM
Modifie `LLM_MODEL*` dans `.env` (format LiteLLM: `provider/model`). Rien d'autre a changer.
