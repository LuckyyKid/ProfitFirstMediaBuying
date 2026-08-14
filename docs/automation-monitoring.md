# Automation Error Monitoring

Dead-man's-switch centralisé pour toutes les automations TDIA — plateforme-agnostique. Les automations rapportent au système, pas l'inverse.

## Fiche d'automation (à ajouter au registre)

- **Nom** — `automation-watchdog-daily`
- **Déclencheur** — pg_cron `automation-watchdog-daily`, tous les jours à 12:00 UTC (07:00 EST / 08:00 EDT), 30 min après `ad-anomaly-daily-check`
- **Rôle** — Vérifie que chaque automation active du registre a pingé "success" dans sa cadence attendue ; poste un heartbeat quotidien ; ping healthchecks.io pour se surveiller lui-même
- **Alertes** — Slack `#automations-alertes` (webhook `SLACK_WEBHOOK_URL_AUTOMATIONS_ALERTS`), S1 mentionnent `@channel`
- **Heartbeat** — Slack `#automations-heartbeat` (webhook `SLACK_WEBHOOK_URL_AUTOMATIONS_HEARTBEAT`) ; son absence + email healthchecks = watchdog mort
- **En cas d'échec global** — message `⚠️ WATCHDOG ERROR MONITORING EN ÉCHEC` posté dans `#automations-alertes` + HTTP 500
- **Audit** — `public.automation_run_log` (chaque ping) et `public.automation_error_log` (chaque alerte, y compris dédup)
- **Kill switch global** — `UPDATE cron.job SET active = FALSE WHERE jobname = 'automation-watchdog-daily';`
- **Kill switch par workflow** — `UPDATE automation_registry SET active = FALSE WHERE workflow_id = 'X';`

## Architecture

```
┌─────────────────┐       POST /automation-ping        ┌────────────────────────┐
│  toutes tes     │──────────────────────────────────▶ │  automation-ping       │
│  automations    │   {workflow_id, status, ...}       │  edge function         │
└─────────────────┘                                    │                        │
                                                       │  1. run_log INSERT     │
                                                       │  2. si failure :       │
                                                       │     storm → dédup →    │
                                                       │     Slack + error_log  │
                                                       └────────────────────────┘

                                                        pg_cron 12:00 UTC
                                                              │
                                                              ▼
                                                       ┌────────────────────────┐
                                                       │  automation-watchdog   │
                                                       │  edge function         │
                                                       │                        │
                                                       │  Pour chaque registre  │
                                                       │  actif : dernier       │
                                                       │  success dans cadence?│
                                                       │  → Slack cadence-miss │
                                                       │  Heartbeat + HC.io    │
                                                       └────────────────────────┘
```

## Tables

### `automation_registry` — registre + documentation

| Colonne | Type | Rôle |
|---|---|---|
| `workflow_id` | `text` PK | Identifiant technique (snake_case, ex: `lead_routing`) |
| `name` | `text` | Nom lisible pour Slack |
| `criticality` | `text` | `S1` \| `S2` \| `S3` |
| `expected_cadence_hours` | `integer` | Nb max d'heures entre deux success pings |
| `owner` | `text` | Email du responsable |
| `active` | `boolean` | `false` = watchdog ignore |
| `description` | `text` | À quoi sert ce workflow |
| `notify_on_failure` | `text` | Destinataires additionnels (au-delà de Slack) |
| `how_to_pause` | `text` | Runbook exact pour pauser proprement |

Cette table EST le système de documentation des automations.

### `automation_run_log` — chaque ping reçu

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` PK | — |
| `workflow_id` | `text` | Peut être hors registre (déclenche alerte S2) |
| `status` | `text` | `success` \| `failure` |
| `error_message` | `text` | Fournit le playbook du premier geste (regex-based) |
| `items_count` | `integer` | Nombre d'items traités (pour visibilité "combien de leads perdus") |
| `run_url` | `text` | Lien vers l'exécution dans la plateforme d'origine |
| `received_at` | `timestamptz` | Auto |

### `automation_error_log` — registre d'incidents (MTTD/MTTR)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` PK | — |
| `workflow_id` | `text` | `null` pour les alertes `storm` |
| `severity` | `text` | `S1` \| `S2` \| `S3` |
| `error` | `text` | Message court affiché |
| `details` | `jsonb` | `{source: 'ping'\|'storm'\|'watchdog'\|'watchdog_undocumented', repeat_count, escalated, ...}` |
| `slack_sent` | `boolean` | `false` si dédup ou erreur Slack |
| `slack_error` | `text` | — |
| `resolved` / `resolved_at` | `boolean`/`timestamptz` | À marquer manuellement (source MTTR) |
| `created_at` | `timestamptz` | Auto |

