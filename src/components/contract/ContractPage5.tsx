import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage5 = () => (
  <div className={pageClassName} style={pageStyle}>
    <ul className="list-disc ml-6 space-y-1">
      <li>les données de performance accessibles via les comptes publicitaires.</li>
    </ul>
    <p className="mt-2">La Société n'est pas tenue de divulguer ses méthodes internes, algorithmes, stratégies propriétaires, outils technologiques ou tout autre élément constituant un secret commercial.</p>

    <Section title="">
      <p className="font-semibold">20.2 Conservation des documents</p>
      <p>La Société s'engage à conserver les documents, rapports et relevés relatifs aux campagnes publicitaires pendant une période minimale de cinq (5) ans suivant la fin de l'exercice concerné, sauf obligation légale contraire. L'accès aux documents sera fourni sous format électronique dans un délai raisonnable.</p>

      <p className="font-semibold mt-4">20.3 Modalités d'audit</p>
      <p>Toute demande d'audit doit&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>être formulée par écrit&nbsp;;</li>
        <li>préciser la période concernée&nbsp;;</li>
        <li>être effectuée avec un préavis minimal de dix (10) jours ouvrables.</li>
      </ul>
      <p className="mt-2">Les audits doivent être réalisés durant les heures normales d'affaires et ne pas perturber indûment les opérations de la Société.</p>
      <p className="mt-2">La Société peut refuser toute demande abusive, répétitive ou manifestement déraisonnable.</p>
      <p className="mt-2">Les frais liés à l'audit sont à la charge du Client, sauf si une erreur significative (supérieure à 5 % des montants facturés) est constatée, auquel cas les frais raisonnables d'audit seront assumés par la Société.</p>
    </Section>

    <Section title="21. Clause de non-sollicitation">
      <p className="font-semibold">21.1 Engagement de non-sollicitation</p>
      <p>Pendant toute la durée du présent Contrat et pour une période de douze (12) mois suivant sa résiliation, pour quelque cause que ce soit, chacune des parties s'engage à ne pas&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>solliciter, directement ou indirectement&nbsp;;</li>
        <li>embaucher&nbsp;;</li>
        <li>engager à titre de consultant, sous-traitant ou collaborateur&nbsp;;</li>
        <li>ou tenter de détourner,</li>
      </ul>
      <p className="mt-2">tout employé, dirigeant, contractuel ou collaborateur clé de l'autre partie ayant participé à l'exécution du présent Contrat.</p>

      <p className="font-semibold mt-4">21.2 Portée</p>
      <p>La présente clause s'applique&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>aux démarches directes ou indirectes&nbsp;;</li>
        <li>aux sollicitations effectuées par l'entremise d'un tiers&nbsp;;</li>
        <li>aux offres d'emploi formelles ou informelles.</li>
      </ul>
      <p className="mt-2">Ne constitue pas une violation une embauche résultant d'une candidature spontanée non sollicitée, à condition que la partie embauchante puisse raisonnablement démontrer l'absence de sollicitation.</p>

      <p className="font-semibold mt-4">21.3 Pénalité contractuelle</p>
      <p>En cas de violation de la présente clause, la partie fautive devra verser à l'autre partie, à titre de clause pénale et sans préjudice à tout autre recours disponible, une somme équivalente à six (6) mois de la rémunération brute annuelle ou des honoraires moyens mensuels de la personne concernée, selon le cas.</p>
      <p className="mt-2">Cette pénalité vise à compenser les coûts de remplacement, de formation et de perte opérationnelle.</p>
    </Section>
  </div>
);

export default ContractPage5;
