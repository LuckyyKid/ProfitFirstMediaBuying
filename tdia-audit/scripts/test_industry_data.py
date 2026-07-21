#!/usr/bin/env python3
"""Test des 3 sous-collecteurs industry_data sur categorie 'boissons' (kombucha).
Affiche un echantillon des 3 JSON produits + indice de saisonnalite calcule."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.collectors.industry_data import (
    collect_industry_us, collect_industry_ca, collect_sec_filings,
)


def _preview(name: str, data: dict, drop_series: bool = True):
    print(f"\n{'=' * 70}\n{name}\n{'=' * 70}")
    view = dict(data)
    if drop_series:
        if "monthly_series" in view:
            n = len(view["monthly_series"])
            view["monthly_series"] = f"<{n} pts elides>"
        if "retail_sales" in view:
            rs = {}
            for k, v in view["retail_sales"].items():
                if isinstance(v, dict) and "monthly_series" in v:
                    v = {**v, "monthly_series": f"<{len(v['monthly_series'])} pts elides>"}
                rs[k] = v
            view["retail_sales"] = rs
    print(json.dumps(view, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    print("Test collector industry_data sur 'boissons' (MARTS 4451 / SCIAN 4451 / kw kombucha)")

    us = collect_industry_us("boissons", force=True)
    _preview("industry_us.json (US Census MARTS)", us)

    ca = collect_industry_ca("boissons", force=True)
    _preview("industry_ca.json (StatCan 20-10-0056)", ca)

    sec = collect_sec_filings("boissons", force=True)
    _preview("sec_filings.json (EDGAR full-text)", sec, drop_series=False)

    print("\n" + "=" * 70)
    print("INDICE DE SAISONNALITE (base 100 = moyenne annuelle)")
    print("=" * 70)
    print("\n-- US (MARTS 4451, non-desaisonnalise) --")
    print(json.dumps(us.get("seasonality_index_monthly", {}), indent=2))
    print("YoY:", json.dumps(us.get("yoy_latest", {}), indent=2))

    print("\n-- CA Canada (SCIAN 4451, non-desaisonnalise) --")
    ca_can = (ca.get("retail_sales") or {}).get("canada", {})
    print(json.dumps(ca_can.get("seasonality_index_monthly", {}), indent=2))
    print("YoY:", json.dumps(ca_can.get("yoy_latest", {}), indent=2))

    print("\n-- CA Quebec (SCIAN 4451, non-desaisonnalise) --")
    ca_qc = (ca.get("retail_sales") or {}).get("quebec", {})
    print(json.dumps(ca_qc.get("seasonality_index_monthly", {}), indent=2))
    print("YoY:", json.dumps(ca_qc.get("yoy_latest", {}), indent=2))