## Pattern d'intégration côté automation

Chaque automation ajoute DEUX appels HTTP :

- **En dernière étape du chemin nominal** : `status: "success"`
- **Dans le chemin d'erreur / catch** : `status: "failure"` avec `error_message`

### curl (test / doc)

```bash
# Success
curl -X POST "https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-ping" \
  -H "Content-Type: application/json" \
  -H "X-Automation-Token: $AUTOMATION_PING_TOKEN" \
  -d '{
    "workflow_id": "lead_routing",
    "status": "success",
    "items_count": 3
  }'

# Failure
curl -X POST "https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-ping" \
  -H "Content-Type: application/json" \
  -H "X-Automation-Token: $AUTOMATION_PING_TOKEN" \
  -d '{
    "workflow_id": "lead_routing",
    "status": "failure",
    "error_message": "HubSpot 401 unauthorized",
    "items_count": 1,
    "run_url": "https://make.com/scenarios/12345/executions/abc"
  }'
```

### Node / edge function

```ts
async function pingAutomation(status: "success" | "failure", extra: Record<string, unknown> = {}) {
  await fetch("https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-ping", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Automation-Token": Deno.env.get("AUTOMATION_PING_TOKEN")!,
    },
    body: JSON.stringify({ workflow_id: "lead_routing", status, ...extra }),
  }).catch((e) => console.warn("[automation-ping]", e));
}
```

### Module HTTP no-code (Make / Zapier / n8n)

- **Method** — `POST`
- **URL** — `https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-ping`
- **Headers** — `Content-Type: application/json` + `X-Automation-Token: {{env.AUTOMATION_PING_TOKEN}}`
- **Body (JSON)** :
  ```json
  {"workflow_id": "lead_routing", "status": "success", "items_count": {{count}}}
  ```
- **Placement** — un module HTTP en fin de scénario (branche success) ET un dans un "Error handler" (branche failure)

### Convention obligatoire pour tout nouveau workflow

1. Choisir un `workflow_id` (snake_case, unique).
2. Ajouter la ligne dans `automation_registry` AVANT de déployer le workflow (sinon → alerte "non documenté").
3. Ajouter les DEUX pings dans le code / scénario.
4. Tester avec `dry_run` sur `automation-watchdog` pour confirmer que la cadence est raisonnable.

## Setup — secrets à créer côté Supabase

| Secret | Valeur |
|---|---|
| `AUTOMATION_PING_TOKEN` | Chaîne aléatoire longue (32+ caractères), partagée avec les automations |
| `SLACK_WEBHOOK_URL_AUTOMATIONS_ALERTS` | Incoming webhook du bot `kpi_anomaly_alert_sys` vers `#automations-alertes` |
| `SLACK_WEBHOOK_URL_AUTOMATIONS_HEARTBEAT` | Incoming webhook du même bot vers `#automations-heartbeat` |
| `HEALTHCHECKS_WATCHDOG_URL` | URL de ping du check quotidien créé sur healthchecks.io |

## Healthchecks.io — setup rapide

1. Compte déjà créé.
2. New check → nom `automation-watchdog-daily` → Schedule `Simple` : Period `1 day`, Grace time `2 hours`.
3. Alerts → confirme ton email destinataire (par défaut celui du compte).
4. Copier l'URL de ping (format `https://hc-ping.com/<uuid>`) → mettre en secret Supabase `HEALTHCHECKS_WATCHDOG_URL`.
5. Si le watchdog rate un jour → healthchecks.io t'envoie un email dans les 2 h.

## Procédure de test

### Dry-run watchdog (aucun Slack, aucune écriture)

```bash
curl -X POST "https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/automation-watchdog" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

Réponse : liste des overdue, undocumented, comptes — sans effet secondaire.

### (a) Simuler un ping failure S1

```bash
curl -X POST ".../automation-ping" \
  -H "X-Automation-Token: $AUTOMATION_PING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id":"lead_routing","status":"failure","error_message":"HubSpot API 500","run_url":"https://example.com/run/1"}'
```

→ Un message `⚠️ [S1] ÉCHEC — Routage leads entrants` avec `@channel` dans `#automations-alertes`.

