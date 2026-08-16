# Client Pulse System

Sonde de satisfaction client — TDIA Agency. Trois types de pulse envoyés
automatiquement ou manuellement, réponses capturées en 1 clic, routées vers
Slack `#head-of-things` et commentées sur la tâche ClickUp du client.

## Vue d'ensemble

```
                 ┌────────────────────────────────────────┐
   cron horaire  │ pulse-send { type: onboarding|monthly }│
   + boutons UI  │  → sélectionne clients, envoie email + │
                 │    SMS, INSERT pulse_surveys           │
                 └────────────────┬───────────────────────┘
                                  │ (client clique 0-10 dans l'email)
                                  ▼
                 ┌────────────────────────────────────────┐
   micro-page    │ pulse-response ?token=X&score=N        │
   publique      │  → INSERT pulse_responses              │
                 │  → notify-slack-channel (#head-of-...) │
                 │  → ClickUp task comment                │
                 │  → form verbatim optionnel (POST)      │
                 └────────────────────────────────────────┘

   cron horaire  ┌────────────────────────────────────────┐
                 │ pulse-cron-followup                    │
                 │  J+1 (24h) : relance email + SMS       │
                 │  J+2 (48h) : escalade Slack + close    │
                 └────────────────────────────────────────┘

   cron daily    ┌────────────────────────────────────────┐
                 │ pulse-recap-monthly (1er jour ouvrable │
                 │ du mois) : table Slack du mois écoulé  │
                 └────────────────────────────────────────┘

   admin UI      ┌────────────────────────────────────────┐
                 │ pulse-nps-log (après call stratégique) │
                 │  → INSERT survey type=relational       │
                 │  → Slack + ClickUp (mêmes règles)      │
                 └────────────────────────────────────────┘
```

## Tables

- `pulse_surveys` — un envoi (ou saisie manuelle) = une ligne. Colonnes clés :
  `type`, `token` (UUID hex), `sent_at`, `expires_at` (défaut J+7), `closed_at`,
  `followup_sent_at`, `escalated_at`, `previous_score` (trajectoire), `manual`,
  `slack_posted_at`, `clickup_commented_at`.
- `pulse_responses` — 1:1 avec `pulse_surveys` via `survey_id UNIQUE`. Colonnes :
  `score` (0-10), `verbatim`, `verbatim_at`, `source` (`client_email_click` |
  `nps_relational_manual` | `admin_manual`).
- `client_progress.clickup_task_id TEXT` — ajouté pour attacher les commentaires
  pulse à la tâche ClickUp qui représente le client (liste `901714791842`).

## Edge functions

| Function              | Rôle                                                     | Trigger                        |
|-----------------------|----------------------------------------------------------|--------------------------------|
| `pulse-send`          | Envoi email Resend + SMS Twilio (cron ou manuel)         | pg_cron horaire + bouton admin |
| `pulse-response`      | Micro-page publique (score capture + verbatim)           | Lien dans email / SMS          |
| `pulse-cron-followup` | Relance J+1, escalade Slack J+2                          | pg_cron horaire                |
| `pulse-nps-log`       | Log manuel NPS relationnel (post-call)                   | Dialog `LogNpsDialog`          |
| `pulse-recap-monthly` | Récap mensuel Slack (1er jour ouvrable du mois)          | pg_cron daily + `manual: true` |

`pulse-response` a `verify_jwt = false` dans `supabase/config.toml` (public).

## Règles Slack (posté 1x max par survey)

| Score  | Emoji | Label     | Action                                    |
|--------|-------|-----------|-------------------------------------------|
| 0-6    | 🔴    | détracteur| Call récupération 24-48h                  |
| 7-8    | 🟡    | passif    | Question au prochain weekly               |
| 9-10   | 🟢    | promoteur | Demander témoignage / référence           |
| **Trajectoire ≥ 2 pts en baisse** vs `previous_score` → 🟠 (prioritaire sur la couleur) |

