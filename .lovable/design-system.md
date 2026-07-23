# TDIA — Design System « Premium Dark »
> Source de vérité pour tout le rendu UI de TDIA / Profit First Media Buying.
> Le bloc « PROMPT SYSTÈME » ci-dessous doit être copié verbatim dans les instructions de l'agent.

---

## PROMPT SYSTÈME (à donner à l'agent, verbatim)

```
Tu construis les interfaces du système TDIA / Profit First Media Buying.
Applique STRICTEMENT le design system « Premium Dark » ci-dessous. Aucune exception.

AMBIANCE
- Fond quasi-noir #060910, avec UN halo lumineux radial bleu discret en haut :
  background: radial-gradient(1200px 500px at 30% -10%, rgba(47,107,255,.14), transparent 60%), #060910;
- Une seule couleur de marque : le bleu TDIA (#4d9fff → #2f6bff). Jamais de violet, teal, orange décoratif.
- Densité aérée : padding généreux (24–40px), sections séparées par des hairlines, pas des boîtes lourdes.

TYPOGRAPHIE
- Corps/UI : Inter (300–800). Titres en poids 400–500 avec letter-spacing:-.02em (jamais bold massif).
- Chiffres et données : 'JetBrains Mono', poids 300–400 pour les grands nombres, tabulaires.
- Micro-labels : JetBrains Mono 9–10px, MAJUSCULES, letter-spacing .2em à .32em, couleur muted.
- Accent éditorial : 'Instrument Serif' italique sur UN mot-clé par écran max (ex: le prénom, « driver »).
- Google Fonts: Inter:wght@300..800 · JetBrains+Mono:wght@300;400;500;700 · Instrument+Serif:ital@0;1

COULEURS (tokens)
- Fond page:        #060910
- Surface carte:    rgba(255,255,255,.02)  + box-shadow: inset 0 1px 0 rgba(255,255,255,.03)
- Surface élevée:   linear-gradient(135deg,#0b1322,#080d18)
- Hairline/bordure: rgba(148,170,215,.12)  (jamais plus opaque que .25 sauf état actif)
- Texte principal:  #eef2fa
- Texte secondaire: #c8d2e4
- Texte muted:      #8b97ad
- Texte faint:      #5f6b82
- Bleu marque:      #4d9fff  /  dégradé bouton: linear-gradient(135deg,#4d9fff,#2f6bff)
- Bleu clair (liens/labels actifs): #9ec8ff
- Statut GOOD:      #3ddc97   WATCH: #f5b74e   BAD: #ff6b6b   MISSING: #8b97ad

RECETTES DE COMPOSANTS
- Carte standard : background rgba(255,255,255,.02); border 1px rgba(148,170,215,.12);
  border-radius 14px; inset highlight. JAMAIS de fond gris plein type #1e293b.
- Carte héro / mise en avant : technique du liseré dégradé —
  wrapper { background:linear-gradient(135deg,rgba(77,159,255,.45),rgba(77,159,255,.05) 40%,rgba(148,170,215,.1)); border-radius:18px; padding:1px; box-shadow:0 24px 80px rgba(47,107,255,.18) }
  inner { background:linear-gradient(135deg,#0b1322,#080d18); border-radius:17px }
- Bouton primaire : background linear-gradient(135deg,#4d9fff,#2f6bff); border-radius 10–12px;
  box-shadow: 0 8px 28px rgba(47,107,255,.4), inset 0 1px 0 rgba(255,255,255,.25); font-weight 600.
- Bouton secondaire : fond rgba(255,255,255,.02); border 1px rgba(148,170,215,.2); texte #c8d2e4.
- Badge statut : DISCRET — point coloré 5px (avec box-shadow:0 0 8px <couleur à .8>) + micro-label
  mono letterspacing .16em. JAMAIS de gros pill plein.
- Élément actif (nav, étape en cours) : background linear-gradient(135deg,rgba(77,159,255,.14),rgba(47,107,255,.05));
  border 1px rgba(77,159,255,.25); box-shadow 0 0 24–30px rgba(47,107,255,.1–.12); texte #9ec8ff.
- Stats / KPI : PAS de boîtes — colonnes séparées par des hairlines verticales
  (border-left 1px rgba(148,170,215,.12)), grand chiffre mono 300 22–24px, delta en dessous
  avec point de statut.
- Tables : lignes séparées par hairlines rgba(148,170,215,.08–.12), en-têtes mono 8.5px
  letterspacing .2em couleur #5f6b82, pas de zébrures. Ligne en alerte : léger dégradé latéral
  linear-gradient(90deg,rgba(255,107,107,.05),transparent).
- Séparateurs de section : titre micro-label + hairline dégradée
  linear-gradient(90deg,rgba(148,170,215,.15),transparent).
- Timeline / stepper : nœuds ronds 16–23px reliés par une ligne 1px dégradée
  (fait=vert, actif=bleu avec glow, futur=hairline). Étape verrouillée : opacity .5 + bordure dashed.
- Barres de progression : hauteur 3px, fond rgba(148,170,215,.12), remplissage dégradé bleu
  (ou vert→bleu), border-radius 99px, glow léger.
- Encart « lecture du système » : fond linear-gradient(135deg,rgba(77,159,255,.08),rgba(47,107,255,.02));
  border rgba(77,159,255,.2); puce ◆ bleue; intro en Instrument Serif italique.
- Alerte bloquante : fond linear-gradient(135deg,rgba(255,107,107,.06),rgba(255,255,255,.015));
  border rgba(255,107,107,.25).

RÈGLES UX « SOP GUIDÉ » — OBLIGATOIRES SUR CHAQUE ÉCRAN
Le principe : l'Account Manager ne doit JAMAIS réfléchir à « où aller » ou « quoi faire ».
Chaque écran lui présente la suite logique. La navigation libre est l'exception, pas la règle.

1. UNE SEULE PROCHAINE ACTION. Chaque écran d'accueil a UN hero « PROCHAINE ACTION »
   (carte à liseré dégradé + bouton « Commencer ») qui dit : quoi, pour quel client,
   pourquoi (1 phrase), durée estimée. Jamais deux CTA primaires en concurrence.
2. TOUT TRAVAIL EST UNE SÉQUENCE. Les pages ne sont pas des destinations libres :
   elles sont des ÉTAPES numérotées d'une routine (rail/timeline verticale à gauche,
   « ÉTAPE X/N » dans le header). L'ordre est imposé par le système, pas choisi par l'AM.
3. CHAQUE ÉTAPE A DES CRITÈRES DE SORTIE. En bas d'écran, une barre fixe :
   à gauche « Pour terminer : … » (checklist avec ✓ / — à faire),
   à droite le bouton primaire « Étape terminée → [étape suivante nommée] »
   + un secondaire « Demander au Lead ». On ne quitte pas une étape sans savoir si elle est finie.
4. LES ÉTAPES FUTURES SONT VERROUILLÉES (opacity .5, bordure dashed, 🔒, raison :
   « requiert l'étape 4 »). On ne peut pas sauter le diagnostic pour aller toucher un budget.
5. LE SYSTÈME EXPLIQUE, L'AM EXÉCUTE. Chaque écran de données inclut un encart
   « Lecture du système » (◆ bleu) qui traduit les chiffres en UNE conclusion et UNE
   instruction (« efficacité en avance, spend en retard → ouvre la branche Ad Spend »).
   Jamais de tableau brut sans lecture.
6. LES ACTIONS SONT GÉNÉRÉES, PAS DEVINÉES. Quand le système sait quoi faire, il produit
   une file d'actions priorisées (P0/P1/P2) avec : pourquoi (données), étapes concrètes
   cochables, durée, et l'état du garde-fou (GATE APPROVED / requis). Boutons :
   « Fait — action suivante » / « Reporter » / « Escalader au Lead ».
7. ÉTAT GLOBAL TOUJOURS VISIBLE. Progression de la routine (X/N + barre fine) dans le
   header, progression par client (X/6) sur l'accueil. L'AM sait toujours où il en est.
8. LES BLOCAGES SONT DES ÉTATS, PAS DES ERREURS. missing_data bloque la routine avec
   une carte dédiée (bordure rouge translucide) qui dit la cause ET l'action de déblocage
   (« GA4 muet depuis 72h → Relancer la sync »). Jamais un zéro silencieux.
9. JUSTIFIER L'ORDRE. Le rail d'étapes se termine par un encart « Pourquoi cet ordre ? »
   (1–2 phrases, serif italique) — l'AM comprend la logique sans la questionner.
10. NAVIGATION À DEUX VITESSES. La routine guidée est le chemin par défaut ; l'accès
    libre existe toujours, mais rangé — jamais 40 pages en menu plat. Deux mécanismes
    OBLIGATOIRES ensemble :

    a) SIDEBAR HYBRIDE (référence : écran 3a)
       - Section « AUJOURD'HUI » en haut : 3–5 entrées max (Ma journée, Clients,
         Portefeuille), avec compteurs mono discrets (7/18, 3).
       - Puis hairline dégradée, puis section « BIBLIOTHÈQUE — accès libre » :
         TOUTES les pages, groupées par phase en accordéon replié par défaut
         (Setup client · Plan 30 jours · Créatif · Exécution quotidienne ·
         Review & apprentissage · Données & réglages), avec le nombre de pages
         par groupe en mono faint. Groupe ouvert : sous-liste indentée le long
         d'une hairline verticale, « + N autres… » si > 4 items.
       - En bas de sidebar : champ « Rechercher une page… » avec raccourci ⌘K.

    b) PALETTE DE COMMANDES ⌘K (référence : écran 3b)
       - Accessible partout via ⌘K. Overlay centré à liseré dégradé bleu sur fond
         assombri, ombre 0 40px 100px rgba(0,0,0,.6) + halo bleu.
       - Barre de recherche avec le client actif affiché à droite (pill bleue,
         TAB pour changer de client).
       - Résultats groupés : PAGES (avec leur phase et leur état live — ex.
         « 1 demande HOLD » avec point de statut) puis ACTIONS (◆ bleu, avec
         mention GATE REQUIS le cas échéant). Résultat sélectionné : fond gradient
         bleu translucide + bordure rgba(77,159,255,.22).
       - Footer raccourcis en mono 9px : ↑↓ NAVIGUER · ↵ OUVRIR · TAB CLIENT · ESC.

    Règle d'or : une page atteinte librement (bibliothèque ou ⌘K) garde son bandeau
    d'étape si elle appartient à une routine (« ÉTAPE 4/6 ») — l'AM sait toujours
    où elle vit dans la séquence.

INTERDITS (anti-slop)
- Pas d'emoji (sauf 🔒 pour étapes verrouillées si nécessaire).
- Pas de gradients criards multi-teintes, pas de glassmorphism laiteux, pas de border-left épaisse colorée.
- Pas de bordures grises opaques (#334155 etc.) : toujours des hairlines bleutées translucides.
- Pas de titres en font-weight 700+ ; la hiérarchie vient de la taille et de l'espace, pas du gras.
- Pas plus d'un halo lumineux par écran ; pas plus d'un accent serif italique par écran.
- Jamais de blanc pur #fff pour le texte courant (réserver aux boutons primaires).
```

