import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage4 = () => (
  <div className={pageClassName} style={pageStyle}>
    <p>Les réunions doivent être planifiées d'un commun accord. Tout report ou absence non signalé 24 heures à l'avance pourra entraîner la perte de la séance concernée.</p>

    <Section title="19. Retards, défauts et conséquences financières">
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
    </Section>

    <Section title="20. Droit d'audit et accès aux informations">
      <p className="font-semibold">20.1 Droit de vérification</p>
      <p>Sous réserve du respect des obligations de confidentialité et des limites prévues au présent article, le Client peut, sur demande écrite, obtenir une vérification raisonnable des dépenses publicitaires engagées dans le cadre des campagnes gérées par la Société.</p>
      <p className="mt-2">Cette vérification porte exclusivement sur&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>les montants facturés par les plateformes publicitaires (Meta, Google ou autres)&nbsp;;</li>
        <li>les honoraires de gestion facturés par la Société&nbsp;;</li>
      </ul>
    </Section>
  </div>
);

export default ContractPage4;
