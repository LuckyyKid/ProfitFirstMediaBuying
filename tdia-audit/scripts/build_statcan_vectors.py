#!/usr/bin/env python3
"""Construit app/collectors/statcan_vectors.json a partir des metadonnees
du tableau 20-10-0056 (ventes du commerce de detail par industrie SCIAN).

Ecrit un fichier de la forme:
{
  "scian_code": {
    "canada":  {"vectorId": "vXXXXXX", "coordinate": "1.9.1.1"},
    "quebec":  {"vectorId": "vYYYYYY", "coordinate": "6.9.1.1"}
  },
  ...
  "_macro": {
    "cpi_all_items":     "v41690973",
    "unemployment_rate": "v91506256"
  }
}

Idempotent: le fichier est recree a chaque appel. Sous les hood:
- getCubeMetadata(20100056) pour lister les dimension members
- getSeriesInfoFromCubePidCoord pour resoudre le vectorId d'une coordonnee

Usage: python scripts/build_statcan_vectors.py
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
import stats_can as sc
from app.collectors.industry_taxonomy import INDUSTRY_TAXONOMY

TABLE_ID = 20100056
WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest"


def _wds_series_info_from_coord(pid: int, coord: str) -> dict:
    """stats_can n'implemente pas cet endpoint -> POST direct au WDS.
    (httpx a un souci TLS avec www150.statcan.gc.ca; requests fonctionne.)"""
    r = requests.post(
        f"{WDS_BASE}/getSeriesInfoFromCubePidCoord",
        json=[{"productId": pid, "coordinate": coord}],
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        data = data[0]
    return data
GEOS = {"canada": "Canada", "quebec": "Quebec"}
SALES_TYPE = "Total retail sales"
ADJUSTMENT = "Unadjusted"

OUT = Path(__file__).parent.parent / "app" / "collectors" / "statcan_vectors.json"


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _members_by_class_code(dim: dict) -> dict[str, dict]:
    return {str(m.get("classificationCode") or ""): m for m in dim["member"]}


def _members_by_name(dim: dict) -> dict[str, dict]:
    return {_norm(m["memberNameEn"]): m for m in dim["member"]}


def _coord(mids: list[int]) -> str:
    """Une coordonnee est une chaine 'd1.d2.d3.d4...' de member ids padded a 10."""
    # StatCan attend 10 dimensions max, on complete par des 0
    padded = mids + [0] * (10 - len(mids))
    return ".".join(str(x) for x in padded)


def resolve_vectors():
    md = sc.scwds.get_cube_metadata(TABLE_ID)
    if isinstance(md, list):
        md = md[0]
    if md.get("responseStatusCode") != 0:
        raise RuntimeError(f"getCubeMetadata failed: {md}")

    dims = {d["dimensionPositionId"]: d for d in md["dimension"]}
    geo_by_name = _members_by_name(dims[1])
    scian_by_code = _members_by_class_code(dims[2])
    sales_by_name = _members_by_name(dims[3])
    adj_by_name = _members_by_name(dims[4])

    sales_id = sales_by_name[_norm(SALES_TYPE)]["memberId"]
    adj_id = adj_by_name[_norm(ADJUSTMENT)]["memberId"]

    result: dict[str, dict] = {}
    scian_codes_needed = sorted({
        cat["scian_code"] for cat in INDUSTRY_TAXONOMY.values()
    })
    print(f"Resolution de {len(scian_codes_needed)} codes SCIAN x "
          f"{len(GEOS)} geographies = {len(scian_codes_needed) * len(GEOS)} vecteurs")

    for scian in scian_codes_needed:
        result[scian] = {}
        member = scian_by_code.get(str(scian))
        if not member:
            print(f"  [warn] SCIAN {scian}: introuvable dans le cube")
            continue
        scian_id = member["memberId"]

        for geo_key, geo_name in GEOS.items():
            geo = geo_by_name.get(_norm(geo_name))
            if not geo:
                print(f"  [warn] geo {geo_name} introuvable")
                continue
            geo_id = geo["memberId"]
            coord = _coord([geo_id, scian_id, sales_id, adj_id])
            try:
                info = _wds_series_info_from_coord(TABLE_ID, coord)
                if info.get("status") != "SUCCESS":
                    print(f"  [warn] SCIAN {scian} / {geo_key}: "
                          f"status={info.get('status')} obj={info.get('object')}")
                    continue
                obj = info.get("object", info)
                vec = obj.get("vectorId")
                if vec:
                    result[scian][geo_key] = {
                        "vectorId": f"v{vec}",
                        "coordinate": coord,
                        "scian_name": member.get("memberNameEn", ""),
                    }
                    print(f"  OK  SCIAN {scian:>6} / {geo_key:<7} -> v{vec}")
                else:
                    print(f"  [warn] SCIAN {scian} / {geo_key}: pas de vectorId dans "
                          f"la reponse ({list(obj.keys())})")
            except Exception as e:
                print(f"  [err] SCIAN {scian} / {geo_key}: {e}")
            time.sleep(0.4)  # WDS friendly

    # Macros: vecteurs hardcodes (IPC + chomage nationaux, mensuels, ajustes CVS)
    # v41690973 = IPC ensemble Canada (tableau 18-10-0004)
    # v91506256 = Taux de chomage 15 ans+ Canada CVS (tableau 14-10-0287)
    result["_macro"] = {
        "cpi_all_items_canada": {
            "vectorId": "v41690973",
            "description": "CPI, all-items, Canada, monthly",
            "table": "18-10-0004",
        },
        "unemployment_rate_canada": {
            "vectorId": "v91506256",
            "description": "Unemployment rate, 15 years and over, Canada, monthly, SA",
            "table": "14-10-0287",
        },
    }
    return result


if __name__ == "__main__":
    data = resolve_vectors()
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nEcrit: {OUT}")
    print(f"Categories SCIAN resolues: {sum(1 for k, v in data.items() if k != '_macro' and v)}"
          f" / {sum(1 for k in data.keys() if k != '_macro')}")
