FROM python:3.12-slim

# Deps systeme:
#  - libpango/cairo/gdk-pixbuf/fonts: weasyprint (rapport PDF)
#  - le gros bloc lib*: Chromium (Scrapling StealthyFetcher + CloakBrowser)
#  - curl: telechargement binaires CloakBrowser au build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
    fonts-dejavu-core curl \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libx11-xcb1 libfontconfig1 libx11-6 libxcb1 libxext6 libxshmfence1 \
    libglib2.0-0 libgtk-3-0 libxss1 libxtst6 fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Fetchers stealth — telechargement des binaires Chromium au build time
# pour eviter la latence + risque de reseau au premier appel en prod.
#
# Poids ajoute par CloakBrowser: ~200MB pour le binaire Chromium patche.
# Total image apres cette etape reste sous ~1.2GB (base Python slim ~150MB +
# system libs ~400MB + Scrapling ~400MB + CloakBrowser ~200MB).
RUN scrapling install || true
RUN python -c "from cloakbrowser import ensure_binary; ensure_binary()" || true

COPY app ./app
COPY scripts ./scripts
ENV PYTHONUNBUFFERED=1
