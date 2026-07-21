import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage7 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="">
      <p className="font-semibold">24.2 Droit de refus ou de suspension</p>
      <p>La Société se réserve le droit, à sa seule discrétion raisonnable, de&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>refuser de lancer ou de maintenir toute campagne qu'elle estime non conforme aux lois applicables ou aux politiques des plateformes publicitaires&nbsp;;</li>
        <li>suspendre temporairement les campagnes en cas de doute sérieux quant à la conformité&nbsp;;</li>
        <li>exiger toute preuve documentaire nécessaire démontrant la conformité réglementaire du Client.</li>
      </ul>
      <p className="mt-2">Une telle suspension ou refus ne constitue pas une violation du Contrat par la Société.</p>

      <p className="font-semibold mt-4">24.3 Responsabilité</p>
      <p>Le Client demeure seul responsable de la conformité légale de ses produits, services et communications marketing.</p>
      <p className="mt-2">La Société ne peut être tenue responsable des conséquences résultant&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>d'une non-conformité du Client&nbsp;;</li>
        <li>d'une sanction réglementaire&nbsp;;</li>
        <li>d'une suspension ou restriction imposée par une plateforme publicitaire en raison du contenu ou du secteur d'activité du Client.</li>
      </ul>
    </Section>

    <Section title="25. Données et vie privée">
      <p className="font-semibold">25.1 Conformité aux lois applicables</p>
      <p>Les parties s'engagent à respecter l'ensemble des lois applicables en matière de protection des renseignements personnels, incluant notamment la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE / PIPEDA) ainsi que toute législation provinciale applicable, incluant la Loi 25 du Québec lorsque pertinente.</p>
      <p className="mt-2">Chaque partie demeure responsable des renseignements personnels qu'elle collecte ou traite dans le cadre de ses propres activités.</p>

      <p className="font-semibold mt-4">25.2 Propriété des données</p>
      <p>Sous réserve des droits des plateformes publicitaires (Meta, Google ou autres)&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>Les données collectées dans le cadre des campagnes publicitaires, incluant les données de prospects, formulaires, pixels et audiences, demeurent la propriété du Client.</li>
        <li>Les outils, méthodes, analyses internes, modèles stratégiques et systèmes développés par la Société demeurent la propriété exclusive de la Société.</li>
      </ul>

      <p className="font-semibold mt-4">25.3 Incident ou violation de données</p>
      <p>En cas d'accès non autorisé, de perte, de divulgation ou d'atteinte à la sécurité des renseignements personnels liés aux campagnes&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>La partie responsable devra notifier l'autre partie dans un délai maximal de quarante-huit (48) heures suivant la découverte de l'incident.</li>
        <li>Elle devra coopérer raisonnablement afin de limiter les impacts et permettre le respect des obligations légales de déclaration aux autorités compétentes et aux personnes concernées.</li>
      </ul>

      <p className="font-semibold mt-4">25.4 Conservation et suppression</p>
      <p>Sauf obligation légale contraire&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>Les données liées aux campagnes seront conservées pour une période maximale de douze (12) mois suivant la résiliation du Contrat.</li>
        <li>À l'issue de cette période, les données pourront être supprimées ou anonymisées.</li>
      </ul>
      <p className="mt-2">Il appartient au Client de sauvegarder ou d'exporter ses données avant l'expiration de la période de conservation.</p>
    </Section>
  </div>
);

export default ContractPage7;
