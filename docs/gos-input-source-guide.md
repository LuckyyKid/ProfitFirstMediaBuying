# GOS Input Source Guide

Ce document explique quoi mettre dans chaque section du GOS / Profit System, ou recuperer la donnee, quand la mettre a jour, et comment savoir si l'input est fiable.

Objectif du document: un account manager doit pouvoir ouvrir une section, comprendre exactement quoi remplir, et ne pas inventer une valeur au hasard.

## Regle centrale

Un input doit toujours venir d'une source identifiable.

Sources valides:

- Client: kickoff, questionnaire, call, Slack/email, objectifs internes, contraintes business.
- Ecommerce platform: Shopify, WooCommerce, Stripe, ERP, OMS, warehouse, inventory system.
- Ad platforms: Meta Ads, Google Ads, TikTok Ads, Klaviyo paid/social reports.
- Finance: P&L, COGS, marge brute, cash disponible, payout delay, frais variables, burn mensuel.
- GOS: forecast, objectifs verrouilles, P&L daily/weekly, buyer decisions, budget gates, model runs.
- AM judgement: seulement quand aucune source n'existe. Dans ce cas, marquer l'input comme hypothese et baisser la confiance.

Ne pas mettre `0` pour une donnee manquante si `0` changerait la decision. Ecrire `missing`, laisser vide si la page le permet, ou mettre une hypothese explicite avec note.

## Niveau de confiance des inputs

Utilise cette grille mentalement avant de remplir un champ.

### Haute confiance

La donnee vient directement d'une integration ou d'un export officiel.

Exemples:

- Revenue Shopify des 30 derniers jours.
- Spend Meta Ads du mois.
- Stock disponible dans l'ERP.
- COGS fourni par le client dans un fichier finance.

### Moyenne confiance

La donnee vient d'un export manuel ou d'une estimation client credible.

Exemples:

- Marge brute moyenne communiquee par le CFO.
- CPM moyen calcule depuis un rapport Meta exporte.
- Payout delay moyen estime par le client.

### Faible confiance

La donnee est une hypothese de travail.

Exemples:

- Lift Black Friday estime sans historique.
- Seuil de fatigue creatif choisi par benchmark.
- Incrementality factor sans test de lift.

Quand l'input est faible confiance, la bonne pratique est de le documenter dans la note du champ ou dans Map Notes / Learning Loop.

## Routine 1: Nouveau client

Objectif: produire le premier plan Profit First 30 jours.

Outcome attendu:

- rentabilite visee;
- spend approximatif;
- commandes attendues;
- CAC / MER cible;
- plafond de risque;
- volume creatif requis;
- SKU a surveiller;
- structure de campagne de depart.

Ordre recommande:

1. Clients.
2. Integrations.
3. Checklist donnees manuelles.
4. Espace client.
5. Configuration du modele.
6. Objectifs business.
7. Diagnostic de croissance.
8. Effet d'evenement.
9. Retention.
10. Pouvoir de depense.
11. Previsions.
12. Objectifs de metriques.
13. P&L hebdomadaire.
14. P&L journalier.
15. Besoin en creatifs.
16. Plan de demande SKU.
17. Offer Lab / Concept Log / Ultimate Brief si necessaire.
18. Categories de campagnes.
19. Buyer Workspace.

## 1. Clients

### A quoi ca sert

Creer ou selectionner la fiche du client. C'est l'identite de base qui relie toutes les donnees GOS.

### Inputs typiques

- Nom de l'entreprise.
- Code client.
- Business type.
- Industrie.
- Owner AM.
- Phase actuelle.
- Niveau de risque initial.

### Ou recuperer la donnee

- Contrat client.
- CRM.
- Onboarding form.
- Slack/email interne.
- Call kickoff.

### Exemple complet

```text
Company name: NordicSkin
Client code: NORDIC-001
Business type: ECOMMERCE_DTC
Industry: Skincare
AM owner: Sarah
Current phase: ONBOARDING
Risk level: MEDIUM
Launch target date: 2026-08-01
```

### Quand mettre a jour

- Creation client: une seule fois.
- Owner, phase, risque: au besoin.

### Ce que ca alimente

- Toutes les routes client.
- Les permissions et scopes de donnees.
- Les filtres Supabase / Lovable Cloud.

## 2. Integrations

### A quoi ca sert

Connecter ou declarer les sources de donnees. Sans source, le systeme ne sait pas si les calculs sont fiables.

### Inputs typiques

- Shopify connected / not connected.
- Meta connected / not connected.
- Google connected / not connected.
- Finance file available / missing.
- Manual entry fallback.

### Ou recuperer la donnee

- Acces client.
- Admin Shopify.
- Business Manager Meta.
- Google Ads manager.
- Comptabilite / CFO / spreadsheet.

### Exemple complet

```text
Shopify: connected
Meta Ads: connected
Google Ads: not connected
Klaviyo: manual export only
Finance data: monthly P&L spreadsheet from CFO
Inventory: manual stock export every Monday
```

### Quand mettre a jour

- Au debut de l'onboarding.
- A chaque changement d'acces.
- Quand une integration casse.

### Ce que ca alimente

- Data readiness.
- Retention.
- Forecast.
- Buyer Workspace.
- Daily Growth Map / Walkdown.

## 3. Checklist donnees manuelles

### A quoi ca sert

Confirmer ce qui est fourni manuellement quand l'integration ne couvre pas tout.

### Inputs typiques

- Transactions disponibles.
- Spend par canal disponible.
- COGS disponible.
- Stock disponible.
- Baseline conversion disponible.
- Campaign performance disponible.

### Ou recuperer la donnee

- Exports Shopify.
- Exports ad platforms.
- Google Sheets client.
- Finance P&L.
- Warehouse / inventory export.

### Exemple complet

```text
Transactions: manual CSV from Shopify, last 24 months
COGS: monthly product margin sheet
Inventory: weekly stock CSV
Campaign performance: Meta Ads export last 90 days
Daily P&L actuals: AM enters daily revenue/spend/orders
```

### Quand mettre a jour

- Onboarding.
- Chaque semaine si source manuelle.
- Avant generation du Profit Plan.

### Ce que ca alimente

- Score de fiabilite.
- Choix entre automatique, manuel ou hypothese.

## 4. Espace client

### A quoi ca sert

Hub de navigation du client. Ce n'est pas une page ou tu entres beaucoup de donnees. Tu verifies surtout que tu es sur le bon client et que les etapes importantes sont accessibles.

### Inputs typiques

- Aucun input business majeur.

### Ou recuperer la donnee

- Le client selectionne dans la sidebar.

### Exemple d'utilisation