Channel routing : `notify-slack-channel` avec `channel: "profile"` →
`SLACK_WEBHOOK_URL` (= #head-of-things).

## Cadence

- **Onboarding J+7** — cron horaire `0 * * * *`, fenêtre de sélection ±12h
  autour de J-7 (`completed_at`). Anti-dedup : 30 jours.
- **Monthly** — cron daily `0 15 * * *` (~11:00 EDT), gate `isLastBusinessDayOfMonth()`
  dans l'edge function (TZ Toronto). Anti-dedup : 20 jours.
- **Followup** — cron horaire `15 * * * *`, traite les surveys ouvertes.
- **Recap** — cron daily `0 16 * * *`, gate `isFirstBusinessDayOfMonth()`.

Toutes les fenêtres :
- Expiration survey : 7 jours (`EXPIRES_DAYS`)
- Relance : après 24h sans réponse (`FOLLOWUP_AFTER_HOURS`)
- Escalade : après 48h sans réponse (`ESCALATE_AFTER_HOURS`)

## Secrets requis (Lovable Cloud → Settings → Edge Functions)

| Secret                                | Utilisé par                       | Requis  |
|---------------------------------------|-----------------------------------|---------|
| `SUPABASE_URL`                        | toutes                            | ✅ auto |
| `SUPABASE_SERVICE_ROLE_KEY`           | toutes (DB writes)                | ✅ auto |
| `SUPABASE_ANON_KEY`                   | pulse-response, followup, nps-log (call notify-slack-channel) | ✅ auto |
| `RESEND_API_KEY`                      | pulse-send, pulse-cron-followup   | ✅      |
| `RESEND_SANDBOX_TO`                   | fallback test (optionnel)         | ⚠️      |
| `EMAIL_FROM`                          | pulse-send, followup (défaut `TDIA <onboarding@resend.dev>`) | ⚠️ |
| `TWILIO_ACCOUNT_SID`                  | pulse-send, followup              | ✅      |
| `TWILIO_AUTH_TOKEN`                   | pulse-send, followup              | ✅      |
| `TWILIO_FROM_NUMBER`                  | pulse-send, followup              | ✅      |
| `CLICKUP_API_TOKEN`                   | pulse-response, nps-log, backfill | ✅      |
| `SLACK_WEBHOOK_URL`                   | notify-slack-channel (profile)    | ✅      |
| `PULSE_BASE_URL`                      | pulse-send, followup (défaut `${SUPABASE_URL}/functions/v1`) | ⚠️ |

## Automation monitoring

- `automation_registry.workflow_id = 'client_pulse'` — criticality S2, cadence
  26h. Ping par `pulse-send`, `pulse-cron-followup`, `pulse-recap-monthly`.
- Le watchdog quotidien (`automation-watchdog`) alertera dans `#automations-alertes`
  si aucun ping n'arrive dans les 26h.

## Usage admin

- **Onglet Admin → carte client → menu ⋮** :
  - « Envoyer pulse onboarding » — force un envoi manuel (bypasse anti-dedup)
  - « Envoyer pulse mensuel » — idem
  - « Logger NPS relationnel » — ouvre le dialog `LogNpsDialog` (score + verbatim)
- **Fiche client (`/admin/clients/:code`) → onglet Pulse** — historique des
  50 derniers envois avec statut (répondu / en attente / escaladé), score,
  trajectoire (dernier score), verbatim, canaux envoyés.

## Backfill ClickUp task_id

Les clients créés avant la Tranche 5 ont `clickup_task_id = NULL`. Utiliser
l'endpoint `backfill-clickup-task-ids` pour les linker à leurs tâches ClickUp
existantes (matching par custom fields + task name — aucune création).

```bash
# Dry-run
curl -X POST https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/backfill-clickup-task-ids \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'

# Apply
curl -X POST .../backfill-clickup-task-ids -d '{"apply":true}' -H ...
```

Les clients unmatched doivent être linkés à la main :
```sql
UPDATE client_progress SET clickup_task_id = '<task_id>' WHERE client_code = '<code>';
```

## Installation pg_cron

Voir `supabase/cron/setup_pulse_crons.sql`. À exécuter une fois par environnement
depuis SQL Editor, avec `<SERVICE_ROLE_KEY>` remplacé par le vrai token.

Vérification :
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'pulse-%';
```

## How to pause

```sql
-- Pause tout le système
UPDATE cron.job SET active = FALSE WHERE jobname LIKE 'pulse-%';
UPDATE automation_registry SET active = FALSE WHERE workflow_id = 'client_pulse';

-- Reprendre
UPDATE cron.job SET active = TRUE WHERE jobname LIKE 'pulse-%';
UPDATE automation_registry SET active = TRUE WHERE workflow_id = 'client_pulse';
```
