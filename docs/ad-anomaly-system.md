# KPI Anomaly Alert System

## Fiche d'automation (à coller dans le registre)

- **Nom** — `check-ad-anomalies`
- **Déclencheur** — pg_cron `ad-anomaly-daily-check`, tous les jours à 11:30 UTC (≈ 6:30 EST / 7:30 EDT), soit ≥ 90 min après le refresh Porter Metrics de 5:00 ET
- **Rôle** — Détecte quotidiennement 4 types d'anomalies (spend mort, spend hors bande, tracking suspect, KPI hors bande) sur les données Meta Ads d'hier pour chaque client actif
- **Alertes** — Slack `#alertes-comptes` (webhook `SLACK_WEBHOOK_URL_ALERTS`), S1 mentionnent `@channel`
- **Heartbeat** — Slack `#ops-heartbeat` (webhook `SLACK_WEBHOOK_URL_HEARTBEAT`), envoyé chaque jour même si 0 anomalie ; **son absence = workflow mort**
- **En cas d'échec global** — message d'erreur explicite posté dans `#alertes-comptes` + réponse HTTP 500
- **Audit** — table `public.ad_anomaly_log` (une ligne par anomalie détectée, même celles skippées par la dédup)
- **Kill switch global** — `UPDATE cron.job SET active = FALSE WHERE jobname = 'ad-anomaly-daily-check';`
- **Kill switch par client** — désactiver le toggle « Activé » dans l'onglet Meta Ads de la fiche client (ou `UPDATE meta_dashboard_config SET anomaly_checks_enabled = FALSE WHERE client_code = 'CLI-XXXX';`)
- **Config par client** — carte « Check d'anomalies quotidien » dans `/admin/clients/:code` → onglet Meta Ads

## Les 4 checks

Tous les calculs se font sur les données d'hier, agrégées toutes campagnes × annonces confondues par jour (le champ `daily` de `meta-dashboard-data`).

1. **`spend_dead` — S1** : `spend = 0 $` et `daily_budget_planned > 0`
2. **`spend_off_band` — S1 (over) / S2 (under)** : `spend > 140 %` ou `< 50 %` du budget planifié
3. **`tracking_dead` — S2 (S1 au jour 2)** : `spend > 30 $` ET conversions = 0 ET moyenne 7j ≥ 1/jour
4. **`kpi_outlier` — S3** : ROAS (ecom) ou CPL (local) dévie de plus de 50 % vs moyenne 7j

**Cas limites gérés** :
- Moins de 7 jours d'historique → checks 3 & 4 sautés, 1 & 2 continuent
- Données d'hier absentes → alerte `data_missing` (S2) au lieu de faire crasher le check
- Erreur sur un client → n'interrompt pas les suivants, l'erreur devient elle-même une alerte `data_missing`
- Dédup : une alerte identique à celle envoyée la veille est skippée, sauf `tracking_dead` qui passe S2 → S1 au jour 2

## Structure des tables

### `meta_dashboard_config` (colonnes ajoutées)

| Colonne | Type | Défaut | Rôle |
|---|---|---|---|
| `client_type` | `text` | `'ecom'` | `ecom` \| `local` — pilote l'interprétation du check 4 |
| `daily_budget_planned` | `numeric(12,2)` | `100.00` | Budget quotidien attendu ($) |
| `conversion_metric` | `text` | `'purchases'` | `purchases` \| `leads` — quelle colonne Porter compter |
| `target_cpl_or_roas` | `numeric(12,2)` | `2.00` | Cible business (2.50 = ROAS 2.5× ou CPL 2.50 $) |
| `anomaly_checks_enabled` | `boolean` | `TRUE` | Kill switch par client |

### `ad_anomaly_log` (nouvelle)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` PK | — |
| `client_code` | `text` | Client concerné |
| `check_date` | `date` | Date des données analysées (= hier au moment du check) |
| `anomaly_type` | `text` | `spend_dead` \| `spend_off_band` \| `tracking_dead` \| `kpi_outlier` \| `data_missing` |
| `severity` | `text` | `S1` \| `S2` \| `S3` |
| `yesterday_value` | `numeric` | Valeur observée hier |
| `expected_value` | `numeric` | (réservé) |
| `baseline_value` | `numeric` | Moyenne 7j |
| `details` | `jsonb` | Payload libre (ratios, texte attendu, flag `dedup_skipped`) |
| `slack_sent` | `boolean` | `TRUE` si Slack posté ; `FALSE` si dédup ou erreur |
| `slack_error` | `text` | Message d'erreur Slack le cas échéant |
| `created_at` | `timestamptz` | Auto |

