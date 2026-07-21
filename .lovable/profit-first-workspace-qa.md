# Profit-First Workspace — QA

Route: `/admin/gos/clients/:clientId/profit-first-workspace`
Sidebar link: "Profit-First Workspace" (groupe WORKFLOW CLIENT, icône Rocket)

## Statut du build par section

| # | Section                        | Statut design | Statut data |
|---|--------------------------------|---------------|-------------|
| 1 | Executive Overview             | ✅ Tactical HUD implémenté | Demo (à câbler) |
| 2 | Data Readiness                 | ⏳ Placeholder — à designer avec l'user | — |
| 3 | Financial Foundation           | ⏳ Placeholder | — |
| 4 | Growth Diagnosis               | ⏳ Placeholder | — |
| 5 | Profit-First Spend Decision    | ⏳ Placeholder | — |
| 6 | Forecast & Targets             | ⏳ Placeholder | — |
| 7 | Execution Plan                 | ⏳ Placeholder | — |
| 8 | Live Control                   | ⏳ Placeholder | — |
| 9 | Measurement & Learning         | ⏳ Placeholder | — |

## Checks

- [x] Route enregistrée dans `src/App.tsx`
- [x] Lien sidebar visible dans `GosLayout` (WORKFLOW CLIENT)
- [x] Formules et moteurs existants inchangés (aucun import de `formulas.ts` / `hemrockForecast.ts` modifié)
- [x] Aucune page existante supprimée
- [x] Pas de LLM
- [ ] Section 1 câblée sur les vrais moteurs (aujourd'hui : données demo)
- [ ] Sections 2–9 designées + implémentées
- [ ] Panel sticky "Inputs manuels requis"
- [ ] Model dependency logic (COMPLETE / PARTIAL / BLOCKED)

## Prochaine étape

Valider avec l'user le design de la Section 2 (Data Readiness) puis enchaîner section par section jusqu'à la 9, puis câbler les vrais moteurs et le panel Inputs manuels.
