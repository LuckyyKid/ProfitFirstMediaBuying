# Hemrock Formulas — extraites + intégrées TDIA

Source : `Ecommerce_Forecasting_Tool_by_Hemrock-2.xlsx` + `Standard_Financial_Model_by_Hemrock.xlsx`.
Implémentation : `src/gos/hemrockForecast.ts` (moteur), `scripts/validate-hemrock-forecast.ts` (golden).

## 1. Retention curve (rows 41 & 44 Forecast)

Cellule Hemrock : `T41 = if(t=1, 1, if(mod(t, cycle)=0, (1-churn) * offset(prev_cycle_val), 0))`

Traduction :
```
retention[1] = 1
retention[t] = retention[t - cycle] * (1 - churn_per_cycle)   si (t-1) mod cycle = 0
             = 0                                              sinon
```
→ `buildRetentionCurve()` dans `hemrockForecast.ts`.

## 2. Cohort waterfall (rows 104..151 × 48 mois)

Cellule Hemrock : `T104 = if(t<cohort_month, 0, retention[t - cohort_month + 1] × new_customers[cohort_month] × adjustment)`

`orders[t] = Σ_{c=1..t} new_customers[c] × retention[t-c+1] × cohort_adj(c)`
→ boucle double dans `runHemrockForecast()`.

## 3. Compound rate-of-change (rows 159, 161, 165, 168)

Hemrock traite les taux comme des variables qui elles-mêmes évoluent :
- `rate[t] = rate[t-1] × (1 + change_in_rate)` (le taux de variation évolue chaque mois)
- `value[t] = value[t-1] × (1 + rate[t])` (la valeur évolue selon le taux courant)

Appliqué à AOV new/repeat, CoS%, CAC, growth in new customers.
→ `compoundSeries()` + `valueCompound()`.

## 4. New customers per month (row 52)

`new_customers[t] = new_customers[t-1] × (1 + growth_rate[t])`
`growth_rate[t] = growth_rate[t-1] × (1 + change_in_growth)`

## 5. P&L par mois (rows 171..188)

| Métrique | Formule Hemrock | TDIA |
|---|---|---|
| Revenue | `orders_new × AOV_new + orders_repeat × AOV_repeat` | ✅ `monthly[i].revenue` |
| Shipping Rev | `orders × shipping_rev_per_order` | ✅ |
| COGS | `revenue × cos_pct` (+ extras) | ✅ |
| Marketing Spend | `orders_new × CAC_new + orders_repeat × CAC_repeat` | ✅ |
| Operating Income | `total_revenue - total_cogs - marketing_spend` | ✅ |
| AOV réalisé | `revenue / orders` | ✅ |
| Contribution margin/order | `GM_per_order + shipping_margin - CAC_per_order` | ✅ |
| Website Traffic | `orders / conversion_rate` | ✅ |

## 6. LTV (row 191)

`LTV = (AOV_new + AOV_repeat × (lifetime_orders - 1)) × (1 - Σ cos_pct) + shipping_margin × lifetime_orders`

où `lifetime_orders = Σ retention_curve` (= I44 dans le sheet).

## 7. Key Metrics annuels (feuille Snapshot + Key Metrics du financial model)

- **CAC blended** : `Σ marketing_spend / Σ new_customers`
- **CAC payback (mois)** : `CAC / (gross_profit_per_customer / 12)`
- **LTV:CAC** : `LTV / CAC_blended`
- **Y/Y growth** : `revenue_this_year / revenue_last_year - 1`

Tous exposés dans `HemrockOutput.annual[]`.

## 8. Différences avec l'existant TDIA

| Bloc | Avant | Après |
|---|---|---|
| Retention | approximation "churn_per_cycle" flat (PFMB) | courbe géométrique multi-cycles réplique Hemrock |
| LTV | `ltvNewOverHorizon` linéaire par cycle | LTV cohorte-waterfall (agrégé sur toutes cohortes actives) |
| Forecast mensuel | agrégat scalaire (v1/v2) | waterfall 48 mois × cohortes |
| P&L waterfall | `computePnlSnapshot` (statique) | P&L mensuel évolutif avec rates compoundés |
| Growth rate | scalaire | growth qui décélère mois par mois (rate-of-change) |

## 9. Comment brancher côté data

Inputs déjà présents en DB :
- `gos_basket_economics` : aov_new, aov_repeat, cos_pct, cac_new, cac_repeat, churn_per_cycle, repeat_cycle_months, conversion_rate
- `gos_financial_inputs` : cash, burn (pour PFMB)
- **Manquant** : growth_rate_start & growth_rate_change (manuel), starting_new_customers (peut venir de Shopify), aov_rate_change (peut être estimé sur 12mo Shopify).

Mode auto minimum viable = Shopify backfill + 2 inputs manuels (growth targets).

## 10. Golden tests

`bun scripts/validate-hemrock-forecast.ts` → 4 groupes, 15 assertions.
