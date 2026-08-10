import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage10 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section title={isEN ? "30. Early termination for cause" : "30. Résiliation anticipée pour cause"}>
        {isEN ? (
          <>
            <p className="font-semibold">30.1 Termination by the Company</p>
            <p>The Company may terminate this Contract as of right, without prejudice to any other available remedy, in the following cases:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) Non-payment persisting more than fifteen (15) days after a written notice of default is sent;</li>
              <li>b) Provision of false, misleading or fraudulent information by the Client;</li>
              <li>c) Abusive, harassing, threatening or inappropriate behavior toward the Company's employees, officers, subcontractors or representatives;</li>
              <li>d) Violation of the policies of the advertising platforms (Meta, Google or others) attributable to the Client and resulting, or reasonably likely to result, in a suspension or account restriction;</li>
              <li>e) Repeated failure to comply with contractual obligations despite a written notice to remedy.</li>
            </ul>
            <p className="mt-2">Termination will take effect immediately or on the date indicated in the notice of termination.</p>

            <p className="font-semibold mt-4">31.2 Termination by the Client</p>
            <p>The Client may terminate this Contract for valid cause in the following situations:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) Substantial non-performance of the services for a continuous period of thirty (30) days, without reasonable justification;</li>
              <li>b) Serious and proven breach of the Company's confidentiality obligations;</li>
              <li>c) Manifest negligence or gross fault in the performance of the services, duly demonstrated.</li>
            </ul>
            <p className="mt-2">Before any termination, the Client must send a written notice detailing the alleged breach and give the Company a reasonable period of fifteen (15) days to remedy the situation, where possible.</p>

            <p className="font-semibold mt-4">31.3 Effects of early termination</p>
            <p>In the event of termination for cause:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>Amounts owed up to the effective termination date remain due.</li>
              <li>Neither party may claim indirect damages or loss of profits related to the end of the Contract.</li>
              <li>Post-termination obligations set out in this Contract shall continue to apply.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">30.1 Résiliation par la Société</p>
            <p>La Société peut résilier le présent Contrat de plein droit, sans préjudice à tout autre recours disponible, dans les cas suivants&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) Défaut de paiement persistant plus de quinze (15) jours après l'envoi d'un avis écrit de défaut&nbsp;;</li>
              <li>b) Fourniture d'informations fausses, trompeuses ou frauduleuses par le Client&nbsp;;</li>
              <li>c) Comportement abusif, harcelant, menaçant ou inapproprié envers les employés, dirigeants, sous-traitants ou représentants de la Société&nbsp;;</li>
              <li>d) Violation des politiques des plateformes publicitaires (Meta, Google ou autres) imputable au Client et entraînant, ou risquant raisonnablement d'entraîner, une suspension ou restriction de compte&nbsp;;</li>
              <li>e) Non-respect répété des obligations contractuelles malgré un avis écrit de correction.</li>
            </ul>
            <p className="mt-2">La résiliation prendra effet immédiatement ou à la date indiquée dans l'avis de résiliation.</p>

            <p className="font-semibold mt-4">31.2 Résiliation par le Client</p>
            <p>Le Client peut résilier le présent Contrat pour cause valable dans les situations suivantes&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) Non-prestation substantielle des services pendant une période continue de trente (30) jours, sans justification raisonnable&nbsp;;</li>
              <li>b) Violation grave et prouvée des obligations de confidentialité par la Société&nbsp;;</li>
              <li>c) Négligence manifeste ou faute lourde dans l'exécution des services, dûment démontrée.</li>
            </ul>
            <p className="mt-2">Avant toute résiliation, le Client devra transmettre un avis écrit détaillant le manquement allégué et accorder à la Société un délai raisonnable de quinze (15) jours pour corriger la situation, lorsque cela est possible.</p>

            <p className="font-semibold mt-4">31.3 Effets de la résiliation anticipée</p>
            <p>En cas de résiliation pour cause&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>Les montants dus jusqu'à la date effective de résiliation demeurent exigibles.</li>
              <li>Aucune partie ne pourra réclamer des dommages indirects ou pertes de profits liés à la fin du Contrat.</li>
              <li>Les obligations post-résiliation prévues au présent Contrat continueront de s'appliquer.</li>
            </ul>
          </>
        )}
      </Section>

      <Section title={isEN ? "32. Post-termination obligations" : "32. Obligations post-résiliation"}>
        {isEN ? (
          <>
            <p className="font-semibold">32.1 Return and transfer of access</p>
            <p>On the effective termination date of this Contract, the Company undertakes, subject to full payment of any sum due, to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>transfer or remove its administrative access to the Client's advertising accounts within a maximum of seven (7) business days;</li>
              <li>return any access entrusted to it by the Client.</li>
            </ul>

            <p className="font-semibold mt-4">32.2 Delivery of documents and deliverables</p>
            <p>Subject to full payment of the fees due, the Company will deliver to the Client:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>the performance reports available;</li>
              <li>the strategic documents specific to the Client.</li>
            </ul>
            <p className="italic mt-2">Note: Advertising creatives are governed by article 42. Their use after termination requires the acquisition of rights in accordance with that article.</p>

            <p className="font-semibold mt-4">32.3 Payment of sums due</p>
            <p>Termination, for any reason whatsoever, does not release the Client from its obligation to pay:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>fees that have accrued;</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">32.1 Restitution et transfert des accès</p>
            <p>À la date effective de résiliation du présent Contrat, la Société s'engage, sous réserve du paiement complet de toute somme due, à&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>transférer ou retirer ses accès administratifs aux comptes publicitaires du Client dans un délai maximal de sept (7) jours ouvrables&nbsp;;</li>
              <li>restituer les accès qui lui auraient été confiés par le Client.</li>
            </ul>

            <p className="font-semibold mt-4">32.2 Remise des documents et livrables</p>
            <p>Sous réserve du paiement intégral des honoraires dus, la Société remettra au Client&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>les rapports de performance disponibles&nbsp;;</li>
              <li>les documents stratégiques spécifiques au Client.</li>
            </ul>
            <p className="italic mt-2">Note&nbsp;: Les créatifs publicitaires sont régis par l'article 42. Leur utilisation après la résiliation nécessite l'acquisition de droits conformément audit article.</p>

            <p className="font-semibold mt-4">32.3 Paiement des sommes dues</p>
            <p>La résiliation, pour quelque cause que ce soit, ne libère pas le Client de son obligation de payer&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>les honoraires échus&nbsp;;</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage10;