```text
Je selectionne NordicSkin.
Je confirme que la sidebar affiche CLIENT ACTIF: NordicSkin.
Je pars ensuite vers Configuration du modele ou Profit-First Workspace.
```

### Quand mettre a jour

Jamais, sauf si le hub evolue.

### Ce que ca alimente

Rien directement. C'est une page de navigation.

## 5. Configuration du modele

### A quoi ca sert

C'est la fondation de tous les calculs. Si cette section est incomplete, le reste du systeme peut afficher des resultats mais ils ne doivent pas etre traites comme fiables.

### Bloc A: Contexte business

#### Inputs

- Type de business.
- Pays / marche principal.
- Offre principale.
- Cycle d'achat.
- Canaux principaux.
- Contraintes connues.

#### Source

- Call kickoff.
- Site web.
- Shopify product catalog.
- Client brief.

#### Exemple

```text
Business model: DTC skincare
Market: Canada + US
Primary offer: 3-step acne routine bundle
Purchase cycle: 45-60 days
Main channels: Meta, Google, email
Known constraints: stockouts on cleanser SKU, cash cap during first 60 days
```

### Bloc B: Donnees financieres

#### Inputs

- Gross margin rate.
- COGS.
- Shipping cost.
- Fulfillment cost.
- Payment processing fee.
- Refund rate.
- Cash available for media.
- Monthly fixed burn.
- Payout delay.

#### Source

- CFO / owner.
- P&L.
- Shopify cost reports.
- Accounting system.
- Stripe / Shopify payout reports.

#### Exemple

```text
Gross margin rate: 68%
Average COGS per order: 28.00
Shipping cost per order: 7.50
Fulfillment cost per order: 3.25
Payment fee: 2.9% + 0.30
Refund reserve: 4%
Cash available for paid media this month: 55,000
Monthly fixed burn: 38,000
Payout delay: 5 days
```

### Bloc C: Produits / SKU

#### Inputs

- SKU.
- Product name.
- Price.
- AOV contribution.
- COGS.
- Gross margin.
- Expected order share.

#### Source

- Shopify products.
- Inventory file.
- Finance / COGS sheet.
- Historical order mix.

#### Exemple

```text
SKU: ACNE-BUNDLE-3STEP
Product: 3-Step Acne Routine
Price: 89.00
COGS: 24.00
Gross margin: 73%
Expected order share: 55%
```

### Bloc D: Stock / capacite

#### Inputs

- Current stock.
- Incoming inventory.
- Reorder date.
- Max orders the SKU can support.
- Operational capacity limits.

#### Source

- Shopify inventory.
- Warehouse export.
- ERP.
- Ops manager.

#### Exemple

```text
SKU: ACNE-BUNDLE-3STEP
Current stock: 1,850 units
Incoming stock: 2,000 units on 2026-08-14
Expected monthly demand from plan: 1,420 units
Risk: OK, but monitor if upside scenario exceeds 2,100 units
```

### Bloc E: Baseline quantitative

#### Inputs

- Last 30 days revenue.
- Last 30 days spend.
- Orders.
- AOV.
- CAC.
- MER.
- Conversion rate.
- Sessions.
- Email revenue if relevant.

#### Source

- Shopify analytics.
- Meta / Google spend.
- GA4.
- Triple Whale / Northbeam if available.
- Manual AM daily tracking.

#### Exemple

```text
Last 30d revenue: 182,450
Last 30d ad spend: 42,800
Orders: 2,135
AOV: 85.46
New customers: 1,120
CAC: 38.21
MER: 4.26
Conversion rate: 2.1%
Sessions: 101,700
```

### Bloc F: Economie du panier

#### Inputs

- AOV.
- Contribution before ads.
- Target contribution after ads.
- Break-even CAC.
- Target CAC.
- Required MER / AMR.

#### Source

- Donnees financieres + produits.
- Unit economics target engine.
- Finance sheet.

#### Exemple

```text
AOV: 85.46
COGS + variable costs: 35.00
Contribution before ads: 50.46
Required contribution after ads: 12.00
Break-even CAC: 50.46
Target CAC: 38.46
Required MER: 2.22
```

## 6. Objectifs business

### A quoi ca sert

Definir ce que le client veut vraiment. Ce n'est pas un objectif media arbitraire. C'est la contrainte business qui determine quel scenario et quel niveau de risque le systeme doit viser.

### Quand creer un nouvel objectif

Cree ou modifie un objectif quand:

- nouveau client;
- nouveau mois / cycle;
- changement de priorite business;
- cash plus limite que prevu;
- lancement produit important;
- objectif de sortie / levee / rentabilite;
- le client change de posture: croissance agressive vers profit, ou inverse.

Ne cree pas un nouvel objectif chaque jour. Les changements quotidiens vont plutot dans Map Notes, Budget Gate ou Forecast Updates.

### Inputs typiques

- Primary goal.
- Target revenue.
- Target contribution margin.
- Target profit.
- Timeline.
- Risk tolerance.
- Cash constraint.
- Strategic note.

### Ou recuperer la donnee

- Call kickoff.
- Call mensuel.
- Slack/email du client.
- Board / founder target.
- Finance plan.

### Exemple complet

```text
Objective name: August profitable scale plan
Primary goal: Scale revenue without dropping below minimum contribution margin
Timeline: 2026-08-01 to 2026-08-31
Revenue target: 400,000
Minimum contribution margin: 18%
Target net profit: 35,000
Risk tolerance: Medium
Cash available for media: 55,000
Hard constraint: do not exceed 65,000 media spend without approval
Decision note: client wants controlled growth before September inventory arrival
```

### Ce que ca alimente

- Pouvoir de depense.
- Forecast.
- Objectifs de metriques.
- Budget Change Gate.
- Next Cycle Planning.

## 7. Diagnostic de croissance

### A quoi ca sert

Identifier le probleme principal: volume, CAC, conversion, tracking, stock, cash, offre, creative fatigue.

### Inputs typiques

Souvent, tu ne devrais pas remplir beaucoup manuellement. Le diagnostic devrait lire:

- baseline quantitative;
- forecast;
- campaign performance;
- conversion metrics;
- spend / revenue trend;
- stock and cash constraints.

### Ou recuperer la donnee

- Configuration du modele.
- Shopify.
- Ad platforms.
- Daily P&L.
- Buyer Workspace.

### Exemple de lecture

```text
Primary problem: EFFICIENCY
Severity: HIGH
Confidence: 74%
Evidence: CAC is 62 vs target 39; CPM stable; CVR down from 2.1% to 1.3%; top creative frequency above threshold.
Recommended next section: Offer Lab + Concept Log + Creative Demand
```

### Ce que ca alimente

