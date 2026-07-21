import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

LLM_MODEL = os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-6")
LLM_MODEL_HEAVY = os.getenv("LLM_MODEL_HEAVY", LLM_MODEL)
LLM_MODEL_CHEAP = os.getenv("LLM_MODEL_CHEAP", LLM_MODEL)

APIFY_TOKEN = os.getenv("APIFY_TOKEN", "")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
SEMRUSH_API_KEY = os.getenv("SEMRUSH_API_KEY", "")

CENSUS_API_KEY = os.getenv("CENSUS_API_KEY", "")
SEC_USER_AGENT = os.getenv("SEC_USER_AGENT", "")
SEC_API_IO_KEY = os.getenv("SEC_API_IO_KEY", "")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
API_AUTH_TOKEN = os.getenv("API_AUTH_TOKEN", "change-me")

# Actors Apify
ACTOR_TRUSTPILOT = "zen-studio/trustpilot-review-scraper"
ACTOR_FB_ADS = "XtaWFhbtfxyzqrFmd"
ACTOR_GMAPS_REVIEWS = os.getenv("ACTOR_GMAPS_REVIEWS", "Xb8osYTtOjlsgI6k9")

# Hote RapidAPI Reddit
RAPIDAPI_REDDIT_HOST = "reddit-posts-search.p.rapidapi.com"
