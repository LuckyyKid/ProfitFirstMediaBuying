// Aperçu vignette d'une créative dans les rapports admin/portail.
// Deux protections nécessaires pour que les images s'affichent réellement :
//   1. Meta CDN (scontent.*.fbcdn.net) exige referrerPolicy="no-referrer"
//      sinon il retourne 403 sur toute requête cross-origin.
//   2. Porter Metrics sort parfois l'URL sans schéma (bare host, http, //).
//      On force https:// pour éviter le mixed-content blocking.
// Le composant AdThumbnail (MetaAdsDashboard) applique déjà ces deux règles ;
// ce module en est l'extraction pour partager entre ClientReportView et
// GenerateReportWizard.

const CANDIDATE_KEYS = [
  "ad_image_url",
  "image_url",
  "thumbnail_url",
  "thumbnail",
  "ad_preview_url",
  "preview_url",
  "creative_url",
  "ad_creative_thumbnail_url",
] as const;

export function resolveCreativeImageUrl(
  c: Record<string, unknown> | null | undefined,
): string | null {
  if (!c) return null;
  for (const key of CANDIDATE_KEYS) {
    const raw = c[key];
    const normalized = normalizeThumbnailUrl(raw);
    if (normalized) return normalized;
  }
  return null;
}

export function normalizeThumbnailUrl(
  raw: unknown,
): string | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return v.replace(/^http:\/\//i, "https://");
  if (v.startsWith("//")) return `https:${v}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(v)) return `https://${v}`;
  return null;
}
