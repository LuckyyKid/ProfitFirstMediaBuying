import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage14 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold">39.4 Action plan</p>
            <p>The Company will reasonably cooperate with the Client to develop an action plan including:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>analysis of the situation;</li>
              <li>strategic recommendations;</li>
              <li>adjustment or repositioning of the campaigns.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">39.4 Plan d'action</p>
            <p>La Société collaborera raisonnablement avec le Client afin d'élaborer un plan d'action incluant&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>analyse de la situation&nbsp;;</li>
              <li>recommandations stratégiques&nbsp;;</li>
              <li>ajustement ou repositionnement des campagnes.</li>
            </ul>
          </>
        )}
      </Section>

      <Section
        title={
          isEN
            ? "40. Attribution and use of results"
            : "40. Attribution et utilisation des résultats"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">40.1 Right of use for promotional purposes</p>
            <p>Subject to the confidentiality obligations set out in this Contract, the Company may use the results obtained from the advertising campaigns for promotional purposes, including in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>case studies;</li>
              <li>sales presentations;</li>
              <li>website;</li>
              <li>social media;</li>
              <li>client proposals.</li>
            </ul>
            <p className="mt-2">This use may include performance indicators such as ROAS, sales volume, growth, cost per acquisition, or any other measurable result.</p>

            <p className="font-semibold mt-4">40.2 Anonymization</p>
            <p>The Client may, by written request, require that any public use of its results:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>be anonymized;</li>
              <li>not include its trade name, brand or distinctive elements;</li>
              <li>or be limited to certain non-sensitive metrics.</li>
            </ul>
            <p className="mt-2">The Company undertakes to comply with any reasonable request for anonymization.</p>

            <p className="font-semibold mt-4">40.3 Testimonials</p>
            <p>Any testimonial or quote attributed to the Client shall be subject to the Client's prior written validation before publication.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">40.1 Droit d'utilisation à des fins promotionnelles</p>
            <p>Sous réserve des obligations de confidentialité prévues au présent Contrat, la Société peut utiliser les résultats obtenus dans le cadre des campagnes publicitaires à des fins promotionnelles, incluant notamment&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>études de cas&nbsp;;</li>
              <li>présentations commerciales&nbsp;;</li>
              <li>site web&nbsp;;</li>
              <li>réseaux sociaux&nbsp;;</li>
              <li>propositions clients.</li>
            </ul>
            <p className="mt-2">Cette utilisation peut inclure des indicateurs de performance tels que ROAS, volume de ventes, croissance, coût par acquisition ou tout autre résultat mesurable.</p>

            <p className="font-semibold mt-4">40.2 Anonymisation</p>
            <p>Le Client peut, par demande écrite, exiger que toute utilisation publique de ses résultats&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>soit anonymisée&nbsp;;</li>
              <li>n'inclue pas son nom commercial, sa marque ou ses éléments distinctifs&nbsp;;</li>
              <li>ou soit limitée à certaines métriques non sensibles.</li>
            </ul>
            <p className="mt-2">La Société s'engage à respecter toute demande raisonnable d'anonymisation.</p>

            <p className="font-semibold mt-4">40.3 Témoignages</p>
            <p>Tout témoignage ou citation attribuée au Client fera l'objet d'une validation préalable écrite par celui-ci avant publication.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "41. Training and transition" : "41. Formation et transition"}>
        {isEN ? (
          <>
            <p className="font-semibold">41.1 Knowledge-transfer session</p>
            <p>In the event of termination of this Contract, the Company will offer the Client one (1) knowledge-transfer session of a maximum duration of two (2) hours.</p>
            <p className="mt-2">This session may cover in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the structure of active campaigns;</li>
              <li>the audiences used;</li>
              <li>the current creatives;</li>
              <li>short-term strategic recommendations.</li>
            </ul>
            <p className="mt-2">The session must be scheduled within thirty (30) days following the effective termination date.</p>

            <p className="font-semibold mt-4">41.2 Transition documentation</p>
            <p>Subject to full payment of the sums due, the Company will provide the Client with reasonable transition documentation including:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the state of the campaigns at the time of termination;</li>
              <li>recent reports;</li>
              <li>the main strategic directions.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">41.1 Session de transfert de connaissances</p>
            <p>En cas de résiliation du présent Contrat, la Société offrira au Client une (1) séance de transfert de connaissances d'une durée maximale de deux (2) heures.</p>
            <p className="mt-2">Cette séance pourra porter notamment sur&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>la structure des campagnes actives&nbsp;;</li>
              <li>les audiences utilisées&nbsp;;</li>
              <li>les créatifs en cours&nbsp;;</li>
              <li>les recommandations stratégiques à court terme.</li>
            </ul>
            <p className="mt-2">La séance devra être planifiée dans un délai de trente (30) jours suivant la date effective de résiliation.</p>

            <p className="font-semibold mt-4">41.2 Documentation de transition</p>
            <p>Sous réserve du paiement intégral des sommes dues, la Société remettra au Client une documentation raisonnable de transition comprenant&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>l'état des campagnes au moment de la résiliation&nbsp;;</li>
              <li>les rapports récents&nbsp;;</li>
              <li>les principales orientations stratégiques.</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage14;