- Choix des sections creatives a utiliser.
- Carte d'execution.
- Wayfinder Wednesday.
- Weekly Executive Report.

## 8. Effet d'evenement

### A quoi ca sert

Modeliser l'impact d'un evenement sur revenus, spend, commandes ou conversion. Exemple: Black Friday, lancement produit, promo saisonniere, fete des meres.

### Quand l'utiliser

Utilise cette section seulement si un evenement peut changer le mois. Si le mois est normal, ne force pas un evenement.

### Inputs pour evenement planifie

- Event name.
- Event type.
- Start date.
- End date.
- Expected lift.
- Expected spend change.
- Baseline revenue.
- Confidence.
- Notes.

### Ou recuperer la donnee

- Calendrier marketing client.
- Historical event reports.
- Shopify sales from last year's event.
- Meta/Google spend during comparable event.
- Email/SMS promo calendar.
- AM judgement si aucun historique.

### Exemple complet: evenement planifie

```text
Event name: Labor Day Bundle Promo
Event type: seasonal_promo
Start date: 2026-09-01
End date: 2026-09-04
Baseline daily revenue: 6,000
Expected revenue lift: +35%
Expected spend lift: +20%
Expected conversion lift: +15%
Confidence: medium
Source: 2025 Labor Day promo generated +31% revenue lift over trailing 14-day baseline
Notes: promo applies only to bundles, inventory checked for top SKU
```

### Inputs pour moteur causal V2 / event mesure

- Pre-period dates.
- Event-period dates.
- Post-period dates.
- Metric to evaluate.
- Treatment series.
- Optional control series.
- Event notes.

### Ou recuperer la donnee

- Shopify daily revenue.
- Daily ad spend.
- Daily orders.
- GA4 sessions / conversion rate.
- Control product, control region or control channel if available.

### Exemple complet: mesure post-event

```text
Metric: daily_revenue
Pre period: 2026-08-18 to 2026-08-31
Event period: 2026-09-01 to 2026-09-04
Post period: 2026-09-05 to 2026-09-11
Treatment series: Shopify daily revenue for all promo SKUs
Control series: Shopify daily revenue for non-promo SKUs
Observed lift: +28%
Confidence note: control SKU group had stable traffic, result usable for next forecast
```

### Ce que ca alimente

- Daily Profit Plan pacing.
- Forecast event assumptions.
- Weekly report.
- Learning Loop.

## 9. Retention

### A quoi ca sert

Comprendre le revenu previsible des clients existants. La retention nourrit la partie returning revenue du forecast.

### Donnee ideale

Transactions normalisees. Deux champs sont obligatoires:

- customer_id;
- transaction_date.

Champs recommandes:

- order_id;
- revenue;
- gross_profit;
- acquisition_channel;
- product_key;
- segment_key;
- source.

### Ou recuperer la donnee

- Shopify orders export.
- Recharge / subscription platform.
- Stripe payments.
- ERP.
- Manual CSV si integration absente.

### Manual transaction: quoi mettre

Tu ajoutes une ligne par commande ou transaction.

```text
customer_id: identifiant unique client. Exemple Shopify customer ID ou email hash.
transaction_date: date de commande.
order_id: identifiant commande.
revenue: montant paye par le client hors taxes si possible.
gross_profit: revenue - COGS - variable costs si disponible.
acquisition_channel: first known paid/social/email/direct channel.
product_key: SKU ou product group principal.
segment_key: VIP, first-time, repeat, wholesale, etc.
source: manual_shopify_export, integration_shopify, manual_am_entry.
```

### Exemple complet de lignes manuelles

```text
customer_id,transaction_date,order_id,revenue,gross_profit,acquisition_channel,product_key,segment_key,source
CUST-1001,2026-05-03,ORDER-9001,89.00,52.40,meta,ACNE-BUNDLE-3STEP,new_customer,manual_shopify_export
CUST-1001,2026-06-19,ORDER-9444,42.00,23.60,email,REFILL-CLEANSER,repeat_customer,manual_shopify_export
CUST-1002,2026-05-09,ORDER-9014,120.00,71.10,google,ANTIAGING-BUNDLE,new_customer,manual_shopify_export
CUST-1003,2026-07-02,ORDER-9802,65.00,36.80,meta,SPF-DUO,new_customer,manual_shopify_export
CUST-1002,2026-07-15,ORDER-9950,38.00,21.00,email,REFILL-SERUM,repeat_customer,manual_shopify_export
```

### Ce qu'il ne faut pas faire

- Ne pas mettre une transaction sans date.
- Ne pas melanger customer_id et order_id.
- Ne pas mettre revenue = 0 si revenue est inconnue.
- Ne pas importer uniquement les repeat orders: il faut aussi les premieres commandes pour detecter les cohortes.

### Ce que ca alimente

- Cohort engine.
- Three-cohort forecast.
- LTV / CAC.
- Data Analyst Foundation.
- Profit Plan Engine.

## 10. Pouvoir de depense

### A quoi ca sert

Calculer combien on peut depenser sans casser la marge, le cash, le stock, le funnel ou les contraintes LTV/CAC.

### Inputs typiques

- Cash available.
- Monthly fixed burn.
- Gross margin / contribution margin.
- Payout delay.
- Current monthly revenue.
- Historical spend.
- Historical new customer revenue.
- Historical CAC.
- Historical MER.
- Expected sessions.
- Conversion rate.
- Inventory constraint.

### Ou recuperer la donnee

- Cash: CFO / owner / bank planning.
- Burn: P&L finance.
- Margin: finance / COGS.
- Payout delay: Shopify Payments / Stripe payouts.
- Spend/CAC/MER: Meta + Google + Shopify blended.
- Sessions/CVR: Shopify analytics / GA4.
- Inventory: warehouse / Shopify.

### Exemple complet

```text
Cash available for media: 55,000
Monthly fixed burn: 38,000
Gross margin rate: 68%
Contribution margin required: 18%
Payout delay: 5 days
Last 30d revenue: 182,450
Last 30d spend: 42,800
Last 30d new customer revenue: 98,000
Last 30d CAC: 38.21
Last 30d MER: 4.26
Expected monthly sessions: 120,000
Expected conversion rate: 2.1%
Inventory max orders this month: 2,800
```

### Ce que le systeme calcule

- Safe spend.
- Max spend.
- Recommended spend.
- Binding constraint: cash, funnel, inventory, regression, LTV.

### Ce que ca alimente

- Forecast.
- Objectifs de metriques.
- Budget Change Gate.
- Daily Budget Planner.

## 11. Previsions

### A quoi ca sert

Generer les scenarios base, upside et downside.

### Inputs typiques

Idealement, tu ne remplis pas cette page a la main. Elle consomme:

