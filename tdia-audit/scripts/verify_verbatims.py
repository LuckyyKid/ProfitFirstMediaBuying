#!/usr/bin/env python3
"""Extract quoted verbatims from analysis/*.md + report/rapport.md,
fuzzy-match each against the raw corpus. Report per audit."""
import json
import re
import sys
from pathlib import Path
from rapidfuzz import fuzz

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QUOTE_RE = re.compile(r'[«"\u201c]([^»"\u201d]{20,400})[»"\u201d]')
THRESHOLD = 80


def build_corpus(raw_dir: Path) -> str:
    parts = []
    for f in raw_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue

        def walk(x):
            if isinstance(x, str):
                parts.append(x)
            elif isinstance(x, dict):
                for v in x.values():
                    walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
        walk(data)
    return "\n".join(parts)


def extract_quotes(md_dir: Path, report_md: Path) -> list[tuple[str, str]]:
    """Return list of (source_file, quote) tuples."""
    out = []
    for f in list(md_dir.glob("*.md")) + [report_md]:
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        for m in QUOTE_RE.finditer(txt):
            q = m.group(1).strip()
            if q:
                out.append((f.name, q))
    return out


def find_in_corpus(quote: str, corpus: str) -> tuple[bool, int]:
    """Return (found, score). Slide a window over the corpus for best partial match."""
    # partial_ratio is O(n*m); to make it tractable, we scan in chunks
    best = 0
    n = len(quote)
    step = 8000
    win = max(n * 3, 2000)
    for i in range(0, len(corpus), step):
        chunk = corpus[i:i + step + win]
        s = fuzz.partial_ratio(quote.lower(), chunk.lower())
        if s > best:
            best = s
            if best >= 95:
                break
    return best >= THRESHOLD, best


def main() -> None:
    audits = [
        ("go-coconut", "20260717-055632"),
        ("shields-of-strength", "20260717-053603"),
        ("gutsy-drinks", "20260717-050447"),
    ]
    root = Path("data/clients")
    for slug, run in audits:
        base = root / slug / run
        corpus = build_corpus(base / "raw")
        quotes = extract_quotes(base / "analysis", base / "report" / "rapport.md")
        print(f"===== {slug} =====")
        print(f"corpus chars: {len(corpus):,} | quotes: {len(quotes)}")
        found = 0
        missing: list[tuple[str, str, int]] = []
        for src, q in quotes:
            ok, score = find_in_corpus(q, corpus)
            if ok:
                found += 1
            else:
                missing.append((src, q, score))
        pct = (found / max(len(quotes), 1)) * 100
        print(f"  found: {found}  missing: {len(missing)}  ({pct:.0f}% real)")
        for src, q, score in missing[:5]:
            preview = q[:120].encode("ascii", "replace").decode()
            print(f'  -- MISSING [{src}] score={score} "{preview}"')
        print()


if __name__ == "__main__":
    main()
