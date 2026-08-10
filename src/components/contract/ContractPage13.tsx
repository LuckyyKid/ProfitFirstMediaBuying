import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage13 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          {isEN ? "the Google Analytics accounts;" : "les comptes Google Analytics\u00a0;"}
        </li>
        <li>
          {isEN
            ? "any other advertising account or analytics tool used in connection with this Contract."
            : "tout autre compte publicitaire ou outil d'analyse utilisé dans le cadre du présent Contrat."}
        </li>
      </ul>
      <p className="mt-2">
        {isEN
          ? "This Contract does not grant the Company any right of ownership in these accounts."
          : "Le présent Contrat ne confère à la Société aucun droit de propriété sur ces comptes."}
      </p>

      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold mt-4">38.2 Access granted to the Company</p>
            <p>For the purposes of performing the services, the Client grants the Company administrator access or any level of access necessary to manage the campaigns.</p>
            <p className="mt-2">This access:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>is limited to the duration of the Contract;</li>
              <li>does not constitute a transfer of ownership;</li>
              <li>may be revoked by the Client after the end of the Contract, subject to compliance with post-termination obligations.</li>
            </ul>

            <p className="font-semibold mt-4">38.3 Access responsibility</p>
            <p>The Client remains responsible for:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the creation and maintenance of the accounts;</li>
              <li>the validity of the associated information;</li>
              <li>the payment methods linked to the platforms.</li>
            </ul>
            <p className="mt-2">The Company cannot be held responsible for any suspension, restriction or loss of access arising from acts or omissions of the Client.</p>
          </>
        ) : (
          <>
            <p className="font-semibold mt-4">38.2 Accès accordé à la Société</p>
            <p>Aux fins d'exécution des services, le Client accorde à la Société un accès administrateur ou tout niveau d'accès nécessaire à la gestion des campagnes.</p>
            <p className="mt-2">Cet accès&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>est limité à la durée du Contrat&nbsp;;</li>
              <li>ne constitue pas un transfert de propriété&nbsp;;</li>
              <li>peut être retiré par le Client après la fin du Contrat, sous réserve du respect des obligations post-résiliation.</li>
            </ul>

            <p className="font-semibold mt-4">38.3 Responsabilité des accès</p>
            <p>Le Client demeure responsable&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>de la création et du maintien des comptes&nbsp;;</li>
              <li>de la validité des informations associées&nbsp;;</li>
              <li>des moyens de paiement liés aux plateformes.</li>
            </ul>
            <p className="mt-2">La Société ne peut être tenue responsable d'une suspension, restriction ou perte d'accès découlant d'actions ou d'omissions du Client.</p>
          </>
        )}
      </Section>

      <Section
        title={
          isEN
            ? "39. Crisis management and emergency measures"
            : "39. Gestion de crise et mesures d'urgence"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">39.1 Definition of a crisis</p>
            <p>For the purposes of this article, a crisis situation is any event likely to significantly harm the reputation, operations or legal compliance of the Client, including in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a media controversy;</li>
              <li>a significant negative public reaction;</li>
              <li>a formal demand or regulatory intervention;</li>
              <li>a suspension or threat of suspension of an advertising account;</li>
              <li>an incident related to compliance or the truthfulness of advertising claims.</li>
            </ul>

            <p className="font-semibold mt-4">39.2 Emergency communication</p>
            <p>In a crisis situation:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>The parties undertake to communicate without delay by telephone or any other direct means agreed in Schedule C;</li>
              <li>The Client must designate a decision-making contact available in case of emergency.</li>
            </ul>

            <p className="font-semibold mt-4">39.3 Suspension authority</p>
            <p>The Company may, at its reasonable discretion, temporarily suspend all or part of the advertising campaigns if it considers that:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>continuing the campaigns could worsen the situation;</li>
              <li>a legal or regulatory non-compliance is suspected;</li>
              <li>the reputation of the Client or of the Company could be compromised.</li>
            </ul>
            <p className="mt-2">Such a suspension does not constitute a breach of this Contract and does not give rise to any penalty or compensation.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">39.1 Définition de crise</p>
            <p>Aux fins du présent article, constitue une situation de crise tout événement susceptible de nuire significativement à la réputation, aux opérations ou à la conformité légale du Client, incluant notamment&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>une controverse médiatique&nbsp;;</li>
              <li>une réaction négative importante du public&nbsp;;</li>
              <li>une mise en demeure ou intervention réglementaire&nbsp;;</li>
              <li>une suspension ou menace de suspension de compte publicitaire&nbsp;;</li>
              <li>un incident lié à la conformité ou à la véracité des allégations publicitaires.</li>
            </ul>

            <p className="font-semibold mt-4">39.2 Communication d'urgence</p>
            <p>En cas de situation de crise&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>Les parties s'engagent à communiquer sans délai par téléphone ou tout autre moyen direct convenu à l'Annexe C&nbsp;;</li>
              <li>Le Client doit désigner un contact décisionnel disponible en cas d'urgence.</li>
            </ul>

            <p className="font-semibold mt-4">39.3 Pouvoir de suspension</p>
            <p>La Société peut, à sa discrétion raisonnable, suspendre temporairement tout ou partie des campagnes publicitaires si elle estime que&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>la poursuite des campagnes pourrait aggraver la situation&nbsp;;</li>
              <li>une non-conformité légale ou réglementaire est suspectée&nbsp;;</li>
              <li>la réputation du Client ou de la Société pourrait être compromise.</li>
            </ul>
            <p className="mt-2">Une telle suspension ne constitue pas une violation du présent Contrat et ne donne droit à aucune pénalité ou indemnité.</p>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage13;
