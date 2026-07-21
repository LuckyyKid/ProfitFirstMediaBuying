#!/usr/bin/env python3
"""Lance un audit complet en local, sans API ni Redis.
Usage: python scripts/run_local.py exemple-onboarding.json"""
import json, sys
sys.path.insert(0, ".")
from app.pipeline import run_audit

payload = json.loads(open(sys.argv[1], encoding="utf-8").read())
result = run_audit(payload["client_name"], payload["onboarding"],
                   options=payload.get("options", {}))
print(json.dumps(result, indent=2))
