import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage9 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          {isEN
            ? "Creation of custom artificial-intelligence tools, including in particular: bespoke AI models, AI automations, predictive analytics systems, custom chatbots or AI assistants, advanced AI API integrations."
            : "Création d'outils d'intelligence artificielle personnalisés, incluant notamment\u00a0: modèles IA sur mesure, automatisations IA, systèmes d'analyse prédictive, chatbots ou assistants IA personnalisés, intégrations API IA avancées."}
        </li>
      </ul>

      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold mt-4">28.2 Additional services</p>
            <p>Any request relating to an out-of-scope service must:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>be the subject of a written request from the Client;</li>
              <li>be assessed by the Company;</li>
              <li>be the subject of a separate quote or written contractual addendum specifying: the scope of work, deadlines, applicable fees, payment terms.</li>
            </ul>
            <p className="mt-2">No additional service will be performed without prior written acceptance of the quote by the Client.</p>

            <p className="font-semibold mt-4">28.3 Pricing</p>
            <p>Additional services may be billed:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>at an hourly rate;</li>
              <li>at a fixed price;</li>
              <li>or according to a specific project model.</li>
            </ul>
            <p className="mt-2">The applicable rates will be those in force at the time of the request.</p>
          </>
        ) : (
          <>
            <p className="font-semibold mt-4">28.2 Services additionnels</p>
            <p>Toute demande relative à un service hors scope devra&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>faire l'objet d'une demande écrite du Client&nbsp;;</li>
              <li>être évaluée par la Société&nbsp;;</li>
              <li>faire l'objet d'un devis distinct ou d'un avenant contractuel écrit précisant&nbsp;: l'étendue des travaux, les délais, les honoraires applicables, les modalités de paiement.</li>
            </ul>
            <p className="mt-2">Aucun service additionnel ne sera exécuté sans acceptation écrite préalable du devis par le Client.</p>

            <p className="font-semibold mt-4">28.3 Tarification</p>
            <p>Les services additionnels pourront être facturés&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>à taux horaire&nbsp;;</li>
              <li>au forfait&nbsp;;</li>
              <li>ou selon un modèle de projet spécifique.</li>
            </ul>
            <p className="mt-2">Les tarifs applicables seront ceux en vigueur au moment de la demande.</p>
          </>
        )}
      </Section>

      <Section
        title={
          isEN
            ? "29. Initial optimization period and warranty limitation"
            : "29. Période d'optimisation initiale et limitation de garantie"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">29.1 Adjustment period</p>
            <p>The parties acknowledge that an initial optimization period of thirty (30) to forty-five (45) days following the launch of the campaigns is necessary in order to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>test audiences, creatives and messages;</li>
              <li>collect statistically significant data;</li>
              <li>allow the advertising platforms' algorithms to stabilize;</li>
              <li>make the strategic adjustments required.</li>
            </ul>
            <p className="mt-2">During this period, performance may fluctuate and does not constitute a definitive indication of long-term results.</p>

            <p className="font-semibold mt-4">29.2 Performance evaluation</p>
            <p>The evaluation of results shall take into account, among other things:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the quality and competitiveness of the Client's offer;</li>
              <li>the Client's positioning in its market;</li>
              <li>seasonality;</li>
              <li>competition;</li>
              <li>the allocated advertising budget;</li>
              <li>as well as any external factor beyond the Company's control.</li>
            </ul>

            <p className="font-semibold mt-4">29.3 Corrective measures</p>
            <p>If, at the end of the optimization period, the results are reasonably below the strategic expectations set between the parties:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the Company will carry out a strategic review at no additional cost;</li>
              <li>reasonable adjustments to the campaigns will be made.</li>
            </ul>
            <p className="mt-2">These measures constitute the Client's sole remedy in respect of initial performance.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">29.1 Période d'ajustement</p>
            <p>Les parties reconnaissent qu'une période d'optimisation initiale de trente (30) à quarante-cinq (45) jours suivant le lancement des campagnes est nécessaire afin de&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>tester les audiences, créatifs et messages&nbsp;;</li>
              <li>collecter des données statistiques significatives&nbsp;;</li>
              <li>permettre aux algorithmes des plateformes publicitaires de se stabiliser&nbsp;;</li>
              <li>procéder aux ajustements stratégiques requis.</li>
            </ul>
            <p className="mt-2">Durant cette période, les performances peuvent fluctuer et ne constituent pas une indication définitive des résultats à long terme.</p>

            <p className="font-semibold mt-4">29.2 Évaluation des performances</p>
            <p>L'évaluation des résultats tiendra compte notamment&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>de la qualité et de la compétitivité de l'offre du Client&nbsp;;</li>
              <li>du positionnement du Client sur son marché&nbsp;;</li>
              <li>de la saisonnalité&nbsp;;</li>
              <li>de la concurrence&nbsp;;</li>
              <li>du budget publicitaire alloué&nbsp;;</li>
              <li>ainsi que de tout facteur externe indépendant de la volonté de la Société.</li>
            </ul>

            <p className="font-semibold mt-4">29.3 Mesures correctives</p>
            <p>Si, à l'issue de la période d'optimisation, les résultats sont raisonnablement inférieurs aux attentes stratégiques établies entre les parties&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>la Société procédera à une révision stratégique sans frais additionnels&nbsp;;</li>
              <li>des ajustements raisonnables des campagnes seront effectués.</li>
            </ul>
            <p className="mt-2">Ces mesures constituent le seul recours du Client relativement à la performance initiale.</p>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage9;
