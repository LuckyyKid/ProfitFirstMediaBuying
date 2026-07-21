import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage10 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="30. Résiliation anticipée pour cause">
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
    </Section>

    <Section title="32. Obligations post-résiliation">
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
    </Section>
  </div>
);

export default ContractPage10;
