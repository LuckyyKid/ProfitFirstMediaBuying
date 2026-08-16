# Client Pulse System — Test End-to-End

Procédure pour valider le système complet en prod (Lovable Cloud + Supabase).
Compter ~30 minutes pour tout couvrir.

## Pré-requis

- Accès Supabase project `gcgwcjeryahysjwfznww` (SQL editor + Edge functions logs)
- Accès Lovable Cloud → Settings → Edge Functions (pour vérifier les secrets)
- Slack workspace TDIA avec accès à `#head-of-things`
- Accès admin TDIA (`/admin/dashboard`)
- Un **client cobaye** actif (`completed_at IS NOT NULL AND archived_at IS NULL`)
  avec un email de test (idéalement le tien ou `RESEND_SANDBOX_TO`)

## 0. Sanity check secrets

```sql
-- Doit renvoyer 4 lignes
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'pulse-%';
```

Vérifier dans Lovable Cloud → Settings → Edge Functions :
- `RESEND_API_KEY` ✅
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` ✅
- `CLICKUP_API_TOKEN` ✅
- `SLACK_WEBHOOK_URL` (= #head-of-things) ✅

## 1. Migration + GRANTs

```sql
-- Tables présentes
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'pulse_%';
-- → pulse_surveys, pulse_responses

-- Colonne clickup_task_id
SELECT column_name FROM information_schema.columns
  WHERE table_name='client_progress' AND column_name='clickup_task_id';

-- GRANTs
SELECT grantee, privilege_type FROM information_schema.role_table_grants
  WHERE table_name IN ('pulse_surveys','pulse_responses');
-- → authenticated:SELECT, service_role:ALL

-- Registry
SELECT workflow_id, criticality, active FROM automation_registry
  WHERE workflow_id='client_pulse';
```

## 2. Envoi manuel — pulse onboarding (bouton admin)

1. `/admin/dashboard` → menu ⋮ du client cobaye → **Envoyer pulse onboarding**
2. Toast attendu : `Pulse onboarding envoyé à <email>`
3. Vérifier en DB :
   ```sql
   SELECT id, type, sent_channels, manual, created_by, previous_score
     FROM pulse_surveys WHERE client_code='<code>' ORDER BY sent_at DESC LIMIT 1;
   -- → type='onboarding', manual=true, sent_channels contient 'email' (et 'sms' si téléphone)
   ```
4. Vérifier réception email (design TDIA, 11 boutons 0-10 cliquables)
5. Vérifier réception SMS (si téléphone présent) — URL courte vers pulse-response

## 3. Micro-page + capture score

1. Cliquer sur `7` dans l'email
2. Micro-page attendue :
   - Fond TDIA noir, logo, bandeau
   - « Reçu ton 7/10 »
   - Question verbatim adaptée au score (7-8 → « Qu'est-ce qui te ferait mettre 10 ? »)
   - Textarea + bouton « Envoyer » + lien « Je passe »
3. Vérifier en DB :
   ```sql
   SELECT r.score, r.source, s.closed_at, s.slack_posted_at, s.clickup_commented_at
     FROM pulse_responses r JOIN pulse_surveys s ON s.id=r.survey_id
     WHERE s.client_code='<code>' ORDER BY s.sent_at DESC LIMIT 1;
   -- → score=7, source='client_email_click', closed_at=set, slack_posted_at=set,
   --    clickup_commented_at=set (SI clickup_task_id présent)
   ```
4. **Slack** : nouveau message dans `#head-of-things` :
   ```
   🟡 *Pulse Onboarding J+7* — *<Client>* — *7/10* — _passif_
   > Question au prochain weekly
   ```
5. **ClickUp** : commentaire ajouté sur la tâche client (liste `901714791842`)

## 4. Verbatim POST

1. Sur la même micro-page, taper un verbatim et cliquer « Envoyer »
2. Page merci « C'est envoyé » + message adapté au score (« On en parle au prochain weekly »)
3. Vérifier :
   ```sql
   SELECT verbatim, verbatim_at FROM pulse_responses
     WHERE survey_id='<id>';
   -- → verbatim = ton texte, verbatim_at set
   ```

## 5. Trajectoire (2e envoi)

1. Refaire un envoi manuel : **Envoyer pulse mensuel** au même client
2. Cliquer `4` dans le nouvel email
3. Slack attendu (chute 7→4 = -3) :
   ```
   🟠 *Pulse Pulse mensuel* — *<Client>* — *4/10* (dernier : 7) — _chute de 3 pt_
   > Priorité — trajectoire en baisse, call ASAP
   ```
4. Vérifier `previous_score=7` dans la nouvelle ligne `pulse_surveys`

## 6. NPS relationnel manuel

1. Menu ⋮ du client → **Logger NPS relationnel**
2. Dialog : choisir score `9`, verbatim « Super team, très réactifs »
3. Cliquer « Enregistrer + poster »
4. Toast : `NPS 9/10 loggé. Slack : ok. ClickUp : ok.`
5. Slack :
   ```
   🟢 *NPS relationnel (call)* — *<Client>* — *9/10* — _promoteur_
   > Demander témoignage / référence
   > _"Super team, très réactifs"_
   ```
6. Vérifier `pulse_surveys.type='relational', manual=true, closed_at=now`
   et `pulse_responses.source='nps_relational_manual'`