- Configuration du modele.
- Objectifs business.
- Effet d'evenement.
- Retention.
- Pouvoir de depense.
- Unit economics.
- Historical performance.

### Exemple de resultat attendu

```text
Base scenario:
Revenue: 310,000
Spend: 58,000
Orders: 3,450
CAC: 41.00
MER: 5.34
Contribution margin: 20%

Upside scenario:
Revenue: 365,000
Spend: 66,000
Orders: 4,050
CAC: 39.00
MER: 5.53
Contribution margin: 22%

Downside scenario:
Revenue: 255,000
Spend: 48,000
Orders: 2,830
CAC: 48.00
MER: 5.31
Contribution margin: 15%
```

### Quand intervenir manuellement

- Si un input source est incorrect.
- Si le client impose un scenario.
- Si un evenement n'est pas encore pris en compte.

### Ce que ca alimente

- Objectifs de metriques.
- P&L hebdomadaire.
- P&L journalier.
- Creative Demand.
- SKU Demand Plan.

## 12. Objectifs de metriques

### A quoi ca sert

Figer le scenario officiel que l'equipe va suivre. C'est la difference entre projection et engagement.

### Inputs typiques

- Selected scenario.
- Target revenue.
- Target spend.
- Target orders.
- Target CAC.
- Target MER.
- Target contribution margin.
- Lock note.

### Ou recuperer la donnee

- Page Previsions.
- Business Objectives.
- AM/client decision.

### Exemple complet

```text
Selected scenario: Base scenario
Target period: 2026-08-01 to 2026-08-31
Target revenue: 310,000
Target ad spend: 58,000
Target orders: 3,450
Target CAC: 41.00
Target MER: 5.34
Target contribution margin: 20%
Lock note: selected base scenario because inventory cannot safely support upside demand before August 14 restock
```

### Quand creer une nouvelle cible

- Nouveau cycle mensuel.
- Forecast officiellement revise.
- Client approuve un changement d'objectif.

Ne pas creer une nouvelle cible pour chaque variation quotidienne.

### Ce que ca alimente

- Weekly P&L.
- Daily P&L.
- Walkdown.
- Daily Digest.
- Weekly Executive Report.

## 13. P&L hebdomadaire

### A quoi ca sert

Decouper le plan mensuel en semaines.

### Inputs typiques

Normalement auto-genere depuis Objectifs de metriques.

Champs a verifier:

- Week start / end.
- Target revenue.
- Target spend.
- Target orders.
- Target CAC.
- Target MER.
- Notes if week has event.

### Exemple complet

```text
Week 1:
Revenue target: 68,000
Spend target: 12,500
Orders target: 760
CAC target: 41.50
MER target: 5.44
Note: normal pacing

Week 2:
Revenue target: 82,000
Spend target: 15,500
Orders target: 910
CAC target: 40.80
MER target: 5.29
Note: includes 2-day promo
```

### Quand modifier manuellement

- Event important.
- Stock arrival.
- Planned launch.
- Client cash constraint by week.

### Ce que ca alimente

- P&L journalier.
- Creative Demand.
- Weekly Executive Report.

## 14. P&L journalier

### A quoi ca sert

Transformer les objectifs en targets quotidiens. C'est la base de comparaison chaque matin.

### Inputs typiques

Normalement auto-genere depuis P&L hebdomadaire + event daily plan.

Champs a verifier:

- Date.
- Target revenue.
- Target spend.
- Target orders/leads.
- Target CAC.
- Target MER.
- Actual revenue.
- Actual spend.
- Actual orders/leads.

### Ou recuperer les actuals

- Revenue/orders: Shopify.
- Spend: Meta/Google.
- Leads: CRM / landing page tool.
- MER: revenue / spend.

### Exemple complet

```text
Date: 2026-08-05
Target revenue: 10,200
Target spend: 1,850
Target orders: 114
Target CAC: 41.00
Target MER: 5.51
Actual revenue: 9,650
Actual spend: 1,920
Actual orders: 103
Actual CAC: 46.80
Actual MER: 5.03
Note: spend slightly over target, orders below target, check conversion and campaign CPA
```

### Ce que ca alimente

- Walkdown metrics.
- Daily Digest.
- Forecast Updates.
- Weekly Executive Report.

## 15. Besoin en creatifs

### A quoi ca sert

Calculer combien de nouveaux creatifs il faut produire pour soutenir le spend sans fatigue publicitaire.

### Inputs typiques

- Weekly planned spend.
- Average CPM.
- Fatigue threshold in impressions per creative.
- Creative format mix.
- Existing active creatives.
- Production capacity.

### Ou recuperer la donnee

- Weekly spend: P&L hebdomadaire.
- CPM moyen: Meta Ads / Google Ads, last 14 or 30 days.
- Fatigue threshold: historique compte, frequency, creative decay, benchmark interne.
- Existing active creatives: Meta Ads Library / Ads Manager.
- Production capacity: creative team.

### Comment recuperer le CPM moyen

Dans Meta Ads:

```text
Ads Manager -> columns -> Performance -> CPM
Filter: last 30 days
Level: campaign or account
Use blended CPM if the plan is account-level
```

### Comment choisir le seuil de fatigue

Si historique disponible:

- Regarder le moment ou CPA monte et CTR baisse.
- Noter les impressions par creative avant deterioration.

Si historique indisponible:

- utiliser un benchmark temporaire;
- marquer faible confiance.

Exemples de benchmarks temporaires:

```text
UGC static/image: 15,000 - 30,000 impressions per creative
UGC video: 25,000 - 60,000 impressions per creative
High-production video: 50,000 - 100,000 impressions per creative
Small niche audience: lower threshold
Broad market: higher threshold
```

### Exemple complet

```text
Weekly planned spend: 14,500
Average CPM: 18.00
Expected impressions: 805,556
Fatigue threshold: 45,000 impressions per creative
Required creatives: 18
Existing usable creatives: 7
New creatives needed this week: 11
Format mix: 60% UGC video, 25% static, 15% founder/story
Production capacity: 8 per week
Risk: creative capacity short by 3 assets
```

### Ce que ca alimente

- Creative production plan.
- Concept Log.
- Testing Roadmap.
- Weekly report.

## 16. Plan de demande SKU

### A quoi ca sert

Verifier que les SKU pousses par le plan media ont assez de stock pour supporter la demande.

### Inputs typiques

- SKU.
- Current stock.
- Incoming stock.
- Expected orders from forecast.
- Expected SKU share.
- Safety stock.
- Reorder date.

### Ou recuperer la donnee

- Shopify inventory.
- Warehouse / ERP.
- Forecast orders.
- Historical product mix.

### Exemple complet