## Procédure de test — simuler chaque anomalie sur CLI-A7C02EF1

### Prérequis

- L'intégration Meta Ads doit être configurée pour `CLI-A7C02EF1` (sheet connecté, `active = TRUE`, `anomaly_checks_enabled = TRUE`)
- Avoir accès au shell Supabase (SQL Editor) ou au wrapper `scripts/proxy.ts`

### Dry-run général (aucun Slack, aucune écriture)

```bash
curl -X POST "https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/check-ad-anomalies" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "client_code": "CLI-A7C02EF1"}'
```

Réponse attendue : JSON avec `clients_checked: 1`, `anomalies_fired: N`, `per_client: [{...}]`. Ça te dit sans rien casser combien d'anomalies auraient été déclenchées.

### Simuler le check 1 — spend mort (S1)

```sql
-- Force un budget planifié > 0, puis vérifie qu'une journée à 0 $ existe déjà
-- dans le sheet Porter (ou attends la nuit où Meta ne dépense rien).
UPDATE meta_dashboard_config
   SET daily_budget_planned = 200
 WHERE client_code = 'CLI-A7C02EF1';
```

Puis lance :
```bash
curl -X POST ... -d '{"client_code": "CLI-A7C02EF1"}'
```
→ un message rouge `🔴 [S1] — spend mort` doit apparaître dans `#alertes-comptes` avec `@channel`.

### Simuler le check 2 — overspend (S1) / underspend (S2)

```sql
-- Overspend : baisse artificiellement le budget planifié sous le spend d'hier
UPDATE meta_dashboard_config SET daily_budget_planned = 10 WHERE client_code = 'CLI-A7C02EF1';

-- Underspend : monte le budget planifié bien au-dessus du spend d'hier
UPDATE meta_dashboard_config SET daily_budget_planned = 5000 WHERE client_code = 'CLI-A7C02EF1';
```

### Simuler le check 3 — tracking suspect (S2, S1 au jour 2)

Ce check nécessite `spend > 30 $ ET conversions = 0 ET moyenne 7j ≥ 1/jour`. Le plus simple : forcer une date où c'était réellement le cas dans l'historique du client, via `force_date`.

```bash
curl -X POST ... -d '{"client_code": "CLI-A7C02EF1", "force_date": "2026-08-10"}'
```

Pour tester l'escalade S2 → S1, laisse le cron tourner 2 jours d'affilée sur des données qui déclenchent, ou insère à la main dans `ad_anomaly_log` :
```sql
INSERT INTO ad_anomaly_log (client_code, check_date, anomaly_type, severity, slack_sent)
VALUES ('CLI-A7C02EF1', CURRENT_DATE - INTERVAL '2 days', 'tracking_dead', 'S2', TRUE);
```
Puis relance le check pour hier → doit émettre en S1.

### Simuler le check 4 — KPI hors bande (S3)

Utilise `force_date` pour sélectionner une journée d'historique connue pour avoir eu un ROAS/CPL très différent du reste de la semaine. Le check est purement informatif (S3, pas d'@channel).

### Simuler le heartbeat isolé

```bash
curl -X POST ... -d '{}'
```
Sans filtre client, le workflow boucle sur tous les clients actifs et poste toujours le heartbeat `✅` à la fin.

### Simuler l'échec global

Coupe temporairement le webhook Slack (invalide `SLACK_WEBHOOK_URL_ALERTS`) ou fais crasher `meta-dashboard-data` (par ex. RLS bloquant). Le workflow doit renvoyer HTTP 500 ET poster `⚠️ WORKFLOW ANOMALY CHECK EN ÉCHEC` dans `#alertes-comptes`.

## Ce qui reste côté Lovable (à faire une fois)

1. **Créer les 2 webhooks Slack** et ajouter les env vars sur le projet Supabase :
   - `SLACK_WEBHOOK_URL_ALERTS` → `#alertes-comptes`
   - `SLACK_WEBHOOK_URL_HEARTBEAT` → `#ops-heartbeat`
2. **Installer le cron** : ouvrir Supabase → SQL Editor → copier `supabase/cron/setup_ad_anomaly_cron.sql` → remplacer `<SERVICE_ROLE_KEY>` → Run
3. **Vérifier** : `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ad-anomaly%';`
