import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage13 = () => (
  <div className={pageClassName} style={pageStyle}>
    <ul className="list-disc ml-6 space-y-1">
      <li>les comptes Google Analytics&nbsp;;</li>
      <li>tout autre compte publicitaire ou outil d'analyse utilisé dans le cadre du présent Contrat.</li>
    </ul>
    <p className="mt-2">Le présent Contrat ne confère à la Société aucun droit de propriété sur ces comptes.</p>

    <Section title="">
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
    </Section>

    <Section title="39. Gestion de crise et mesures d'urgence">
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
    </Section>
  </div>
);

export default ContractPage13;