## 7. Historique dans fiche client

1. `/admin/clients/<code>` → onglet **Pulse**
2. Doit afficher les 3 pulses créés ci-dessus avec :
   - Type + badge manuel
   - Statut « Répondu »
   - Score coloré (jaune / orange / vert)
   - Verbatim en italique
   - Date d'envoi + réponse + canaux

## 8. Non-réponse — relance J+1

**Simulation** (raccourcir sent_at pour déclencher la relance) :
```sql
-- Prendre une survey ouverte, la vieillir de 25h
UPDATE pulse_surveys
  SET sent_at = NOW() - INTERVAL '25 hours'
  WHERE client_code='<code>' AND closed_at IS NULL
  ORDER BY sent_at DESC LIMIT 1
  RETURNING id;
```

Puis trigger le followup manuellement :
```bash
curl -X POST https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-cron-followup \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
```

Attendu :
- Nouveau email + SMS reçus (variant='followup' : « Petit rappel »)
- `followup_sent_at=set`, `followup_count=1`
- Réponse JSON : `outcomes[].action='followup_sent'`

## 9. Non-réponse — escalade J+2

```sql
UPDATE pulse_surveys
  SET sent_at = NOW() - INTERVAL '50 hours'
  WHERE id='<survey_id_de_l_étape_8>';
```

Trigger followup again :
```bash
curl -X POST .../pulse-cron-followup -H ... -d '{}'
```

Attendu :
- Message Slack `#head-of-things` :
  ```
  🟠 *Non-réponse pulse Onboarding J+7* — *<Client>* — 48h sans réponse
  > Envoyé le YYYY-MM-DD · 1 relance envoyée le YYYY-MM-DD
  > Action : call ou mention au prochain weekly. Fenêtre fermée.
  ```
- `escalated_at=set`, `closed_at=set`

## 10. Recap mensuel manuel

```bash
# Récap du mois précédent (auto)
curl -X POST https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-recap-monthly \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manual":true}'

# Ou pour un mois spécifique
curl -X POST .../pulse-recap-monthly -d '{"manual":true,"month":"2026-08"}' -H ...
```

Attendu :
- Message Slack `#head-of-things` avec table markdown (Client / Type / Score / Note)
- Ligne stats : `🔴 X · 🟡 Y · 🟢 Z · 🟠 W`
- Réponse JSON : `{ ok, month, responses, surveys_sent, response_rate_pct, ... }`

## 11. Cron horaire — onboarding

```bash
curl -X POST https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/pulse-send \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"cron","type":"onboarding"}'
```

Attendu :
- JSON `{ ok, candidates: N, sent: M, ... }` — `candidates` = clients avec
  `completed_at` dans la fenêtre J-7 ± 12h qui n'ont pas eu de pulse
  onboarding dans les 30 derniers jours
- Ping `automation-ping` avec `workflow_id='client_pulse'`, `items_count=M`

## 12. Cron monthly — gate LBD

```bash
# Un jour aléatoire : doit skipper
curl -X POST .../pulse-send -d '{"trigger":"cron","type":"monthly"}' -H ...
# → { skipped_reason: "not last business day of month" }
```

Pour tester le vrai comportement : simuler la date en modifiant temporairement
`BIZDAY_TZ` ou attendre le dernier jour ouvrable du mois.

## 13. Backfill ClickUp

```bash
# Dry-run
curl -X POST .../backfill-clickup-task-ids -H ... -d '{}'
# → { summary: { matched, unmatched, ... }, matched: [...], unmatched: [...] }
```

Vérifier que les matches ont du sens (mêmes noms de client / entreprise).

```bash
# Apply si OK
curl -X POST .../backfill-clickup-task-ids -H ... -d '{"apply":true}'
```

Puis :
```sql
SELECT COUNT(*) FROM client_progress WHERE clickup_task_id IS NOT NULL;
```

## 14. Cleanup après tests

```sql
-- Supprime les surveys de test (⚠️ ne pas faire en prod avec de vrais clients)
DELETE FROM pulse_surveys WHERE client_code='<code_cobaye>' AND created_by='admin_manual';
```

## Troubleshooting

| Symptôme                                | Cause probable                           | Fix                                                       |
|------------------------------------------|------------------------------------------|-----------------------------------------------------------|
| Email envoyé mais pas reçu               | RESEND en sandbox                        | Vérifier `RESEND_SANDBOX_TO`                              |
| SMS pas envoyé                           | Twilio secrets manquants                 | Set `TWILIO_*` dans Lovable Cloud                         |
| Slack silencieux                         | `SLACK_WEBHOOK_URL` manquant/invalide    | Refresh webhook dans Slack app                            |
| ClickUp comment silencieux               | `clickup_task_id` NULL sur `client_progress` | Run `backfill-clickup-task-ids` puis link manuel      |
| Micro-page renvoie 401                   | `verify_jwt` pas à `false`               | Vérifier `supabase/config.toml` + redéployer              |
| Cron monthly skippe toujours             | Gate LBD (normal les 29 autres jours)    | Attendre LBD ou trigger manuel avec `manual:true`         |
| `automation_registry` alerte             | Aucun ping dans les 26h                  | Vérifier logs des 4 crons + `pingAutomation` dans code    |
