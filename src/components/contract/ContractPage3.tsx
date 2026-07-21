import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage3 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="14. Titres">
      <p>Les titres qui précèdent les paragraphes du présent Contrat sont uniquement destinés à faciliter les références, ne font pas partie du présent Contrat et ne doivent pas être pris en compte dans l'interprétation de toute partie du présent Contrat.</p>
    </Section>

    <Section title="18. Livrable et niveau de service">
      <p className="font-semibold">18.1 Reporting et accès aux données</p>
      <p>La Société s'engage à fournir au Client les éléments suivants&nbsp;:</p>
      <p className="mt-2">a) Rapport mensuel détaillé, transmis dans un délai maximal de dix (10) jours ouvrables suivant la fin de chaque mois, incluant notamment&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>les dépenses publicitaires par plateforme,</li>
        <li>les principaux indicateurs de performance (KPIs),</li>
        <li>l'analyse des résultats,</li>
        <li>les recommandations stratégiques pour le mois suivant.</li>
      </ul>
      <p className="mt-2">b) Rapport hebdomadaire synthétique, lorsque prévu à l'Annexe A ou convenu entre les parties, présentant les indicateurs clés et les tendances principales.</p>
      <p className="mt-2">c) Accès continu aux tableaux de bord publicitaires, incluant les comptes Meta Ads et Google Ads, sous réserve du maintien des accès administrateur fournis par le Client.</p>
      <p className="italic mt-2">La Société ne peut être tenue responsable d'un retard de reporting résultant d'un défaut d'accès aux plateformes ou aux données nécessaires.</p>

      <p className="font-semibold mt-4">18.2 Délais de réponse aux communications</p>
      <p>La Société s'engage à répondre aux communications écrites du Client dans un délai de vingt-quatre (24) à quarante-huit (48) heures ouvrables.</p>
      <p className="mt-2">Ce délai s'applique aux jours ouvrables uniquement et exclut les fins de semaine et jours fériés.</p>
      <p className="mt-2">Les demandes urgentes doivent être identifiées comme telles par le Client et feront l'objet d'un traitement prioritaire dans un délai raisonnable.</p>

      <p className="font-semibold mt-4">18.3 Création de contenu et révisions</p>
      <p>Sauf stipulation contraire à l'Annexe A&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>La Société produira un minimum de 7 créatifs publicitaires par mois, incluant visuels, textes publicitaires ou variantes stratégiques.</li>
        <li>Chaque créatif inclut un maximum de 4 cycles de révision.</li>
        <li>Un cycle de révision correspond à une série consolidée de modifications demandées par le Client.</li>
      </ul>
      <p className="mt-2">Toute demande excédant le nombre de révisions incluses pourra faire l'objet d'une facturation additionnelle selon les tarifs en vigueur.</p>

      <p className="font-semibold mt-4">18.4 Réunions stratégiques</p>
      <p>La Société organisera&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>Une (1) réunion stratégique hebdomadaire en visioconférence, visant à suivre les performances, ajuster les orientations et valider les prochaines actions.</li>
        <li>Une (1) réunion stratégique mensuelle en visioconférence, visant à analyser les performances, ajuster les orientations et valider les prochaines actions.</li>
        <li>Une (1) revue stratégique trimestrielle approfondie, portant notamment sur&nbsp;: l'évolution des performances, la stratégie média globale, l'optimisation budgétaire, les axes de croissance.</li>
      </ul>
      <p className="mt-2">Les réunions doivent être planifiées d'un commun accord. Tout report ou absence non signalé 24 heures à l'avance pourra entraîner la perte de la séance concernée.</p>
    </Section>
  </div>
);

export default ContractPage3;