---

## Tokens CSS (à mettre dans `src/index.css`, compatible avec ton setup Tailwind HSL)

```css
:root {
  /* Premium Dark — TDIA */
  --background: 220 45% 4%;          /* #060910 */
  --card: 220 40% 7%;                /* surfaces élevées */
  --card-foreground: 218 43% 96%;
  --foreground: 218 43% 96%;         /* #eef2fa */
  --muted-foreground: 218 17% 61%;   /* #8b97ad */
  --primary: 213 100% 65%;           /* #4d9fff */
  --primary-deep: 224 100% 59%;      /* #2f6bff */
  --border: 218 45% 71% / 0.12;      /* hairline rgba(148,170,215,.12) */
  --good: 156 69% 55%;               /* #3ddc97 */
  --watch: 38 89% 63%;               /* #f5b74e */
  --bad: 0 100% 71%;                 /* #ff6b6b */
  --radius: 0.875rem;                /* 14px */
}
body {
  background:
    radial-gradient(1200px 500px at 30% -10%, rgba(47,107,255,.14), transparent 60%),
    #060910;
  color: hsl(var(--foreground));
  font-family: "Inter", system-ui, sans-serif;
}
.font-data { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 300; font-variant-numeric: tabular-nums; }
.font-accent { font-family: "Instrument Serif", serif; font-style: italic; }
.microlabel { font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #8b97ad; }
.hairline { border-color: rgba(148,170,215,.12); }
.btn-primary {
  background: linear-gradient(135deg,#4d9fff,#2f6bff);
  box-shadow: 0 8px 28px rgba(47,107,255,.4), inset 0 1px 0 rgba(255,255,255,.25);
  border-radius: 12px; color:#fff; font-weight:600;
}
.card-premium {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(148,170,215,.12);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
```

## Référence visuelle
Les écrans de référence sont les options **2a**, **2b** (écrans complets), **3a** (sidebar hybride) et **3b** (palette ⌘K) du fichier `SOP Account Manager.dc.html` de ce projet. Screenshots dans `docs/design-references/` (à committer). En cas de doute, l'agent doit reproduire ces écrans, pas improviser.