```text
SKU: ACNE-BUNDLE-3STEP
Current stock: 1,850
Incoming stock: 2,000 on 2026-08-14
Forecast monthly orders: 3,450
Expected SKU share: 55%
Expected SKU demand: 1,898 units
Safety stock: 250
Status: WATCH
Reason: upside scenario would exceed available stock before restock
Action: cap prospecting spend on this SKU until restock confirmed
```

### Ce que ca alimente

- Spend cap.
- Budget Gate.
- Campaign allocation.
- Weekly report risk section.

## 17. Offer Lab

### A quoi ca sert

Structurer ou retravailler l'offre quand le diagnostic pointe vers conversion, CAC, AOV ou desir faible.

### Quand l'utiliser

- CAC trop haut.
- Conversion rate faible.
- AOV insuffisant.
- Offre peu claire.
- Beaucoup de clics mais peu d'achats.
- Le client veut lancer une nouvelle promo/bundle.

### Inputs typiques

- Offer name.
- Product/SKU.
- Price.
- Incentive.
- Promise.
- Target audience.
- Main pain.
- Main objection.
- Proof.
- Landing page.
- Margin impact.

### Ou recuperer la donnee

- Client.
- Site/product page.
- Customer reviews.
- Support tickets.
- Competitor research.
- Shopify product performance.
- Diagnostic GOS.

### Exemple complet

```text
Offer name: Clear Skin Starter Kit
Product/SKU: ACNE-BUNDLE-3STEP
Price: 89
Incentive: free shipping + free mini cleanser
Promise: visible improvement in 30 days for mild acne
Audience: women 18-30 struggling with recurring breakouts
Pain: tried too many products, routine is confusing
Objection: afraid it will dry out skin
Proof: 1,200 reviews, dermatologist-tested, before/after assets
Landing page: /clear-skin-starter-kit
Margin impact: still above 65% gross margin after gift
Decision: test as prospecting offer for 7 days
```

### Ce que ca alimente

- Concept Log.
- Ultimate Brief.
- Testing Roadmap.
- Campaign categories.

## 18. Concept Log

### A quoi ca sert

Registre des concepts creatifs et media. Chaque concept doit etre lie a une offre, un angle, une audience et un plan de depense.

### Inputs typiques

- Concept name.
- Offer.
- Landing page.
- Angle.
- Audience.
- Copy hook.
- Creative format.
- Bid/cost cap.
- Expected spend/day.
- Campaign link.
- Ads per concept.
- Readiness.
- Status.

### Ou recuperer la donnee

- Offer Lab.
- Angle x Audience Matrix.
- Creative team.
- Media buyer.
- Meta campaign draft.
- Testing Roadmap.

### Exemple complet

```text
Concept name: Dermatologist routine teardown
Offer: Clear Skin Starter Kit
Landing page: /clear-skin-starter-kit
Angle: simplify acne routine
Audience: women 18-30, acne prone skin
Hook: "Your 8-step acne routine may be making it worse"
Format: UGC video, 30 seconds
Bid/cost cap: target CPA 41
Expected spend/day: 350
Campaign link: Meta campaign draft URL
Ads per concept: 4
Readiness: READY
Status: planned
Notes: use dermatologist proof and before/after sequence
```

### Ce que ca alimente

- Testing Roadmap.
- Creative Demand coverage.
- Buyer Workspace.
- Learning Loop.

## 19. Ultimate Brief

### A quoi ca sert

Aligner l'equipe creative sur la marque, l'offre, les preuves, les angles et les contraintes media.

### Inputs typiques

- Brand positioning.
- Target audience.
- Offer.
- Core promise.
- Proof points.
- Objections.
- Forbidden claims.
- Tone.
- Asset requirements.
- Landing page.

### Ou recuperer la donnee

- Client brand guide.
- Website.
- Reviews.
- Offer Lab.
- Concept Log.
- Legal/compliance notes.
- Winning ads.

### Exemple complet

```text
Brand: NordicSkin
Positioning: clinically grounded skincare for sensitive acne-prone skin
Audience: women 18-30 with recurring breakouts
Offer: Clear Skin Starter Kit
Core promise: simpler routine, calmer skin in 30 days
Proof: dermatologist-tested, 1,200 reviews, fragrance-free, before/after gallery
Objections: fear of dryness, tried many products before, price sensitivity
Tone: calm, expert, direct, not aggressive
Forbidden claims: do not promise cure, avoid medical claims
Assets needed: 6 UGC videos, 4 statics, 2 founder videos
Landing page: /clear-skin-starter-kit
```

### Ce que ca alimente

- Creative production.
- Concept Log.
- Testing Roadmap.

## 20. Categories de campagnes

### A quoi ca sert

Organiser les campagnes par intention pour que les budgets, CPA targets et decisions soient comparables.

### Categories communes

- Prospecting.
- Retargeting.
- Creative testing.
- Offer testing.
- Retention.
- Branded search.
- Non-branded search.

### Inputs pour une categorie

- Category name.
- Intent.
- Target CPA.
- Target daily budget.
- Priority.
- Notes.

### Ou recuperer la donnee

- Media buying strategy.
- Forecast / metric targets.
- Historical CPA by campaign type.
- Ad account structure.

### Exemple categorie

```text
Category name: Prospecting - Core Offer
Intent: acquire new customers
Target CPA: 41
Target daily budget: 1,200
Priority: high
Notes: main scale category for Clear Skin Starter Kit
```

### Inputs pour une campagne

- Campaign name.
- Platform.
- Category.
- External campaign ID.
- Current daily budget.
- Active status.
- Target CPA override if needed.

### Ou recuperer les campagnes

- Meta Ads Manager campaign list.
- Google Ads campaigns.
- Manual media plan.

### Exemple campagne

```text
Campaign name: META | Prospecting | Clear Skin Starter Kit | Broad
Platform: Meta
Category: Prospecting - Core Offer
External campaign ID: 238512345678901
Current daily budget: 450
Active: true
Target CPA: 41
Notes: broad audience, Advantage+ placements
```

### Ce que ca alimente

- Buyer Workspace.
- Daily Budget Planner.
- Budget Change Gate.
- Media Buying Automation.
- Campaign Daily Plan.

## 21. Buyer Workspace

### A quoi ca sert

Surface quotidienne pour lire la performance campagne et prendre une decision: scale, hold, reduce, pause.

### Inputs typiques

- Date.
- Campaign performance if not integrated.
- Spend.
- Revenue.
- Orders.
- Leads.
- Decision.
- Reason.
- Budget change request if any.

### Ou recuperer la donnee

- Meta/Google campaign reports.
- Shopify revenue/orders.
- Campaign categories.
- Daily P&L targets.
- Buyer judgement.

