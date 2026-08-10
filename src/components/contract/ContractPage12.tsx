import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage12 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section title={isEN ? "34. Notices and communications" : "34. Avis et communications"}>
        {isEN ? (
          <>
            <p className="font-semibold">34.1 Sending methods</p>
            <p>Any notice, notification or official communication required or permitted under this Contract must be sent in writing and delivered:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) by registered mail or courier service with proof of delivery; or</li>
              <li>b) by email to the official address indicated in the Contract or to any address subsequently notified in writing.</li>
            </ul>

            <p className="font-semibold mt-4">34.2 Deemed date of receipt</p>
            <p>A notice will be deemed received:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>five (5) business days after being sent by registered mail, unless proven otherwise;</li>
              <li>twenty-four (24) hours after being sent by email, provided no delivery-failure notice is received.</li>
            </ul>

            <p className="font-semibold mt-4">34.3 Change of address</p>
            <p>Each party undertakes to notify in writing any change of postal or electronic address applicable to contractual communications. Failing such notice, any communication sent to the last known address shall be deemed valid and duly received.</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </Section>

      <Section title={isEN ? "35. Severability" : "35. Divisibilité"}>
        <p>
          {isEN
            ? "If any provision of this Contract is declared invalid, illegal or unenforceable, in whole or in part, by a competent court, that provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable, while respecting as faithfully as possible the parties' initial economic intent. If such modification is not possible, the provision concerned shall be deemed severed from the Contract. The nullity or unenforceability of any provision shall in no way affect the validity, legality or enforceability of the other provisions of this Contract, which shall remain in full force and effect."
            : "Si l'une quelconque des dispositions du présent Contrat est déclarée invalide, illégale ou inapplicable, en tout ou en partie, par un tribunal compétent, cette disposition sera réputée modifiée dans la mesure minimale nécessaire afin de la rendre valide et applicable, tout en respectant le plus fidèlement possible l'intention économique initiale des parties. Si une telle modification n'est pas possible, la disposition concernée sera réputée dissociée du Contrat. La nullité ou l'inapplicabilité d'une disposition n'affectera en aucun cas la validité, la légalité ou l'applicabilité des autres dispositions du présent Contrat, lesquelles demeureront pleinement en vigueur et exécutoires."}
        </p>
      </Section>

      <Section title={isEN ? "36. Waiver" : "36. Renonciation"}>
        <p>
          {isEN
            ? "The failure of either party to exercise, in whole or in part, any right, remedy or power provided in this Contract shall not be construed as a waiver of that right, remedy or power, nor shall it prevent its subsequent exercise. No waiver of any provision of this Contract shall be valid unless made in writing and signed by the party consenting to it. A one-off waiver of an obligation or breach shall not be construed as a continuing or general waiver of that obligation or of any other provision of the Contract."
            : "Le fait pour l'une des parties de ne pas exercer, en tout ou en partie, un droit, recours ou pouvoir prévu au présent Contrat ne saurait être interprété comme une renonciation à ce droit, recours ou pouvoir, ni empêcher son exercice ultérieur. Aucune renonciation à une disposition du présent Contrat ne sera valide à moins d'être formulée par écrit et signée par la partie qui y consent. Une renonciation ponctuelle à une obligation ou à un manquement ne saurait être interprétée comme une renonciation continue ou générale à cette obligation ou à toute autre disposition du Contrat."}
        </p>
      </Section>

      <Section title={isEN ? "37. Language" : "37. Langue"}>
        <p>
          {isEN
            ? "This Contract is drafted in the French language. Any translated version of this Contract is provided for information purposes only. In the event of any discrepancy, inconsistency or difference of interpretation between the French version and any translated version, the French version shall prevail and shall be authoritative for the purposes of interpretation and enforcement."
            : "Le présent Contrat est rédigé en langue française. Toute version traduite du présent Contrat est fournie à titre informatif seulement. En cas de divergence, d'incohérence ou de différence d'interprétation entre la version française et toute version traduite, la version française prévaudra et fera foi aux fins d'interprétation et d'exécution."}
        </p>
      </Section>

      <Section
        title={
          isEN
            ? "38. Access to and ownership of advertising accounts"
            : "38. Accès et propriété des comptes publicitaires"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">38.1 Ownership of accounts</p>
            <p>The Client remains at all times the sole owner of the accounts related to its advertising and analytics activities, including in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the Business Manager (Meta);</li>
              <li>the Meta Ads advertising accounts;</li>
              <li>the Google Ads accounts;</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">38.1 Propriété des comptes</p>
            <p>Le Client demeure en tout temps l'unique propriétaire des comptes liés à ses activités publicitaires et analytiques, incluant notamment&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>le Business Manager (Meta)&nbsp;;</li>
              <li>les comptes publicitaires Meta Ads&nbsp;;</li>
              <li>les comptes Google Ads&nbsp;;</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage12;
