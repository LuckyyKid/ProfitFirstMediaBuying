import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage3 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section title={isEN ? "14. Headings" : "14. Titres"}>
        <p>
          {isEN
            ? "The headings preceding the paragraphs of this Contract are intended solely for ease of reference, do not form part of this Contract and shall not be considered in the interpretation of any part of this Contract."
            : "Les titres qui précèdent les paragraphes du présent Contrat sont uniquement destinés à faciliter les références, ne font pas partie du présent Contrat et ne doivent pas être pris en compte dans l'interprétation de toute partie du présent Contrat."}
        </p>
      </Section>

      <Section title={isEN ? "18. Deliverables and service levels" : "18. Livrable et niveau de service"}>
        {isEN ? (
          <>
            <p className="font-semibold">18.1 Reporting and access to data</p>
            <p>The Company agrees to provide the Client with the following:</p>
            <p className="mt-2">a) A detailed monthly report, delivered within ten (10) business days following the end of each month, including in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>advertising spend per platform,</li>
              <li>key performance indicators (KPIs),</li>
              <li>analysis of results,</li>
              <li>strategic recommendations for the following month.</li>
            </ul>
            <p className="mt-2">b) A summary weekly report, when provided in Schedule A or agreed between the parties, presenting the key indicators and main trends.</p>
            <p className="mt-2">c) Continuous access to the advertising dashboards, including the Meta Ads and Google Ads accounts, subject to the ongoing administrator access provided by the Client.</p>
            <p className="italic mt-2">The Company cannot be held responsible for any reporting delay resulting from a lack of access to the necessary platforms or data.</p>

            <p className="font-semibold mt-4">18.2 Response times for communications</p>
            <p>The Company agrees to respond to the Client's written communications within twenty-four (24) to forty-eight (48) business hours.</p>
            <p className="mt-2">This timeframe applies to business days only and excludes weekends and holidays.</p>
            <p className="mt-2">Urgent requests must be identified as such by the Client and will be handled as a priority within a reasonable timeframe.</p>

            <p className="font-semibold mt-4">18.3 Content creation and revisions</p>
            <p>Unless otherwise specified in Schedule A:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>The Company will produce a minimum of 7 ad creatives per month, including visuals, ad copy or strategic variants.</li>
              <li>Each creative includes a maximum of 4 revision cycles.</li>
              <li>A revision cycle corresponds to a consolidated set of changes requested by the Client.</li>
            </ul>
            <p className="mt-2">Any request exceeding the number of included revisions may be subject to additional billing at the prevailing rates.</p>

            <p className="font-semibold mt-4">18.4 Strategy meetings</p>
            <p>The Company will organize:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>One (1) weekly strategy meeting via video call, to monitor performance, adjust direction and validate the next actions.</li>
              <li>One (1) monthly strategy meeting via video call, to analyze performance, adjust direction and validate the next actions.</li>
              <li>One (1) in-depth quarterly strategy review, covering in particular: the evolution of performance, the overall media strategy, budget optimization, and growth axes.</li>
            </ul>
            <p className="mt-2">Meetings must be scheduled by mutual agreement. Any rescheduling or absence not reported 24 hours in advance may result in the loss of the session concerned.</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage3;
