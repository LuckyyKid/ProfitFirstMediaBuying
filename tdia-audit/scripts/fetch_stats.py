#!/usr/bin/env python3
"""Agrege data/logs/fetch_stats.jsonl pour repondre a: 'le niveau 4
(CloakBrowser) merite-t-il sa place dans la chaine ?'

Usage:
    python scripts/fetch_stats.py                 # dernier mois
    python scripts/fetch_stats.py --days 7        # 7 derniers jours
    python scripts/fetch_stats.py --by-domain     # eclatement par domaine

Sortie: tableau avec % de reussite par niveau, duree mediane, top domaines
qui declenchent le niveau 4."""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse


LEVEL_NAMES = {1: "httpx", 2: "scrapling", 3: "scrapling-stealth",
               4: "cloakbrowser", 0: "failed"}


def _load(path: Path, since_ts: int) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("timestamp", 0) >= since_ts:
                out.append(e)
    return out


def _fmt_pct(n: int, total: int) -> str:
    return f"{100 * n / total:5.1f}%" if total else "  n/a "


def summarize(entries: list[dict], by_domain: bool = False) -> str:
    total = len(entries)
    if total == 0:
        return "Aucune entree dans la fenetre demandee."
    per_level: Counter[int] = Counter(e.get("level", 0) for e in entries)
    dur_by_level: dict[int, list[int]] = defaultdict(list)
    for e in entries:
        dur_by_level[e.get("level", 0)].append(e.get("duration_ms", 0))

    lines = [
        f"Total pages fetchees: {total}",
        "",
        f"{'Niveau':<25} {'#':>6} {'% du total':>12} {'mediane (ms)':>14}",
        "-" * 60,
    ]
    for lvl in (1, 2, 3, 4, 0):
        n = per_level.get(lvl, 0)
        med = int(statistics.median(dur_by_level[lvl])) if dur_by_level[lvl] else 0
        lines.append(f"{LEVEL_NAMES[lvl]:<25} {n:>6} {_fmt_pct(n, total):>12} {med:>14}")

    lvl4 = per_level.get(4, 0)
    lvl0 = per_level.get(0, 0)
    lines.append("")
    lines.append(
        f"Niveau 4 (CloakBrowser) sauve {lvl4} pages qui auraient echoue autrement."
    )
    lines.append(
        f"Echecs totaux (niveau 0): {lvl0} — pages ou meme CloakBrowser n'a pas suffi."
    )
    if lvl4 == 0 and total > 20:
        lines.append(
            "\n[!] CloakBrowser n'a jamais ete declenche sur cette fenetre. "
            "Envisage de le retirer si la tendance se confirme sur 1 mois."
        )

    if by_domain:
        lines.append("\n--- Top domaines par niveau qui a reussi ---")
        by_dom: dict[str, Counter] = defaultdict(Counter)
        for e in entries:
            dom = urlparse(e.get("url", "")).netloc or "?"
            by_dom[dom][e.get("level", 0)] += 1
        for dom in sorted(by_dom, key=lambda d: -sum(by_dom[d].values()))[:20]:
            c = by_dom[dom]
            summary = ", ".join(f"{LEVEL_NAMES[l]}:{n}" for l, n in c.most_common())
            lines.append(f"  {dom}: {summary}")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30,
                    help="Fenetre en jours (defaut 30)")
    ap.add_argument("--by-domain", action="store_true",
                    help="Eclate le rapport par domaine")
    ap.add_argument("--path", type=Path,
                    default=Path("data/logs/fetch_stats.jsonl"),
                    help="Chemin du fichier de logs")
    args = ap.parse_args()

    since = int(time.time()) - args.days * 86400
    entries = _load(args.path, since)
    print(summarize(entries, by_domain=args.by_domain))
    return 0


if __name__ == "__main__":
    sys.exit(main())