Relance-le 3 fois de suite → seule la première alerte part, les suivantes incrémentent `details.repeat_count` (visible dans `automation_error_log`).

### (b) Simuler une cadence manquée

Le plus simple sans attendre 26 h : marquer temporairement une automation avec une cadence très courte, puis lancer le watchdog.

```sql
-- Force la cadence à 1 minute (=0.017 h) sur une automation qui n'a jamais pingé
UPDATE automation_registry
   SET expected_cadence_hours = 0
 WHERE workflow_id = 'creative_approval';
```

```bash
curl -X POST ".../automation-watchdog" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -d '{}'
```

→ Alerte `[S2] CADENCE MANQUÉE — Approbation créative`. Puis restore : `UPDATE automation_registry SET expected_cadence_hours = 26 WHERE workflow_id = 'creative_approval';`.

Pour tester l'**escalade S2 → S1**, insère à la main la trace du "run d'hier" :
```sql
INSERT INTO automation_error_log (workflow_id, severity, error, details)
VALUES ('creative_approval', 'S2', 'cadence missed (test)',
        jsonb_build_object('source','watchdog','hours_since_success', 30));
UPDATE automation_error_log
   SET created_at = NOW() - INTERVAL '25 hours'
 WHERE workflow_id = 'creative_approval' AND created_at > NOW() - INTERVAL '5 minutes';
```
Puis relance le watchdog → l'alerte doit sortir en `S1` avec la note "Escalade automatique".

### (c) Simuler la storm (≥ 5 échecs en 10 min)

```bash
for w in lead_routing closed_won client_onboarding follow_up_stuck_clients payment_invoice; do
  curl -X POST ".../automation-ping" \
    -H "X-Automation-Token: $AUTOMATION_PING_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"workflow_id\":\"$w\",\"status\":\"failure\",\"error_message\":\"test storm\"}"
done
```

→ Sur le 5e ping (ou dès qu'on atteint 5 workflows distincts en 10 min), UN seul message `🌩️ PANNE MULTIPLE : lead_routing, closed_won, ...` avec `@channel`. Les alertes individuelles pour les 5 workflows sont supprimées.

### (d) Simuler le heartbeat isolé

```bash
curl -X POST ".../automation-watchdog" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -d '{}'
```
→ Message `✅ Error monitoring YYYY-MM-DD — N automations surveillées, X alertes émises, Y en retard` dans `#automations-heartbeat`.

### (e) Simuler l'échec global du watchdog

Coupe temporairement `SLACK_WEBHOOK_URL_AUTOMATIONS_ALERTS` (mets une valeur invalide) puis force une erreur (par ex. drop temporairement `automation_registry`). Le watchdog doit poster `⚠️ WATCHDOG ERROR MONITORING EN ÉCHEC` dans le canal des alertes (via le même webhook si mort → le missing heartbeat + healthchecks.io compensent).

## Auto-monitoring — ajouter le ping dans les workflows Supabase existants

Une fois le système en prod, ajouter le ping en fin de :

- `check-ad-anomalies` → `workflow_id: "ad_anomaly_check"` (déjà déclaré au registre)
- `follow-up-stuck-clients` → `workflow_id: "follow_up_stuck_clients"`
- toute autre edge function du repo lancée par cron

Sans ces pings, le watchdog émettra `[S2] CADENCE MANQUÉE` sur ces workflows après la période attendue — c'est exactement le comportement voulu, mais autant les faire pinger tout de suite.

## Ce qui reste côté Lovable (à faire une fois)

1. **Créer les 2 incoming webhooks Slack** dans l'app `kpi_anomaly_alert_sys` (channels `#automations-alertes` et `#automations-heartbeat`) et ajouter les env vars sur le projet Supabase.
2. **Créer le secret** `AUTOMATION_PING_TOKEN` (32+ caractères aléatoires).
3. **Créer le check healthchecks.io** et ajouter `HEALTHCHECKS_WATCHDOG_URL`.
4. **Appliquer la migration** `supabase/migrations/20260814130000_automation_monitoring.sql`.
5. **Déployer** les 2 edge functions `automation-ping` et `automation-watchdog`, et mettre à jour `notify-slack-channel` (nouvelles clés de routing).
6. **Installer le cron** : copier `supabase/cron/setup_automation_watchdog_cron.sql` dans SQL Editor → Run.
7. **Vérifier** : `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'automation-%';`