### Exemple performance manuelle

```text
Date: 2026-08-05
Campaign: META | Prospecting | Clear Skin Starter Kit | Broad
Spend: 445
Revenue: 2,190
Orders: 25
Leads: 0
CPA: 17.80
ROAS: 4.92
Decision: scale
Reason: CPA below target 41 for 3 days, inventory OK, creative frequency below fatigue threshold
Budget change: increase from 450/day to 600/day
```

### Ce que ca alimente

- Budget Change Gate.
- Budget Application Guard.
- Optimisation live.
- Map Notes.
- Weekly Executive Report.

## Routine 2: Client actif

Objectif: piloter un client deja lance.

Ordre quotidien:

1. Tableau de bord.
2. Portefeuille executif.
3. Walkdown metriques.
4. Buyer Workspace.
5. Daily Budget Planner.
6. Media Buying Automation.
7. Budget Change Gate si hausse materielle.
8. Optimisation live.
9. Map Notes.
10. Daily Digest.

Ordre hebdomadaire:

1. Wayfinder Wednesday.
2. Mesure.
3. Mises a jour previsions si ecart.
4. Weekly Executive Report.

Fin de cycle:

1. Boucle d'apprentissage.
2. Planification prochain cycle.

Au besoin:

- Concept Log.
- Testing Roadmap.
- Offer Lab.
- Angle x Audience Matrix.
- Ultimate Brief.
- Carte d'execution.

## 22. Tableau de bord

### A quoi ca sert

Voir quel client demande ton attention.

### Inputs

Normalement aucun. Le dashboard lit les clients, setup status, risk et phases.

### Action attendue

Choisir le client prioritaire puis aller dans Walkdown ou Profit Plan selon le mode.

## 23. Portefeuille executif

### A quoi ca sert

Comparer tous les clients: revenue, spend, MER, CAC, risque, tests.

### Inputs

Normalement aucun input manuel. C'est une vue de lecture.

### Action attendue

Prioriser le client ou le compte qui a le plus gros ecart business.

## 24. Walkdown metriques

### A quoi ca sert

Trouver ou ca deraille dans la hierarchie:

```text
Contribution margin
-> revenue / spend / MER
-> volume / efficiency
-> channel
-> campaign
```

### Inputs

Normalement aucun. Le walkdown consomme:

- Daily P&L actuals.
- Profit Plan days.
- Campaign performance.
- Buyer Workspace actuals.

### Exemple de lecture

```text
Contribution margin: WATCH
Revenue pacing: -8% vs target
Spend pacing: +4% vs target
MER: below target
Channel issue: Meta prospecting
Campaign issue: Broad UGC 03 has CPA 2.1x target
Next action: open Buyer Workspace and reduce or pause campaign
```

## 25. Daily Budget Planner

### A quoi ca sert

Planifier les budgets quotidiens par campagne en fonction du CPA cible et des budgets actifs.

### Inputs typiques

- Campaign/category selection.
- Proposed daily budget.
- Reason.

Le reste devrait venir de:

- Campaign categories.
- Current campaign budgets.
- Target CPA.

### Ou recuperer la donnee

- Current budget: Meta/Google campaign settings ou integration.
- Target CPA: Objectifs de metriques / Campaign Categories.
- Proposed budget: suggestion systeme ou decision Buyer Workspace.

### Exemple complet

```text
Campaign: META | Prospecting | Clear Skin Starter Kit | Broad
Current daily budget: 450
Ideal daily budget from target CPA signal rule: 585
Proposed daily budget: 600
Reason: CPA below target for 3 days and budget compliance OK
Expected impact: +33% spend, monitor CPA for 48h
```

### Ce que ca alimente

- Budget Application Guard.
- Budget Change Gate if material increase.
- Buyer Workspace decision history.

## 26. Media Buying Automation

### A quoi ca sert

Generer des suggestions basees sur des regles: scale, reduce, pause, watch.

### Inputs typiques

Au setup:

- Rule name.
- Lookback window.
- Metric condition.
- Action suggestion.
- Cooldown.

En routine:

- Lire les suggestions.
- Dismiss ou send to review.
- Ne pas marquer applied si le budget n'a pas ete applique par le guard.

### Ou recuperer la donnee

- Campaign performance.
- Campaign categories.
- Budget compliance monitor.
- Buyer Workspace.

### Exemple regle

```text
Rule name: Scale efficient prospecting
Lookback: 3 days
Condition: CPA < 0.8 x target CPA and spend > 2 x target CPA
Suggested action: scale_up
Cooldown: 3 days
Guardrail: require Budget Change Gate for material increase
```

### Exemple suggestion

```text
Campaign: META | Prospecting | Broad
Triggered because: CPA 29 vs target 41 over last 3 days
Suggested action: increase budget by 20%
Status: needs_budget_gate
```

## 27. Budget Change Gate

### A quoi ca sert

Approuver ou bloquer une hausse de budget importante avant application.

### Inputs typiques

- Proposed monthly spend.
- Reason for change.
- Source decision.
- Notes.

### Ou recuperer la donnee

- Buyer Workspace.
- Daily Budget Planner.
- Media Buying Automation.
- Current active campaign budgets.
- Latest Profit First safe spend.

### Exemple complet

```text
Current monthly active budget: 48,000
Proposed monthly spend: 61,000
Change type: increase
Reason: Meta prospecting CPA is 29 vs target 41 for 3 days; inventory and creative capacity OK
Source decision: Buyer Workspace 2026-08-05
Expected outcome: capture efficient demand while MER stays above 5.0
Approval request: allow increase with 48h review condition
```

### Ce que le systeme verifie

- Safe spend.
- Cash cap.
- Funnel cap.
- Inventory.
- Contribution margin.
- Latest analyst posture if available.

## 28. Optimisation live

### A quoi ca sert

Journal des decisions prises en live. C'est le record operationnel.

### Inputs typiques

- Date/time.
- Action taken.
- Campaign/channel.
- Reason.
- Expected impact.
- Owner.
- Follow-up date.

### Ou recuperer la donnee

- Buyer Workspace decision.
- Budget Planner.
- Media buyer notes.
- Platform changes.

### Exemple complet

```text
Date: 2026-08-05 10:30
Action: reduced budget from 450/day to 300/day
Campaign: META | Prospecting | UGC Hook Test 04
Reason: CPA 78 vs target 41 over 72h, CTR down 35%, frequency 3.8
Expected impact: reduce wasted spend by 150/day
Owner: Sarah
Follow-up: review tomorrow after 24h
```

## 29. Map Notes

### A quoi ca sert

Expliquer quoi, pourquoi, quoi faire maintenant.

### Inputs typiques

