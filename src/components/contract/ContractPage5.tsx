import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage5 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          {isEN
            ? "the performance data accessible via the advertising accounts."
            : "les données de performance accessibles via les comptes publicitaires."}
        </li>
      </ul>
      <p className="mt-2">
        {isEN
          ? "The Company is not required to disclose its internal methods, algorithms, proprietary strategies, technological tools or any other element constituting a trade secret."
          : "La Société n'est pas tenue de divulguer ses méthodes internes, algorithmes, stratégies propriétaires, outils technologiques ou tout autre élément constituant un secret commercial."}
      </p>

      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold">20.2 Document retention</p>
            <p>The Company agrees to retain the documents, reports and statements relating to the advertising campaigns for a minimum period of five (5) years following the end of the relevant fiscal year, unless otherwise required by law. Access to documents will be provided in electronic format within a reasonable time.</p>

            <p className="font-semibold mt-4">20.3 Audit procedures</p>
            <p>Any audit request must:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>be made in writing;</li>
              <li>specify the period concerned;</li>
              <li>be made with a minimum of ten (10) business days' notice.</li>
            </ul>
            <p className="mt-2">Audits must be carried out during normal business hours and not unduly disrupt the Company's operations.</p>
            <p className="mt-2">The Company may refuse any abusive, repetitive or manifestly unreasonable request.</p>
            <p className="mt-2">Audit-related costs shall be borne by the Client, unless a material error (greater than 5% of the amounts billed) is found, in which case the reasonable audit costs shall be borne by the Company.</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </Section>

      <Section title={isEN ? "21. Non-solicitation clause" : "21. Clause de non-sollicitation"}>
        {isEN ? (
          <>
            <p className="font-semibold">21.1 Non-solicitation undertaking</p>
            <p>For the entire duration of this Contract and for a period of twelve (12) months following its termination, for any reason whatsoever, each party undertakes not to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>solicit, directly or indirectly;</li>
              <li>hire;</li>
              <li>engage as a consultant, subcontractor or collaborator;</li>
              <li>or attempt to divert,</li>
            </ul>
            <p className="mt-2">any employee, officer, contractor or key collaborator of the other party who participated in the performance of this Contract.</p>

            <p className="font-semibold mt-4">21.2 Scope</p>
            <p>This clause applies to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>direct or indirect approaches;</li>
              <li>solicitations made through a third party;</li>
              <li>formal or informal job offers.</li>
            </ul>
            <p className="mt-2">A hire resulting from an unsolicited spontaneous application does not constitute a breach, provided that the hiring party can reasonably demonstrate the absence of solicitation.</p>

            <p className="font-semibold mt-4">21.3 Contractual penalty</p>
            <p>In the event of a breach of this clause, the offending party shall pay to the other party, as a contractual penalty and without prejudice to any other available remedy, a sum equal to six (6) months of the gross annual compensation or average monthly fees of the person concerned, as applicable.</p>
            <p className="mt-2">This penalty is intended to compensate for the costs of replacement, training and operational loss.</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage5;
