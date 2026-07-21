import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage12 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="34. Avis et communications">
      <p className="font-semibold">34.1 Modalités d'envoi</p>
      <p>Tout avis, notification ou communication officielle requis ou permis en vertu du présent Contrat devra être transmis par écrit et envoyé&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>a) par courrier recommandé ou service de messagerie avec preuve de livraison&nbsp;; ou</li>
        <li>b) par courrier électronique à l'adresse officielle indiquée au Contrat ou à toute adresse ultérieurement notifiée par écrit.</li>
      </ul>

      <p className="font-semibold mt-4">34.2 Date de réception réputée</p>
      <p>Un avis sera réputé reçu&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>cinq (5) jours ouvrables après son envoi par courrier recommandé, sauf preuve contraire&nbsp;;</li>
        <li>vingt-quatre (24) heures après son envoi par courrier électronique, à condition qu'aucun avis d'échec de transmission ne soit reçu.</li>
      </ul>

      <p className="font-semibold mt-4">34.3 Changement d'adresse</p>
      <p>Chaque partie s'engage à notifier par écrit tout changement d'adresse postale ou électronique applicable aux communications contractuelles. À défaut d'un tel avis, toute communication envoyée à la dernière adresse connue sera réputée valide et dûment reçue.</p>
    </Section>

    <Section title="35. Divisibilité">
      <p>Si l'une quelconque des dispositions du présent Contrat est déclarée invalide, illégale ou inapplicable, en tout ou en partie, par un tribunal compétent, cette disposition sera réputée modifiée dans la mesure minimale nécessaire afin de la rendre valide et applicable, tout en respectant le plus fidèlement possible l'intention économique initiale des parties. Si une telle modification n'est pas possible, la disposition concernée sera réputée dissociée du Contrat. La nullité ou l'inapplicabilité d'une disposition n'affectera en aucun cas la validité, la légalité ou l'applicabilité des autres dispositions du présent Contrat, lesquelles demeureront pleinement en vigueur et exécutoires.</p>
    </Section>

    <Section title="36. Renonciation">
      <p>Le fait pour l'une des parties de ne pas exercer, en tout ou en partie, un droit, recours ou pouvoir prévu au présent Contrat ne saurait être interprété comme une renonciation à ce droit, recours ou pouvoir, ni empêcher son exercice ultérieur. Aucune renonciation à une disposition du présent Contrat ne sera valide à moins d'être formulée par écrit et signée par la partie qui y consent. Une renonciation ponctuelle à une obligation ou à un manquement ne saurait être interprétée comme une renonciation continue ou générale à cette obligation ou à toute autre disposition du Contrat.</p>
    </Section>

    <Section title="37. Langue">
      <p>Le présent Contrat est rédigé en langue française. Toute version traduite du présent Contrat est fournie à titre informatif seulement. En cas de divergence, d'incohérence ou de différence d'interprétation entre la version française et toute version traduite, la version française prévaudra et fera foi aux fins d'interprétation et d'exécution.</p>
    </Section>

    <Section title="38. Accès et propriété des comptes publicitaires">
      <p className="font-semibold">38.1 Propriété des comptes</p>
      <p>Le Client demeure en tout temps l'unique propriétaire des comptes liés à ses activités publicitaires et analytiques, incluant notamment&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>le Business Manager (Meta)&nbsp;;</li>
        <li>les comptes publicitaires Meta Ads&nbsp;;</li>
        <li>les comptes Google Ads&nbsp;;</li>
      </ul>
    </Section>
  </div>
);

export default ContractPage12;
