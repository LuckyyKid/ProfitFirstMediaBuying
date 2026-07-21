import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage14 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="">
      <p className="font-semibold">39.4 Plan d'action</p>
      <p>La Société collaborera raisonnablement avec le Client afin d'élaborer un plan d'action incluant&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>analyse de la situation&nbsp;;</li>
        <li>recommandations stratégiques&nbsp;;</li>
        <li>ajustement ou repositionnement des campagnes.</li>
      </ul>
    </Section>

    <Section title="40. Attribution et utilisation des résultats">
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
    </Section>

    <Section title="41. Formation et transition">
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
    </Section>
  </div>
);

export default ContractPage14;