- What happened.
- So what.
- Now what.
- Linked metric.
- Linked decision.

### Exemple complet

```text
What: Meta prospecting spend was 12% over target while orders were 8% below target.
So what: MER dropped from 5.4 target to 4.7 actual, mainly from Broad UGC 04.
Now what: reduce UGC 04 by 150/day, move budget to Dermatologist Routine concept, review in 24h.
```

## 30. Daily Digest

### A quoi ca sert

Resume quotidien envoye ou partage au client.

### Inputs

Idealement auto-rempli depuis:

- Daily P&L.
- Map Notes.
- Buyer decisions.
- Walkdown.

### Exemple complet

```text
MTD revenue: 74,200 vs 78,000 target (-4.9%)
MTD spend: 13,100 vs 12,600 target (+4.0%)
MER: 5.66 vs 6.19 target
Main issue: Meta prospecting CPA above target on one UGC campaign
Action today: reduced UGC 04, shifted budget to Dermatologist Routine concept
Watch: SKU ACNE-BUNDLE stock remains OK for base scenario
```

## 31. Wayfinder Wednesday

### A quoi ca sert

Rituel hebdomadaire: decider quoi garder, scaler, couper ou tester.

### Inputs typiques

- Week summary.
- Keep.
- Scale.
- Cut.
- Test next.
- Creative learnings.
- Media learnings.
- Risks.

### Ou recuperer la donnee

- Last 7 days Buyer Workspace.
- Concept Log.
- Campaign performance.
- Creative Demand.
- Map Notes.
- Weekly P&L.

### Exemple complet

```text
Week: 2026-W32
Keep: Dermatologist Routine concept, CPA 31 vs target 41
Scale: Broad prospecting campaign from 450/day to 600/day after gate approval
Cut: UGC Hook Test 04, CPA 78 and CTR decay
Test next: founder story angle for sensitive skin objection
Creative learning: expert-led hooks outperform discount hooks by 42% CPA
Media learning: broad audience stable; interest stack fatigued after 3 days
Risk: production capacity short by 3 creatives next week
```

## 32. Mesure

### A quoi ca sert

Verifier si les resultats sont reels ou seulement attribues par la plateforme.

### Inputs typiques

- Snapshot date.
- Channel/campaign.
- Platform reported revenue.
- Blended revenue.
- Spend.
- Holdout/control note if any.
- Incrementality assumption.
- Confidence.

### Ou recuperer la donnee

- Meta/Google reported conversion value.
- Shopify total revenue.
- MER.
- Lift tests / geo holdout if available.
- MMM output if available.

### Exemple complet

```text
Snapshot date: 2026-08-07
Channel: Meta prospecting
Platform revenue: 18,400
Shopify blended revenue same period: 24,900
Spend: 4,250
Platform ROAS: 4.33
Blended MER: 5.86
Incrementality assumption: 0.72
Confidence: medium
Note: no formal holdout; use directional adjustment only
```

## 33. Mises a jour previsions

### A quoi ca sert

Reviser le forecast quand la realite s'ecarte du plan.

### Quand l'utiliser

- Revenue MTD trop bas/haut.
- Spend pacing change.
- Stockout.
- Event lift different du plan.
- Client change budget.
- Conversion issue persiste.

### Inputs typiques

- Current forecast.
- Actual MTD.
- Variance reason.
- Proposed revision.
- Approval note.

### Ou recuperer la donnee

- Daily P&L.
- Forecast.
- Map Notes.
- Budget Gate.
- Event Effect.

### Exemple complet

```text
Forecast update date: 2026-08-12
Original revenue target: 310,000
Current MTD revenue: 102,000 vs 116,000 target
Variance: -12.1%
Reason: CVR down after landing page issue and one SKU stockout
Revised monthly revenue: 292,000
Revised spend: 54,000
Approval note: AM approved conservative revision until stock restored
```

## 34. Weekly Executive Report

### A quoi ca sert

Rapport client hebdomadaire. Il doit raconter performance, decisions, risques et prochaines actions.

### Inputs typiques

- Week range.
- Revenue vs target.
- Spend vs target.
- MER/CAC.
- Wins.
- Problems.
- Actions taken.
- Next week plan.
- Risks.

### Ou recuperer la donnee

- Weekly P&L.
- Daily Digest.
- Map Notes.
- Buyer Workspace.
- Wayfinder Wednesday.
- Creative Demand.

### Exemple complet

```text
Week: 2026-08-05 to 2026-08-11
Revenue: 72,400 vs 76,000 target (-4.7%)
Spend: 13,600 vs 13,200 target (+3.0%)
MER: 5.32 vs 5.76 target
CAC: 44 vs 41 target
Win: Dermatologist Routine concept generated CPA 31
Problem: UGC Hook Test 04 fatigued after 38k impressions
Actions: reduced UGC 04, shifted budget to winning concept, approved 20% scale via Budget Gate
Next week: produce 8 new creatives, launch founder story test, monitor ACNE-BUNDLE stock
Risk: creative production capacity below required volume
```

## 35. Boucle d'apprentissage

### A quoi ca sert

Transformer les resultats en memoire reutilisable.

### Inputs typiques

- Learning title.
- What was tested.
- Result.
- Why it won/lost.
- Evidence.
- Reusable rule.
- Next action.

### Ou recuperer la donnee

- Concept Log.
- Testing Roadmap.
- Buyer Workspace.
- Weekly report.
- Wayfinder Wednesday.

### Exemple complet

```text
Learning title: Expert-led acne routine hooks beat discount hooks
Tested: Dermatologist Routine vs 20% off bundle hook
Result: expert-led CPA 31, discount CPA 52
Why: audience responded to trust and simplification, not price
Evidence: 7-day spend 4,800, 155 orders, CTR +28%, CVR +19%
Reusable rule: for acne segment, lead with authority + routine simplification before discount
Next action: create 5 new expert-led variants for next cycle
```

## 36. Planification prochain cycle

### A quoi ca sert

Preparer le prochain mois/cycle a partir des apprentissages et des resultats reels.

### Inputs typiques

- Next cycle dates.
- Revenue goal.
- Spend plan.
- Main hypothesis.
- Key risks.
- Creative plan.
- SKU constraints.
- Budget guardrails.

### Ou recuperer la donnee

- Learning Loop.
- Forecast Updates.
- Weekly reports.
- Business Objectives.
- Finance/cash.
- Inventory.

### Exemple complet

```text
Cycle: September 2026
Revenue goal: 360,000
Spend plan: 68,000
Main hypothesis: expert-led creative can scale prospecting while keeping CAC below 42
Creative plan: 24 new assets, 12 expert-led, 6 founder story, 6 objection handling
SKU risk: ACNE-BUNDLE stock tight if upside scenario hits
Budget guardrail: any monthly spend above 72,000 requires Budget Change Gate
Client priority: maintain contribution margin above 18%
```

