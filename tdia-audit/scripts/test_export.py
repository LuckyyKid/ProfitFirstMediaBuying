#!/usr/bin/env python3
"""Test standalone du consolidateur reviews.xlsx (app/export.py).

Charge fixtures/*.json dans un workspace temporaire, execute
`export_reviews_excel`, verifie:
  - IDs uniques et sequentiels R-0001...
  - Colonnes completes (HEADERS)
  - Aucun `texte` vide
  - Comptes par source coherents avec les fixtures
  - Roles client/competiteur correctement attribues
  - Sources absentes = pas d'exception, aucune ligne fantome

Usage: python scripts/test_export.py
Exit 0 si tout OK, 1 sinon (assertion detaillee sur stderr).
"""
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
FIXTURES = REPO_ROOT / "fixtures"


def main() -> int:
    tmp = tempfile.mkdtemp(prefix="tdia-export-")
    try:
        # DATA_DIR doit etre set AVANT l'import de app.config (via app.storage)
        os.environ["DATA_DIR"] = tmp
        from app.storage import ClientWorkspace
        from app.export import export_reviews_excel, HEADERS, HAS_XLSX

        ws = ClientWorkspace("test-export", "run-1")

        # onboarding minimal (base de _domain_roles)
        ws.write_json(ws.root / "onboarding.json", {
            "nom_entreprise": "Demo Boutique",
            "site_web": "https://demoboutique.ca",
            "competiteurs": "attitudeliving.com, oneka.ca, theordinary.com",
        })
        # collection-plan minimal (schema produit par extract_collection_plan)
        ws.write_json(ws.root / "collection-plan.json", {
            "trustpilot_domains": ["demoboutique.ca", "attitudeliving.com", "oneka.ca"],
            "competitor_domains": ["attitudeliving.com", "oneka.ca", "theordinary.com"],
            "fb_pages": [
                "https://www.facebook.com/attitudeliving",
                "https://www.facebook.com/onekaelements",
            ],
        })

        # copie des fixtures disponibles (trustpilot / reddit / fb_ads)
        for src in ("trustpilot.json", "reddit.json", "fb_ads.json"):
            src_p = FIXTURES / src
            assert src_p.exists(), f"fixture manquante: {src_p}"
            shutil.copy(src_p, ws.raw(src))

        # sources deliberement absentes -> test robustesse (fichier raw manquant)
        assert not ws.raw("gmaps_reviews.json").exists()
        assert not ws.raw("youtube.json").exists()

        # === RUN ===
        out = export_reviews_excel(ws)
        print(f"[export] wrote: {out}")

        # === ASSERTS ===
        # 1) fichier principal existe
        assert Path(out).exists(), f"output manquant: {out}"

        # 2) sommaire lisible + total > 0
        summary = json.loads(
            ws.report("reviews_summary.json").read_text(encoding="utf-8")
        )
        total = summary["total"]
        per_src = summary["par_source"]
        assert total > 0, "aucune ligne produite"

        # 3) CSV parseable, IDs uniques R-0001..., colonnes toutes presentes, texte non vide
        import csv as _csv
        with open(ws.report("reviews.csv"), encoding="utf-8-sig") as f:
            rows = list(_csv.DictReader(f))
        assert len(rows) == total, f"CSV/summary mismatch: {len(rows)} vs {total}"

        seen_ids: set[str] = set()
        for i, row in enumerate(rows, 1):
            for h in HEADERS:
                assert h in row, f"colonne manquante {h!r} en ligne {i}"
            expected_id = f"R-{i:04d}"
            assert row["id"] == expected_id, \
                f"ligne {i}: id {row['id']!r} != {expected_id!r}"
            seen_ids.add(row["id"])
            assert row["texte"].strip(), f"ligne {row['id']}: texte vide"
        assert len(seen_ids) == len(rows), "ids dupliques"

        # 4) comptes par source coherents avec les fixtures
        def _fx_len(name: str) -> int:
            return len(json.loads((FIXTURES / name).read_text(encoding="utf-8")))

        tp_expected = _fx_len("trustpilot.json")
        assert per_src.get("trustpilot", 0) == tp_expected, \
            f"trustpilot: {per_src.get('trustpilot')} attendu {tp_expected}"

        reddit_fx = json.loads((FIXTURES / "reddit.json").read_text(encoding="utf-8"))
        posts_expected = sum(1 for x in reddit_fx if x.get("post"))
        comments_expected = sum(
            len((x.get("details") or {}).get("comments") or []) for x in reddit_fx
        )
        assert per_src.get("reddit_post", 0) == posts_expected, \
            f"reddit_post: {per_src.get('reddit_post')} attendu {posts_expected}"
        assert per_src.get("reddit_comment", 0) == comments_expected, \
            f"reddit_comment: {per_src.get('reddit_comment')} attendu {comments_expected}"

        ads_expected = _fx_len("fb_ads.json")
        assert per_src.get("ad_library", 0) == ads_expected, \
            f"ad_library: {per_src.get('ad_library')} attendu {ads_expected}"

        # 5) roles: le client (demoboutique.ca) doit apparaitre au moins une fois
        # (companyDomain == demoboutique.ca dans la fixture trustpilot)
        # et les competiteurs (attitudeliving/oneka/theordinary) aussi.
        role_counts: dict[str, int] = {}
        for r in rows:
            role_counts[r["role"]] = role_counts.get(r["role"], 0) + 1
        assert role_counts.get("client", 0) > 0, "aucun role client attribue"
        assert role_counts.get("competiteur", 0) > 0, "aucun role competiteur attribue"

        # 6) sources absentes = pas d'exception ni de lignes fantomes
        for absent in ("gmaps", "youtube_comment", "youtube_transcript"):
            assert absent not in per_src, f"source inattendue {absent!r}"

        # 7) accents QC preserves (encoding UTF-8 end-to-end)
        assert any("é" in r["texte"] or "è" in r["texte"] or "ê" in r["texte"]
                   for r in rows), "aucun accent trouve — probleme d'encoding"

        print(f"[ok] total={total}, xlsx_engine={'openpyxl' if HAS_XLSX else 'csv-only'}")
        print(f"[ok] par_source={per_src}")
        print(f"[ok] roles={role_counts}")
        return 0

    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
