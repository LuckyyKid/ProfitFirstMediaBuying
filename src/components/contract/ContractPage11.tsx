import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage11 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          {isEN
            ? "costs incurred before the effective termination date;"
            : "les frais engagés avant la date effective de résiliation\u00a0;"}
        </li>
        <li>
          {isEN
            ? "any invoice outstanding on that date."
            : "toute facture en cours à cette date."}
        </li>
      </ul>

      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold mt-4">32.4 Handover file</p>
            <p>The Company will provide a reasonable handover file including:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the status of active campaigns;</li>
              <li>current budgets;</li>
              <li>relevant strategic recommendations.</li>
            </ul>
            <p className="mt-2">This document is intended to facilitate the transition to a new provider or in-house management.</p>

            <p className="font-semibold mt-4">32.5 Transition training</p>
            <p>The Company will offer a training or knowledge-transfer session of a maximum duration of two (2) hours, included as part of the termination. Any additional training will be billed separately.</p>

            <p className="font-semibold mt-4">32.6 Post-termination support</p>
            <p>The Company will provide post-termination support limited to a maximum of five (5) cumulative hours over a period of thirty (30) days following termination. Beyond this limit or period, any assistance will be billed at the prevailing rates.</p>
          </>
        ) : (
          <>
            <p className="font-semibold mt-4">32.4 Fichier de passation</p>
            <p>La Société fournira un fichier de passation raisonnable comprenant&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>l'état des campagnes actives&nbsp;;</li>
              <li>les budgets en cours&nbsp;;</li>
              <li>les recommandations stratégiques pertinentes.</li>
            </ul>
            <p className="mt-2">Ce document vise à faciliter la transition vers un nouveau prestataire ou une gestion interne.</p>

            <p className="font-semibold mt-4">32.5 Formation de transition</p>
            <p>La Société offrira une séance de formation ou de transfert de connaissances d'une durée maximale de deux (2) heures, incluse dans le cadre de la résiliation. Toute formation additionnelle fera l'objet d'une facturation distincte.</p>

            <p className="font-semibold mt-4">32.6 Support post-résiliation</p>
            <p>La Société offrira un support post-résiliation limité à un maximum de cinq (5) heures cumulatives sur une période de trente (30) jours suivant la résiliation. Au-delà de cette limite ou de cette période, toute assistance sera facturée selon les tarifs en vigueur.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "33. Dispute resolution" : "33. Résolution des différends"}>
        {isEN ? (
          <>
            <p className="font-semibold">33.1 Mandatory prior negotiation</p>
            <p>In the event of a dispute, litigation or claim arising from or relating to this Contract, the parties undertake to attempt to settle the dispute amicably, in good faith, within thirty (30) days following written notification of the dispute by one of the parties. During this period, the parties agree to actively cooperate in order to reach a mutually acceptable solution.</p>

            <p className="font-semibold mt-4">33.2 Mediation</p>
            <p>Failing amicable settlement within the period provided above, the dispute shall be submitted to a mediation process held in Montreal, Quebec, before a mediator jointly chosen by the parties. Mediation costs will be shared equally, unless otherwise agreed.</p>

            <p className="font-semibold mt-4">33.3 Jurisdiction</p>
            <p>If mediation fails or does not result in a complete resolution of the dispute, the parties agree that any judicial action shall be brought exclusively before the competent courts of the judicial district of Montreal, province of Quebec. The parties expressly acknowledge the exclusive jurisdiction of these courts.</p>

            <p className="font-semibold mt-4">33.4 Language</p>
            <p>Any judicial or arbitration proceeding arising from this Contract shall be conducted in the French language.</p>

            <p className="font-semibold mt-4">33.5 Legal costs</p>
            <p>The party that loses in a dispute shall reimburse the other party for the legal costs and reasonable attorneys' fees incurred to assert its rights, subject to the decision of the competent court.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">33.1 Négociation préalable obligatoire</p>
            <p>En cas de différend, litige ou réclamation découlant du présent Contrat ou s'y rapportant, les parties s'engagent à tenter de régler le différend à l'amiable, de bonne foi, dans un délai de trente (30) jours suivant la notification écrite du différend par l'une des parties. Durant cette période, les parties conviennent de collaborer activement afin de parvenir à une solution mutuellement acceptable.</p>

            <p className="font-semibold mt-4">33.2 Médiation</p>
            <p>À défaut de règlement amiable dans le délai prévu ci-dessus, le différend sera soumis à un processus de médiation tenu à Montréal, Québec, devant un médiateur choisi d'un commun accord entre les parties. Les frais de médiation seront partagés également, sauf entente contraire.</p>

            <p className="font-semibold mt-4">33.3 Compétence juridictionnelle</p>
            <p>Si la médiation échoue ou n'aboutit pas à une résolution complète du différend, les parties conviennent que tout recours judiciaire sera intenté exclusivement devant les tribunaux compétents du district judiciaire de Montréal, province de Québec. Les parties reconnaissent expressément la compétence exclusive de ces tribunaux.</p>

            <p className="font-semibold mt-4">33.4 Langue</p>
            <p>Toute procédure judiciaire ou arbitrale découlant du présent Contrat sera conduite en langue française.</p>

            <p className="font-semibold mt-4">33.5 Frais judiciaires</p>
            <p>La partie qui succombe dans un litige sera tenue de rembourser à l'autre partie les frais judiciaires et honoraires raisonnables d'avocats engagés pour faire valoir ses droits, sous réserve de la décision du tribunal compétent.</p>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage11;
