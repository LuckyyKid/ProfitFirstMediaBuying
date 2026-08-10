import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage4 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <p>
        {isEN
          ? "Meetings must be scheduled by mutual agreement. Any rescheduling or absence not reported 24 hours in advance may result in the loss of the session concerned."
          : "Les réunions doivent être planifiées d'un commun accord. Tout report ou absence non signalé 24 heures à l'avance pourra entraîner la perte de la séance concernée."}
      </p>

      <Section
        title={
          isEN
            ? "19. Delays, defaults and financial consequences"
            : "19. Retards, défauts et conséquences financières"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">19.1 Delay attributable to the Company</p>
            <p>Provided that the Client has complied with its contractual obligations (in particular the provision of necessary access and information), if the Company fails to deliver the monthly report provided for in article 18.1 within ten (10) business days following the end of the relevant month, the Client may request, as its sole and exclusive remedy for such delay, a discount equal to five percent (5%) of the monthly fees applicable to the month concerned.</p>
            <p className="mt-2">No discount will apply if the delay results from:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a lack of access to the advertising platforms;</li>
              <li>a validation delay attributable to the Client;</li>
              <li>a case of force majeure;</li>
              <li>a technical issue beyond the Company's control.</li>
            </ul>

            <p className="font-semibold mt-4">19.2 Payment delay attributable to the Client</p>
            <p>Any amount not paid when due shall automatically bear interest at the rate of two percent (2%) per month (24% per year), calculated daily from the due date until full payment.</p>
            <p className="mt-2">In the event of non-payment:</p>
            <p className="mt-1">a) The Company may suspend services after a period of seven (7) days following the due date, without such suspension constituting a breach of this Contract.</p>
            <p className="mt-1">b) If the default persists for fifteen (15) days after a written notice of default is sent, the Company may terminate the Contract as of right, without prejudice to any other remedy.</p>
            <p className="mt-2">During any period of suspension:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>The Company shall not be liable for any loss of performance or commercial opportunities.</li>
              <li>Fees shall remain due until effective termination.</li>
            </ul>

            <p className="font-semibold mt-4">19.3 Collection costs and professional fees</p>
            <p>Should the Company be required to take steps to recover any sum due under this Contract, the Client undertakes to reimburse the Company:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>all reasonable collection costs;</li>
              <li>extrajudicial legal fees;</li>
              <li>judicial, administrative or collection agency costs;</li>
              <li>as well as any expense incurred to recover the amounts due.</li>
            </ul>
            <p className="mt-2">These costs shall be in addition to the unpaid amounts and applicable interest.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">19.1 Retard imputable à la Société</p>
            <p>Sous réserve que le Client ait respecté ses obligations contractuelles (notamment la fourniture des accès et informations nécessaires), si la Société omet de transmettre le rapport mensuel prévu à l'article 18.1 dans un délai de dix (10) jours ouvrables suivant la fin du mois concerné, le Client pourra demander, à titre de seul et unique recours pour ce retard, une remise équivalente à cinq pour cent (5 %) des honoraires mensuels applicables au mois concerné.</p>
            <p className="mt-2">Aucune remise ne sera applicable si le retard résulte&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>d'un défaut d'accès aux plateformes publicitaires&nbsp;;</li>
              <li>d'un retard de validation imputable au Client&nbsp;;</li>
              <li>d'un cas de force majeure&nbsp;;</li>
              <li>d'un problème technique indépendant de la volonté de la Société.</li>
            </ul>

            <p className="font-semibold mt-4">19.2 Retard de paiement imputable au Client</p>
            <p>Tout montant non payé à son échéance portera automatiquement intérêt au taux de deux pour cent (2 %) par mois (24 % par année), calculé quotidiennement à compter de la date d'échéance jusqu'au paiement complet.</p>
            <p className="mt-2">En cas de défaut de paiement&nbsp;:</p>
            <p className="mt-1">a) La Société pourra suspendre les services après un délai de sept (7) jours suivant la date d'échéance, sans que cette suspension ne constitue une violation du présent Contrat.</p>
            <p className="mt-1">b) Si le défaut persiste pendant quinze (15) jours après l'envoi d'un avis écrit de défaut, la Société pourra résilier le Contrat de plein droit, sans préjudice à tout autre recours.</p>
            <p className="mt-2">Durant toute période de suspension&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>La Société ne sera pas responsable des pertes de performance ou d'opportunités commerciales.</li>
              <li>Les honoraires demeureront exigibles jusqu'à résiliation effective.</li>
            </ul>

            <p className="font-semibold mt-4">19.3 Frais de recouvrement et honoraires professionnels</p>
            <p>Advenant que la Société doive engager des démarches pour recouvrer toute somme due en vertu du présent Contrat, le Client s'engage à rembourser à la Société&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>tous les frais raisonnables de recouvrement&nbsp;;</li>
              <li>les honoraires extrajudiciaires d'avocats&nbsp;;</li>
              <li>les frais judiciaires, administratifs ou d'agence de recouvrement&nbsp;;</li>
              <li>ainsi que toute dépense engagée pour la récupération des montants dus.</li>
            </ul>
            <p className="mt-2">Ces frais s'ajouteront aux montants impayés et aux intérêts applicables.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "20. Audit right and access to information" : "20. Droit d'audit et accès aux informations"}>
        {isEN ? (
          <>
            <p className="font-semibold">20.1 Right of verification</p>
            <p>Subject to compliance with confidentiality obligations and the limits set out in this article, the Client may, upon written request, obtain a reasonable verification of the advertising expenses incurred in connection with the campaigns managed by the Company.</p>
            <p className="mt-2">This verification relates exclusively to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the amounts billed by the advertising platforms (Meta, Google or others);</li>
              <li>the management fees billed by the Company;</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">20.1 Droit de vérification</p>
            <p>Sous réserve du respect des obligations de confidentialité et des limites prévues au présent article, le Client peut, sur demande écrite, obtenir une vérification raisonnable des dépenses publicitaires engagées dans le cadre des campagnes gérées par la Société.</p>
            <p className="mt-2">Cette vérification porte exclusivement sur&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>les montants facturés par les plateformes publicitaires (Meta, Google ou autres)&nbsp;;</li>
              <li>les honoraires de gestion facturés par la Société&nbsp;;</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage4;