## 37. Testing Roadmap

### A quoi ca sert

Prioriser les tests creatifs/offres/audiences.

### Inputs typiques

- Test name.
- Hypothesis.
- Source insight.
- Audience.
- Offer.
- Creative requirement.
- Success metric.
- Priority.
- Launch date.

### Ou recuperer la donnee

- Concept Log.
- Learning Loop.
- Diagnostic.
- Wayfinder Wednesday.
- Offer Lab.

### Exemple complet

```text
Test name: Founder story sensitive skin objection
Hypothesis: founder credibility will reduce purchase hesitation for sensitive skin buyers
Source insight: reviews mention fear of dryness 37 times
Audience: women 18-30 sensitive acne-prone skin
Offer: Clear Skin Starter Kit
Creative requirement: 3 founder videos, 2 statics
Success metric: CPA below 41 and CVR above 2.0%
Priority: high
Launch date: 2026-08-14
```

## 38. Angle x Audience Matrix

### A quoi ca sert

Relier chaque audience a ses douleurs, desirs, objections et angles creatifs.

### Inputs typiques

- Audience.
- Pain.
- Desire.
- Objection.
- Angle.
- Proof.
- Offer.
- Example hook.

### Ou recuperer la donnee

- Customer reviews.
- Post-purchase surveys.
- Support tickets.
- Client interviews.
- Winning comments.
- Competitor ads.
- Offer Lab.

### Exemple complet

```text
Audience: women 18-30 with recurring acne
Pain: routine is confusing and skin feels irritated
Desire: clear skin without harsh products
Objection: afraid another product will dry skin out
Angle: simplify your routine, protect skin barrier
Proof: dermatologist-tested, fragrance-free, 1,200 reviews
Offer: Clear Skin Starter Kit
Hook: "Your acne routine is not failing because you need more steps."
```

## 39. Carte d'execution

### A quoi ca sert

Transformer un diagnostic en plan d'actions concret.

### Inputs typiques

- Action.
- Owner.
- Priority.
- Due date.
- Linked metric.
- Source diagnosis.
- Expected impact.
- Status.

### Ou recuperer la donnee

- Diagnostic de croissance.
- Walkdown.
- Wayfinder Wednesday.
- Forecast Updates.
- Budget Gate.
- Weekly report.

### Exemple complet

```text
Action: launch 5 expert-led creative variants
Owner: Creative team
Priority: P0
Due date: 2026-08-12
Linked metric: CAC target 41, current CAC 52
Source diagnosis: creative fatigue and conversion drop
Expected impact: reduce prospecting CPA by 15-25%
Status: in progress
```

## 40. Work Done Metrics

### A quoi ca sert

Mesurer si l'equipe fait assez de travail utile, pas seulement si les resultats sont bons.

### Inputs typiques

- Number of creatives launched.
- Number of tests launched.
- Number of budget decisions reviewed.
- Number of optimization actions.
- Number of learnings logged.

### Ou recuperer la donnee

- Concept Log.
- Testing Roadmap.
- Buyer Workspace.
- Optimisation live.
- Learning Loop.

### Exemple complet

```text
Week: 2026-W32
Creatives launched: 9
Tests launched: 3
Budget decisions reviewed: 14
Optimization actions logged: 6
Learnings archived: 2
Comment: creative volume below required 11, add production capacity next week
```

## 41. Data Analyst / model reliability sections

Ces sections ne servent pas a agir tous les jours. Elles servent a verifier si les donnees et les modeles sont fiables.

### Data Analyst Foundation

#### Inputs

Normalement le systeme lit:

- transactions;
- daily P&L;
- projection coverage;
- campaign data;
- model runs.

#### Action

Lire si le systeme dit READY, WATCH ou BLOCKED.

### Statistical Analyst

#### Inputs

- JSON input genere par l'app.
- Python output JSON.

#### Ou recuperer

- L'app construit l'input.
- Le script Python produit l'output.

#### Exemple workflow

```text
1. Build input in Statistical Analyst.
2. Download or copy JSON.
3. Run Python batch.
4. Paste output JSON.
5. Save model run.
6. Use Decision Brief before action.
```

### Analyst Execution

#### Inputs

- Latest Decision Brief.
- Owner.
- Dates.
- Confirmation evidence.

#### Exemple

```text
Posture: controlled scale
Work item: verify Meta incrementality risk before scaling above 65,000 monthly spend
Clash: platform ROAS may include non-incremental retargeting
Code: require Budget Change Gate before increase
Confirm: AM + client approval by 2026-08-09
```

## Quick source map by input

| Input | Primary source | Fallback |
| --- | --- | --- |
| Revenue | Shopify | manual daily P&L |
| Orders | Shopify | manual daily P&L |
| Spend | Meta/Google/TikTok | media buyer export |
| CAC | Spend / new customers | ad platform CPA if only source |
| MER | Revenue / spend | platform ROAS is not MER |
| CPM | Meta/Google report | 30-day benchmark |
| AOV | Shopify revenue / orders | client estimate |
| Gross margin | finance/COGS sheet | conservative estimate |
| COGS | finance/product sheet | do not assume zero |
| Cash available | client finance | owner-approved cap |
| Payout delay | Shopify/Stripe payouts | client estimate |
| Stock | Shopify/warehouse/ERP | manual inventory export |
| Conversion rate | Shopify/GA4 | landing page analytics |
| Event lift | historical event data | AM estimate, low confidence |
| Fatigue threshold | creative performance history | internal benchmark |
| Target revenue | business objective + forecast | client-approved target |
| Target spend | spending power + forecast | AM-approved scenario |
| Target CAC | unit economics + forecast | historical CAC adjusted |
| Target MER | unit economics + forecast | gross margin guardrail |

## What to do when an input is missing

1. Do not invent a precise number.
2. Identify the source owner.
3. Use conservative fallback if the workflow must continue.
4. Mark confidence as low.
5. Add a note explaining the assumption.
6. Replace the assumption as soon as source data arrives.

Example:

```text
Missing: COGS by SKU
Fallback: use blended gross margin 62% from CFO
Confidence: medium-low
Risk: SKU-level targets may be wrong
Follow-up: request SKU COGS sheet before finalizing SKU demand plan
```

## Final operating rule

If the input changes a money decision, it needs a source and a note.

Money decisions include:

- spend target;
- CAC/MER target;
- budget increase;
- SKU push;
- forecast revision;
- creative volume commitment;
- client-facing report.

The correct AM habit is:

```text
Input -> source -> confidence -> model output -> decision -> note.
```

