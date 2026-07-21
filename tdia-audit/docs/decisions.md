# Decisions d'integration — evaluation Agent-Reach

Date: 2026-07-19
Contexte: evaluer Agent-Reach (repo chinois multi-plateformes) comme fournisseur
de collecte VOC pour trois canaux: YouTube, Twitter, Reddit.

## Criteres eliminatoires

| Cle | Critere |
|---|---|
| A | Fonctionne SANS cookies de session / compte connecte |
| B | S'invoque comme une simple librairie Python (pas de MCP server, pas de CLI interactive) |
| C | Aucune dependance payante cachee (Exa, SerpAPI, etc.) |
| D | Batch-stable: 10-20 requetes consecutives sans rate-limit immediat |

Regle: un seul echec = REJET du canal (pas de contournement, pas de shim).

## Agent-Reach — verdict global

Agent-Reach n'est PAS une librairie de scraping. C'est un wrapper diagnostic qui
enchaine des CLIs externes (`yt-dlp`, `twitter-cli`, `rdt-cli`, `bili-cli`,
`OpenCLI`). Aucun de ces CLIs n'est packageable proprement en dependance Python
epinglee: la plupart demandent un token, une session, ou une installation systeme.

Verdict Agent-Reach comme dependance: **REJETE** (echec B pour tous canaux).

## Canal par canal

### YouTube — INTEGRE via libs directes

Agent-Reach echoue B (shim autour de yt-dlp CLI). Mais le canal lui-meme passe
avec des libs Python directes:

| Critere | Verdict |
|---|---|
| A — sans cookies | OUI. `youtube-transcript-api` lit les sous-titres publics via l'endpoint timedtext. `youtube-comment-downloader` scrape la page publique. |
| B — lib Python | OUI. `pip install youtube-transcript-api==1.2.4 youtube-comment-downloader==0.1.78`. |
| C — pas de paid dep | OUI. Zero API key, zero service tiers. |
| D — batch-stable | PARTIEL. YouTube renvoie occasionnellement 429 depuis IPs cloud. Le collecteur loggue et passe a la video suivante, pas de retry brutal. Assez pour 2-4 requetes x 5 videos par audit. Caveat documente. |

Decision: **INTEGRER** avec collecteur maison `app/collectors/youtube.py` (search page + transcript API + comment downloader). Ne pas vendorer Agent-Reach.

Fichiers touches:
- `app/collectors/youtube.py` (nouveau)
- `app/pipeline.py` (branchement youtube_queries -> raw/youtube.json)
- `app/agents/prompts/context.md` (regles pour youtube_queries + schema JSON)
- `app/agents/runners.py` (`_youtube_to_block` + merge dans `agent_voc`)
- `app/agents/prompts/voc.md` (ajout YouTube aux sources declarees)
- `requirements.txt` (deux dependances epinglees)

### Twitter/X — REJETE

| Critere | Verdict |
|---|---|
| A — sans cookies | NON. Depuis 2023, X exige un compte connecte pour toute page profil/recherche/tweet (redirect vers login sinon). Toutes les libs "sans API" fonctionnent avec un cookie de session `auth_token`. |
| B — lib Python | Sans objet. |
| C — pas de paid dep | L'API v2 officielle est payante ($100+/mois pour du basic search). |
| D — batch-stable | Sans objet. |

Decision: **NE PAS INTEGRER**. Fournir un cookie de session dans le repo violerait
la regle "aucun token/credential dans le code ou les commits" et casserait au
prochain refresh de session. Aucun canal Twitter dans le pipeline.

### Reddit — CONSERVE en l'etat (Apify), pas de bascule Agent-Reach

Reddit est deja collecte via l'actor Apify (`reddit-scraper-lite`). Il n'y a pas
de motif pour basculer vers Agent-Reach:

| Critere (via Agent-Reach / rdt-cli) | Verdict |
|---|---|
| A — sans cookies | OUI en lecture publique. |
| B — lib Python | NON. rdt-cli est un CLI Node, pas une lib Python. |
| C — pas de paid dep | OUI. |
| D — batch-stable | Reddit rate-limite fort les IPs sans compte. |

Decision: **NE PAS BASCULER**. Le collecteur Apify actuel reste, il est deja
paye a l'usage et batch-stable. Aucun changement.

## CloakBrowser (hors Agent-Reach) — INTEGRE

CloakBrowser 0.4.12 integre comme fetcher LEVEL 4 dans la chaine d'escalation
`httpx -> Scrapling Fetcher -> StealthyFetcher -> CloakBrowser`. Declenche
uniquement si un challenge anti-bot est detecte (patterns Cloudflare, captcha,
"Just a moment", 403/503, timeout).

Fichiers: `app/collectors/pages.py`, `Dockerfile`, `requirements.txt`,
`scripts/fetch_stats.py`.

Metriques loggees dans `logs/fetch_stats.jsonl` (`{url, level, duration_ms,
timestamp}`) — aggregateur `python scripts/fetch_stats.py` pour verifier que
CloakBrowser est reellement declenche et gagne son slot.

Caveat teste: le tier gratuit v146 n'a pas battu Cloudflare live sur `www.g2.com`
lors du test. Le tier Pro v150 existe pour ce cas. La chaine 1->4 fonctionne
correctement (verifiee sur 4 URLs), c'est la binaire libre qui plafonne.
